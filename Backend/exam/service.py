"""Service layer for Exam / Mock Exam Engine.

Orchestrates:
- Grounded question generation via AssessmentEngine & DocumentChunks
- Server-authoritative timing, expiration, and idempotent submission
- Answer leakage defense via sanitized active attempt DTOs
- Phase 3 Learner Topic Mastery updates & LearningEvent audit logging
- Adaptive Study Planner intelligence integration
- Multi-tenant tenant authorization & IDOR prevention
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
import logging
from sqlalchemy.orm import Session
from fastapi import HTTPException

from database import (
    Exam,
    ExamQuestion,
    ExamAttempt,
    ExamAnswer,
    StudySession,
    DocumentChunk,
    User,
    LearningEvent,
)
from intelligence import AssessmentEngine, LearnerEngine
from .models import (
    ExamCreateRequest,
    ExamResponse,
    ExamQuestionSanitizedResponse,
    ExamAttemptResponse,
    ExamQuestionReviewResponse,
    ExamAttemptReviewResponse,
)
from .scoring import (
    evaluate_answer,
    calculate_topic_performance,
    generate_recommended_actions,
)

logger = logging.getLogger(__name__)


class ExamService:
    @staticmethod
    def _now_utc() -> datetime:
        return datetime.utcnow()

    @classmethod
    def get_exam_or_404(cls, db: Session, user_id: int, exam_id: int) -> Exam:
        """Retrieves an exam blueprint enforcing tenant isolation."""
        exam = db.query(Exam).filter(
            Exam.id == exam_id,
            Exam.user_id == user_id
        ).first()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found or unauthorized")
        return exam

    @classmethod
    def get_attempt_or_404(cls, db: Session, user_id: int, attempt_id: int) -> ExamAttempt:
        """Retrieves an exam attempt enforcing tenant isolation."""
        attempt = db.query(ExamAttempt).filter(
            ExamAttempt.id == attempt_id,
            ExamAttempt.user_id == user_id
        ).first()
        if not attempt:
            raise HTTPException(status_code=404, detail="Exam attempt not found or unauthorized")
        return attempt

    @classmethod
    def serialize_exam(cls, exam: Exam) -> ExamResponse:
        session_title = exam.session.ai_title or exam.session.filename if exam.session else None
        best_score = None
        completed_attempts = [a for a in (exam.attempts or []) if a.status in ["submitted", "timed_out", "graded"]]
        if completed_attempts:
            valid_scores = [a.percentage for a in completed_attempts if a.percentage is not None]
            best_score = round(max(valid_scores), 1) if valid_scores else None

        topics_val = []
        if isinstance(exam.topics, list):
            topics_val = exam.topics
        elif isinstance(exam.topics, str):
            try:
                import json
                parsed = json.loads(exam.topics)
                if isinstance(parsed, list):
                    topics_val = parsed
                else:
                    topics_val = [exam.topics] if exam.topics else []
            except Exception:
                topics_val = [exam.topics] if exam.topics else []

        return ExamResponse(
            id=exam.id,
            user_id=exam.user_id,
            session_id=exam.session_id,
            session_title=session_title,
            title=exam.title,
            description=exam.description,
            exam_mode=exam.exam_mode,
            difficulty=exam.difficulty,
            duration_minutes=exam.duration_minutes,
            passing_percentage=exam.passing_percentage,
            total_questions=exam.total_questions,
            topics=topics_val,
            created_at=exam.created_at.isoformat() if exam.created_at else "",
            updated_at=exam.updated_at.isoformat() if exam.updated_at else "",
            attempts_count=len(exam.attempts) if exam.attempts else 0,
            best_score=best_score,
        )

    @classmethod
    def serialize_active_attempt(cls, attempt: ExamAttempt) -> ExamAttemptResponse:
        """Serializes an active attempt, strictly withholding correct answers and explanations."""
        now = cls._now_utc()
        remaining_sec = None
        if attempt.expires_at:
            delta = (attempt.expires_at - now).total_seconds()
            remaining_sec = max(0, int(delta))

        # Build sanitized questions
        sanitized_questions = [
            ExamQuestionSanitizedResponse(
                id=q.id,
                exam_id=q.exam_id,
                question_order=q.question_order,
                question_text=q.question_text,
                question_type=q.question_type,
                options=q.options or [],
                topic=q.topic or "General",
                difficulty=q.difficulty or "intermediate",
            )
            for q in sorted(attempt.exam.questions, key=lambda x: x.question_order)
        ]

        # Build saved answers map
        saved = {}
        for ans in attempt.answers:
            saved[str(ans.question_id)] = {
                "user_answer": ans.user_answer,
                "is_marked_for_review": bool(ans.is_marked_for_review),
                "time_spent_seconds": ans.time_spent_seconds or 0,
            }

        return ExamAttemptResponse(
            id=attempt.id,
            exam_id=attempt.exam_id,
            user_id=attempt.user_id,
            exam_title=attempt.exam.title,
            exam_mode=attempt.exam.exam_mode,
            status=attempt.status,
            started_at=attempt.started_at.isoformat() if attempt.started_at else "",
            expires_at=attempt.expires_at.isoformat() if attempt.expires_at else None,
            duration_minutes=attempt.exam.duration_minutes,
            remaining_seconds=remaining_sec,
            total_questions=attempt.total_questions,
            questions=sanitized_questions,
            saved_answers=saved,
        )

    @classmethod
    def create_exam(
        cls,
        db: Session,
        user: User,
        req: ExamCreateRequest,
        gemini_client: Any = None,
        model_name: str = "gemini-2.5-flash",
        generate_fallback_fn: Any = None
    ) -> ExamResponse:
        """Creates a grounded exam blueprint with persisted questions."""
        session = None
        chunks_data = []

        if req.session_id:
            session = db.query(StudySession).filter(
                StudySession.id == req.session_id,
                StudySession.user_id == user.id
            ).first()
            if not session:
                raise HTTPException(status_code=404, detail="Study session not found or unauthorized")

            db_chunks = db.query(DocumentChunk).filter(
                DocumentChunk.session_id == session.id
            ).order_by(DocumentChunk.chunk_index).all()

            if db_chunks:
                chunks_data = [
                    {
                        "chunk_index": c.chunk_index,
                        "text_content": c.text_content,
                        "page_number": c.page_number,
                        "section_heading": c.section_heading or "General",
                        "content_type": c.content_type or "text"
                    }
                    for c in db_chunks
                ]

        target_topic = req.topics[0] if req.topics else (session.filename if session else "General")

        generated_questions = []
        if chunks_data:
            try:
                generated_questions = AssessmentEngine.generate_quiz(
                    chunks=chunks_data,
                    num_questions=req.num_questions,
                    difficulty=req.difficulty,
                    topic=target_topic,
                    gemini_client=gemini_client,
                    model_name=model_name,
                    generate_fallback_fn=generate_fallback_fn
                )
            except Exception as e:
                logger.warning(f"AssessmentEngine grounded quiz generation failed: {e}")

        # Fallback if chunks were absent or LLM generation returned empty
        if not generated_questions and session and session.content:
            instruction = (
                f"Generate exactly {req.num_questions} high-quality multiple-choice questions "
                f"at {req.difficulty.upper()} difficulty for topic '{target_topic}'. "
                "Return ONLY a JSON array with objects containing: question, options, answer (0-based integer index), explanation."
            )
            try:
                if generate_fallback_fn:
                    raw = generate_fallback_fn(session.content[:6000], instruction)
                    from intelligence.assessment import clean_json_string
                    import json
                    parsed = json.loads(clean_json_string(raw))
                    if isinstance(parsed, list):
                        for item in parsed:
                            opts = item.get("options", [])
                            if item.get("question") and len(opts) >= 2:
                                generated_questions.append({
                                    "question": str(item["question"]).strip(),
                                    "options": [str(o).strip() for o in opts],
                                    "answer": int(item.get("answer", 0)),
                                    "explanation": str(item.get("explanation", "Grounded in study material.")),
                                    "topic": target_topic,
                                    "difficulty": req.difficulty,
                                    "page_number": None,
                                    "section_heading": "General",
                                    "source_chunk_id": None
                                })
            except Exception as e:
                logger.warning(f"Fallback question generator failed: {e}")

        # Deterministic grounded fallback when LLM is unavailable, rate-limited, or quota-exhausted
        if not generated_questions:
            import re
            candidate_facts = []
            if chunks_data:
                for c in chunks_data:
                    c_text = c.get("text_content", "")
                    sentences = [s.strip() for s in re.split(r'[.\n;]+', c_text) if len(s.strip()) >= 15]
                    for s in sentences:
                        candidate_facts.append({
                            "fact": s,
                            "page_number": c.get("page_number"),
                            "section_heading": c.get("section_heading", "General"),
                            "chunk_id": c.get("chunk_index")
                        })
            elif session and (session.content or session.summary):
                raw_text = f"{session.content or ''} {session.summary or ''}"
                sentences = [s.strip() for s in re.split(r'[.\n;]+', raw_text) if len(s.strip()) >= 15]
                for s in sentences:
                    candidate_facts.append({
                        "fact": s,
                        "page_number": None,
                        "section_heading": "General",
                        "chunk_id": None
                    })

            if not candidate_facts:
                candidate_facts.append({
                    "fact": f"Core principles and definitions governing {target_topic}.",
                    "page_number": None,
                    "section_heading": "General",
                    "chunk_id": None
                })

            for idx in range(req.num_questions):
                selected = candidate_facts[idx % len(candidate_facts)]
                fact_text = selected["fact"]
                distractor_1 = f"The principle of {target_topic} applies exclusively under opposite boundary conditions."
                distractor_2 = f"Recent research indicates {target_topic} is completely deprecated in modern practice."
                distractor_3 = f"This concept cannot be evaluated without external unverified assumptions."

                if len(candidate_facts) > 1:
                    alt_fact_1 = candidate_facts[(idx + 1) % len(candidate_facts)]["fact"]
                    if alt_fact_1 != fact_text:
                        distractor_1 = f"Incorrect attribution: {alt_fact_1[:120]} is confused with this concept."
                if len(candidate_facts) > 2:
                    alt_fact_2 = candidate_facts[(idx + 2) % len(candidate_facts)]["fact"]
                    if alt_fact_2 != fact_text and alt_fact_2 != distractor_1:
                        distractor_2 = f"Contradictory claim: {alt_fact_2[:120]} supersedes this behavior."

                generated_questions.append({
                    "question": f"According to verified study material on '{target_topic}', which statement is accurate?",
                    "options": [
                        fact_text,
                        distractor_1,
                        distractor_2,
                        distractor_3
                    ],
                    "answer": 0,
                    "explanation": f"Grounded in verified source text: '{fact_text[:180]}'.",
                    "topic": target_topic,
                    "difficulty": req.difficulty,
                    "page_number": selected["page_number"],
                    "section_heading": selected["section_heading"],
                    "source_chunk_id": selected["chunk_id"]
                })

        if not generated_questions:
            raise HTTPException(
                status_code=400,
                detail="Unable to generate grounded exam questions. Ensure source material is processed."
            )

        now = cls._now_utc()
        exam = Exam(
            user_id=user.id,
            session_id=session.id if session else None,
            title=req.title,
            description=req.description,
            exam_mode=req.exam_mode,
            difficulty=req.difficulty,
            duration_minutes=req.duration_minutes,
            passing_percentage=req.passing_percentage,
            total_questions=len(generated_questions),
            topics=req.topics or [target_topic],
            created_at=now,
            updated_at=now
        )
        db.add(exam)
        db.flush()

        for idx, q_data in enumerate(generated_questions):
            q = ExamQuestion(
                exam_id=exam.id,
                question_order=idx + 1,
                question_text=q_data["question"],
                question_type=q_data.get("question_type", "MCQ"),
                options=q_data.get("options", []),
                correct_answer=int(q_data.get("answer", 0)),
                explanation=q_data.get("explanation", "Based on verified source evidence."),
                topic=q_data.get("topic") or target_topic,
                section_heading=q_data.get("section_heading"),
                page_number=q_data.get("page_number"),
                source_chunk_id=q_data.get("source_chunk_id"),
                difficulty=q_data.get("difficulty", req.difficulty)
            )
            db.add(q)

        db.commit()
        db.refresh(exam)
        return cls.serialize_exam(exam)

    @classmethod
    def start_attempt(cls, db: Session, user: User, exam_id: int) -> ExamAttemptResponse:
        """Starts an exam attempt or resumes an existing in-progress attempt."""
        exam = cls.get_exam_or_404(db, user.id, exam_id)
        now = cls._now_utc()

        # Check for existing in-progress attempt
        existing = db.query(ExamAttempt).filter(
            ExamAttempt.exam_id == exam.id,
            ExamAttempt.user_id == user.id,
            ExamAttempt.status == "in_progress"
        ).first()

        if existing:
            # Check for expiration
            if existing.expires_at and now > existing.expires_at:
                cls.submit_attempt(db, user, existing.id)
                # Fall through to start a new attempt if desired, or return submitted
            else:
                return cls.serialize_active_attempt(existing)

        # Set up timing
        expires_at = None
        if exam.duration_minutes > 0 and exam.exam_mode in ["mock", "full_syllabus", "topic"]:
            expires_at = now + timedelta(minutes=exam.duration_minutes)

        attempt = ExamAttempt(
            exam_id=exam.id,
            user_id=user.id,
            status="in_progress",
            started_at=now,
            expires_at=expires_at,
            total_questions=exam.total_questions or len(exam.questions)
        )
        db.add(attempt)
        db.flush()

        # Initialize answer records
        for q in exam.questions:
            ans = ExamAnswer(
                attempt_id=attempt.id,
                question_id=q.id,
                user_answer=None,
                is_marked_for_review=False,
                is_correct=False,
                time_spent_seconds=0
            )
            db.add(ans)

        db.commit()
        db.refresh(attempt)
        return cls.serialize_active_attempt(attempt)

    @classmethod
    def save_answers(
        cls,
        db: Session,
        user: User,
        attempt_id: int,
        answers_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Saves user answers for an active attempt."""
        attempt = cls.get_attempt_or_404(db, user.id, attempt_id)
        now = cls._now_utc()

        if attempt.status != "in_progress":
            raise HTTPException(
                status_code=400,
                detail=f"Cannot save answers: attempt is currently in '{attempt.status}' state."
            )

        # Check if attempt has expired (15-second network grace period)
        if attempt.expires_at and now > (attempt.expires_at + timedelta(seconds=15)):
            cls.submit_attempt(db, user, attempt.id)
            raise HTTPException(
                status_code=400,
                detail="Exam time has expired. Your attempt has been automatically submitted."
            )

        saved_count = 0
        for item in answers_data:
            q_id = item.get("question_id")
            if not q_id:
                continue

            ans = db.query(ExamAnswer).filter(
                ExamAnswer.attempt_id == attempt.id,
                ExamAnswer.question_id == q_id
            ).first()

            if ans:
                if "user_answer" in item:
                    ans.user_answer = item["user_answer"]
                if "is_marked_for_review" in item:
                    ans.is_marked_for_review = bool(item["is_marked_for_review"])
                if "time_spent_seconds" in item:
                    ans.time_spent_seconds = max(0, int(item["time_spent_seconds"] or 0))
                ans.answered_at = now
                saved_count += 1

        db.commit()
        return {"status": "saved", "saved_count": saved_count}

    @classmethod
    def submit_attempt(
        cls,
        db: Session,
        user: User,
        attempt_id: int,
        answers_data: Optional[List[Dict[str, Any]]] = None
    ) -> ExamAttemptReviewResponse:
        """Idempotently submits, grades, and records learning events for an attempt."""
        attempt = cls.get_attempt_or_404(db, user.id, attempt_id)
        now = cls._now_utc()

        # Idempotency guard
        if attempt.status in ["submitted", "timed_out", "graded"]:
            return cls.get_attempt_review(db, user.id, attempt.id)

        # Apply final answers if provided
        if answers_data:
            for item in answers_data:
                q_id = item.get("question_id")
                if not q_id:
                    continue
                ans = db.query(ExamAnswer).filter(
                    ExamAnswer.attempt_id == attempt.id,
                    ExamAnswer.question_id == q_id
                ).first()
                if ans:
                    if "user_answer" in item:
                        ans.user_answer = item["user_answer"]
                    if "is_marked_for_review" in item:
                        ans.is_marked_for_review = bool(item["is_marked_for_review"])
                    if "time_spent_seconds" in item:
                        ans.time_spent_seconds = max(0, int(item["time_spent_seconds"] or 0))
                    ans.answered_at = now

        # Evaluate timing
        is_timeout = False
        if attempt.expires_at and now > (attempt.expires_at + timedelta(seconds=15)):
            is_timeout = True

        # Deterministic scoring
        correct_count = 0
        graded_questions = []

        for q in attempt.exam.questions:
            ans = next((a for a in attempt.answers if a.question_id == q.id), None)
            u_ans = ans.user_answer if ans else None
            is_corr = evaluate_answer(u_ans, q.correct_answer)

            if ans:
                ans.is_correct = is_corr

            if is_corr:
                correct_count += 1

            graded_questions.append({
                "topic": q.topic or "General",
                "is_correct": is_corr,
                "difficulty": q.difficulty or "intermediate",
                "section_heading": q.section_heading
            })

        total = attempt.total_questions or len(attempt.exam.questions) or 1
        pct = round((correct_count / total) * 100)
        passed = pct >= attempt.exam.passing_percentage

        topic_scores = calculate_topic_performance(graded_questions)

        time_taken = int((now - attempt.started_at).total_seconds())
        if attempt.expires_at and time_taken > (attempt.exam.duration_minutes * 60):
            time_taken = attempt.exam.duration_minutes * 60

        attempt.status = "timed_out" if is_timeout else "submitted"
        attempt.score = correct_count
        attempt.percentage = pct
        attempt.passed = passed
        attempt.time_taken_seconds = max(0, time_taken)
        attempt.completed_at = now
        attempt.topic_scores = topic_scores

        # Phase 3 Mastery Integration: record topic interactions
        for q in attempt.exam.questions:
            ans = next((a for a in attempt.answers if a.question_id == q.id), None)
            is_corr = ans.is_correct if ans else False
            LearnerEngine.record_topic_interaction(
                db=db,
                user_id=user.id,
                session_id=attempt.exam.session_id or 0,
                topic=q.topic or "General",
                is_correct=is_corr,
                difficulty=q.difficulty or "intermediate",
                subtopic=q.section_heading,
                idempotency_key=f"exam_{attempt.id}_q_{q.id}"
            )

        # Audit event
        db.add(LearningEvent(
            user_id=user.id,
            session_id=attempt.exam.session_id,
            event_type="EXAM_SUBMISSION",
            payload={
                "attempt_id": attempt.id,
                "exam_id": attempt.exam_id,
                "score": correct_count,
                "total": total,
                "percentage": pct,
                "passed": passed,
                "status": attempt.status,
                "exam_mode": attempt.exam.exam_mode
            }
        ))

        # Mistake Intelligence Integration: automatically record incorrect questions into Mistake Bank
        try:
            from mistake.service import MistakeService
            MistakeService.auto_record_exam_mistakes(db=db, user=user, attempt=attempt)
        except Exception as e:
            logger.warning(f"Could not auto-record exam mistakes: {e}")

        db.commit()
        db.refresh(attempt)
        return cls.get_attempt_review(db, user.id, attempt.id)

    @classmethod
    def get_attempt_review(cls, db: Session, user_id: int, attempt_id: int) -> ExamAttemptReviewResponse:
        """Generates comprehensive post-exam review with answers, explanations, and citations."""
        attempt = cls.get_attempt_or_404(db, user_id, attempt_id)

        if attempt.status == "in_progress":
            raise HTTPException(
                status_code=400,
                detail="Attempt is still in progress. Submit the exam to view results and review."
            )

        review_questions = []
        mistakes = []

        for q in sorted(attempt.exam.questions, key=lambda x: x.question_order):
            ans = next((a for a in attempt.answers if a.question_id == q.id), None)
            u_ans = ans.user_answer if ans else None
            is_corr = ans.is_correct if ans else False
            is_marked = ans.is_marked_for_review if ans else False

            q_rev = ExamQuestionReviewResponse(
                id=q.id,
                question_order=q.question_order,
                question_text=q.question_text,
                question_type=q.question_type,
                options=q.options or [],
                user_answer=u_ans,
                correct_answer=q.correct_answer,
                is_correct=is_corr,
                is_marked_for_review=is_marked,
                explanation=q.explanation,
                topic=q.topic or "General",
                section_heading=q.section_heading,
                page_number=q.page_number,
                source_chunk_id=q.source_chunk_id,
                difficulty=q.difficulty or "intermediate",
            )
            review_questions.append(q_rev)
            if not is_corr:
                mistakes.append(q_rev)

        recommendations = generate_recommended_actions(
            attempt.topic_scores or {},
            attempt.exam.passing_percentage
        )

        return ExamAttemptReviewResponse(
            id=attempt.id,
            exam_id=attempt.exam_id,
            exam_title=attempt.exam.title,
            exam_mode=attempt.exam.exam_mode,
            status=attempt.status,
            started_at=attempt.started_at.isoformat() if attempt.started_at else "",
            completed_at=attempt.completed_at.isoformat() if attempt.completed_at else None,
            score=attempt.score,
            total_questions=attempt.total_questions,
            percentage=attempt.percentage,
            passed=bool(attempt.passed),
            time_taken_seconds=attempt.time_taken_seconds,
            topic_scores=attempt.topic_scores or {},
            questions=review_questions,
            mistakes=mistakes,
            recommended_actions=recommendations,
        )

    @classmethod
    def list_user_exams(
        cls,
        db: Session,
        user_id: int,
        session_id: Optional[int] = None
    ) -> List[ExamResponse]:
        """Lists user exam blueprints."""
        query = db.query(Exam).filter(Exam.user_id == user_id)
        if session_id is not None:
            query = query.filter(Exam.session_id == session_id)
        exams = query.order_by(Exam.created_at.desc()).all()
        return [cls.serialize_exam(e) for e in exams]

    @classmethod
    def delete_exam(cls, db: Session, user_id: int, exam_id: int) -> Dict[str, Any]:
        """Deletes an exam and cascades to questions, attempts, and answers."""
        exam = cls.get_exam_or_404(db, user_id, exam_id)
        db.delete(exam)
        db.commit()
        return {"status": "deleted", "exam_id": exam_id}

    @classmethod
    def cancel_attempt(cls, db: Session, user_id: int, attempt_id: int) -> Dict[str, Any]:
        """Cancels and discards an in-progress or active exam attempt."""
        attempt = cls.get_attempt_or_404(db, user_id, attempt_id)
        db.delete(attempt)
        db.commit()
        return {"status": "cancelled", "attempt_id": attempt_id}

