"""Service layer for Mistake Intelligence & Metacognitive Debugger.

Orchestrates:
- Metacognitive analysis & persistence in MistakeRecord
- Multi-tenant authorization & IDOR defense
- Targeted practice generation via existing AssessmentEngine
- Practice grading, topic mastery updates via LearnerEngine, and LearningEvent logging
- Seamless integration with Adaptive Study Planner & NotificationService
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
import logging
from sqlalchemy.orm import Session
from fastapi import HTTPException

from database import (
    MistakeRecord,
    StudySession,
    DocumentChunk,
    User,
    LearningEvent,
    StudyPlan,
    StudyPlanTask,
    QuizResult,
    ExamAttempt,
    ExamAnswer,
    ExamQuestion
)
from intelligence import AssessmentEngine, LearnerEngine
from planner.service import StudyPlannerService
from notifications.service import NotificationService
from notifications.models import ReminderCreateRequest

from .models import (
    MistakeAnalyzeRequest,
    MistakeAnalysisResponse,
    CitationItem,
    TargetedPracticeRequest,
    TargetedPracticeResponse,
    PracticeQuestionItem,
    PracticeSubmitRequest,
    PracticeResultResponse,
    PracticeGradedItem
)
from .analyzer import MistakeAnalyzer
from .taxonomy import MistakeCategory, PatternState, CATEGORY_METADATA

logger = logging.getLogger("florix.mistake.service")


class MistakeService:
    """Service layer managing mistake intelligence lifecycle."""

    @classmethod
    def _now_utc(cls) -> datetime:
        return datetime.utcnow()

    @classmethod
    def get_mistake_or_404(cls, db: Session, user_id: int, mistake_id: int) -> MistakeRecord:
        """Retrieves a mistake record enforcing strict tenant ownership."""
        mistake = db.query(MistakeRecord).filter(
            MistakeRecord.id == mistake_id,
            MistakeRecord.user_id == user_id
        ).first()
        if not mistake:
            raise HTTPException(status_code=404, detail="Mistake record not found or unauthorized")
        return mistake

    @classmethod
    def serialize_mistake(cls, m: MistakeRecord) -> MistakeAnalysisResponse:
        cat_meta = CATEGORY_METADATA.get(m.error_category, CATEGORY_METADATA["UNKNOWN"])
        citations_data = [
            CitationItem(
                chunk_index=c.get("chunk_index"),
                page_number=c.get("page_number"),
                section_heading=c.get("section_heading"),
                snippet=c.get("snippet")
            )
            for c in (m.citations or [])
            if isinstance(c, dict)
        ]

        return MistakeAnalysisResponse(
            id=m.id,
            session_id=m.session_id,
            question_text=m.question_text,
            user_answer=m.user_answer or "Unanswered",
            correct_answer=m.correct_answer,
            topic=m.topic,
            subtopic=m.subtopic,
            error_category=m.error_category,
            category_label=cat_meta["label"],
            misconception=m.misconception,
            why_incorrect=m.why_incorrect,
            correct_reasoning=m.correct_reasoning,
            prerequisite_concept=m.prerequisite_concept,
            pattern_state=m.pattern_state,
            is_resolved=bool(m.is_resolved),
            citations=citations_data,
            teaching_mode=m.teaching_mode or "INTERMEDIATE",
            recommended_remediation=cat_meta["remediation"],
            created_at=m.created_at.isoformat() if m.created_at else None
        )

    @classmethod
    def analyze_and_record(
        cls,
        db: Session,
        user: User,
        req: MistakeAnalyzeRequest,
        gemini_client: Any = None,
        model_name: str = "gemini-3.6-flash",
        generate_fallback_fn: Any = None,
        retriever_fn: Any = None
    ) -> MistakeAnalysisResponse:
        """Analyzes an incorrect response and persists the diagnostic record."""
        # Multi-tenant session check if session_id is provided
        if req.session_id:
            session = db.query(StudySession).filter(
                StudySession.id == req.session_id,
                StudySession.user_id == user.id
            ).first()
            if not session:
                raise HTTPException(status_code=404, detail="Study session not found or unauthorized")

        # Run analysis
        analysis = MistakeAnalyzer.analyze(
            db=db,
            user_id=user.id,
            question_text=req.question_text,
            user_answer_raw=req.user_answer,
            correct_answer_raw=req.correct_answer,
            options=req.options,
            topic=req.topic or "General",
            subtopic=req.subtopic or req.section_heading,
            difficulty=req.difficulty or "intermediate",
            session_id=req.session_id,
            section_heading=req.section_heading,
            page_number=req.page_number,
            teaching_mode=req.teaching_mode or "INTERMEDIATE",
            gemini_client=gemini_client,
            model_name=model_name,
            generate_fallback_fn=generate_fallback_fn,
            retriever_fn=retriever_fn
        )

        now = cls._now_utc()
        record_id = None

        if req.persist:
            from .analyzer import resolve_answer_text
            u_text = resolve_answer_text(req.user_answer, req.options)
            c_text = resolve_answer_text(req.correct_answer, req.options)

            record = MistakeRecord(
                user_id=user.id,
                session_id=req.session_id,
                source_type=req.source_type or "quiz",
                source_id=req.source_id,
                question_text=req.question_text,
                user_answer=u_text,
                correct_answer=c_text,
                options=req.options or [],
                topic=req.topic or "General",
                subtopic=req.subtopic or req.section_heading,
                difficulty=req.difficulty or "intermediate",
                teaching_mode=req.teaching_mode or "INTERMEDIATE",
                error_category=analysis["error_category"],
                misconception=analysis["misconception"],
                why_incorrect=analysis["why_incorrect"],
                correct_reasoning=analysis["correct_reasoning"],
                prerequisite_concept=analysis.get("prerequisite_concept"),
                citations=analysis.get("citations", []),
                pattern_state=analysis.get("pattern_state", "ISOLATED"),
                is_resolved=False,
                created_at=now,
                updated_at=now
            )
            db.add(record)
            db.commit()
            db.refresh(record)
            record_id = record.id

        citations_dto = [
            CitationItem(
                chunk_index=c.get("chunk_index"),
                page_number=c.get("page_number"),
                section_heading=c.get("section_heading"),
                snippet=c.get("snippet")
            )
            for c in analysis.get("citations", [])
        ]

        return MistakeAnalysisResponse(
            id=record_id,
            session_id=req.session_id,
            question_text=req.question_text,
            user_answer=str(req.user_answer),
            correct_answer=str(req.correct_answer),
            topic=req.topic or "General",
            subtopic=req.subtopic or req.section_heading,
            error_category=analysis["error_category"],
            category_label=analysis["category_label"],
            misconception=analysis["misconception"],
            why_incorrect=analysis["why_incorrect"],
            correct_reasoning=analysis["correct_reasoning"],
            prerequisite_concept=analysis.get("prerequisite_concept"),
            pattern_state=analysis["pattern_state"],
            is_resolved=False,
            citations=citations_dto,
            teaching_mode=req.teaching_mode or "INTERMEDIATE",
            recommended_remediation=analysis["recommended_remediation"],
            created_at=now.isoformat()
        )

    @classmethod
    def list_user_mistakes(
        cls,
        db: Session,
        user_id: int,
        session_id: Optional[int] = None,
        topic: Optional[str] = None,
        error_category: Optional[str] = None,
        is_resolved: Optional[bool] = None
    ) -> List[MistakeAnalysisResponse]:
        """Lists mistake records for the authenticated learner."""
        query = db.query(MistakeRecord).filter(MistakeRecord.user_id == user_id)

        if session_id is not None:
            query = query.filter(MistakeRecord.session_id == session_id)
        if topic:
            query = query.filter(MistakeRecord.topic == topic)
        if error_category:
            query = query.filter(MistakeRecord.error_category == error_category)
        if is_resolved is not None:
            query = query.filter(MistakeRecord.is_resolved == is_resolved)

        mistakes = query.order_by(MistakeRecord.created_at.desc()).all()
        return [cls.serialize_mistake(m) for m in mistakes]

    @classmethod
    def resolve_mistake(cls, db: Session, user_id: int, mistake_id: int) -> MistakeAnalysisResponse:
        """Marks a mistake as resolved and updates pattern state."""
        mistake = cls.get_mistake_or_404(db, user_id, mistake_id)
        now = cls._now_utc()
        mistake.is_resolved = True
        mistake.resolved_at = now
        mistake.pattern_state = PatternState.RESOLVED.value
        mistake.updated_at = now
        db.commit()
        db.refresh(mistake)
        return cls.serialize_mistake(mistake)

    @classmethod
    def delete_mistake(cls, db: Session, user_id: int, mistake_id: int) -> Dict[str, Any]:
        """Deletes a mistake record enforcing user isolation."""
        mistake = cls.get_mistake_or_404(db, user_id, mistake_id)
        db.delete(mistake)
        db.commit()
        return {"status": "deleted", "id": mistake_id}

    @classmethod
    def generate_targeted_practice(
        cls,
        db: Session,
        user_id: int,
        mistake_id: int,
        req: TargetedPracticeRequest,
        gemini_client: Any = None,
        model_name: str = "gemini-3.6-flash",
        generate_fallback_fn: Any = None
    ) -> TargetedPracticeResponse:
        """Generates targeted practice questions addressing the specific misconception using AssessmentEngine."""
        mistake = cls.get_mistake_or_404(db, user_id, mistake_id)
        session = db.query(StudySession).filter(StudySession.id == mistake.session_id).first() if mistake.session_id else None

        chunks_data = []
        if session:
            db_chunks = db.query(DocumentChunk).filter(DocumentChunk.session_id == session.id).all()
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

        generated = []
        if chunks_data:
            try:
                generated = AssessmentEngine.generate_quiz(
                    chunks=chunks_data,
                    num_questions=req.num_questions,
                    difficulty=req.difficulty or mistake.difficulty,
                    topic=mistake.topic,
                    gemini_client=gemini_client,
                    model_name=model_name,
                    generate_fallback_fn=generate_fallback_fn
                )
            except Exception as e:
                logger.warning(f"Targeted practice generation via AssessmentEngine failed: {e}")

        # Deterministic grounded fallback
        if not generated:
            import re
            candidate_facts = []
            if chunks_data:
                for c in chunks_data:
                    c_text = c.get("text_content", "")
                    sentences = [s.strip() for s in re.split(r'[.\n;]+', c_text) if len(s.strip()) >= 20]
                    for s in sentences:
                        candidate_facts.append(s)
            elif session and (session.content or session.summary):
                raw_text = f"{session.content or ''} {session.summary or ''}"
                sentences = [s.strip() for s in re.split(r'[.\n;]+', raw_text) if len(s.strip()) >= 20]
                for s in sentences:
                    candidate_facts.append(s)

            if not candidate_facts:
                candidate_facts.append(f"Grounded conceptual principle governing {mistake.topic}.")

            for idx in range(req.num_questions):
                target_s = candidate_facts[idx % len(candidate_facts)]
                generated.append({
                    "question": f"To address your misconception regarding {mistake.topic}, identify the accurate statement:",
                    "options": [
                        target_s,
                        f"A common error is confusing this with unrelated properties of {mistake.topic}.",
                        f"This principle is deprecated and holds no validity under standard conditions.",
                        f"None of the verified assertions apply to this concept."
                    ],
                    "answer": 0,
                    "explanation": f"Supported by verified source text: '{target_s[:150]}'.",
                    "topic": mistake.topic,
                    "difficulty": req.difficulty or mistake.difficulty
                })

        # Cache generated practice in database for stateful, secure grading
        mistake.options = generated
        db.commit()

        questions_dto = [
            PracticeQuestionItem(
                question_order=idx + 1,
                question_text=q["question"],
                options=q["options"],
                topic=q.get("topic") or mistake.topic,
                difficulty=q.get("difficulty") or mistake.difficulty
            )
            for idx, q in enumerate(generated)
        ]

        summary = (
            f"Review focus on '{mistake.topic}'. "
            f"Misconception targeted: {mistake.misconception or 'Conceptual gap'}. "
            f"{'Prerequisite: ' + mistake.prerequisite_concept if mistake.prerequisite_concept else ''}"
        )

        return TargetedPracticeResponse(
            mistake_id=mistake.id,
            topic=mistake.topic,
            prerequisite_concept=mistake.prerequisite_concept,
            review_summary=summary,
            questions=questions_dto
        )

    @classmethod
    def submit_targeted_practice(
        cls,
        db: Session,
        user_id: int,
        mistake_id: int,
        req: PracticeSubmitRequest
    ) -> PracticeResultResponse:
        """Deterministically grades targeted practice, updates LearnerTopicMastery, and advances pattern state."""
        mistake = cls.get_mistake_or_404(db, user_id, mistake_id)
        cached_questions = mistake.options or []

        if not cached_questions:
            raise HTTPException(status_code=400, detail="No active practice session found for this mistake. Generate practice first.")

        answers_map = {a.question_order: a.user_answer for a in req.answers}
        graded_list = []
        correct_count = 0

        for idx, q in enumerate(cached_questions):
            order = idx + 1
            u_ans = answers_map.get(order)
            c_ans = int(q.get("answer", 0))
            is_corr = (u_ans is not None and int(u_ans) == c_ans)
            if is_corr:
                correct_count += 1

            graded_list.append(PracticeGradedItem(
                question_order=order,
                question_text=q["question"],
                options=q["options"],
                user_answer=u_ans if u_ans is not None else -1,
                correct_answer=c_ans,
                is_correct=is_corr,
                explanation=q.get("explanation", "Grounded in verified study material.")
            ))

            # Phase 3 Mastery Integration: Update LearnerTopicMastery
            LearnerEngine.record_topic_interaction(
                db=db,
                user_id=user_id,
                session_id=mistake.session_id or 0,
                topic=mistake.topic,
                is_correct=is_corr,
                difficulty=mistake.difficulty,
                subtopic=mistake.subtopic,
                idempotency_key=f"mistake_prac_{mistake.id}_q_{order}_{cls._now_utc().strftime('%Y%m%d%H%M')}"
            )

        total = len(cached_questions)
        pct = round((correct_count / total) * 100) if total > 0 else 0
        passed = pct >= 70

        # Update mistake state
        now = cls._now_utc()
        if passed:
            mistake.pattern_state = PatternState.IMPROVING.value if pct < 100 else PatternState.RESOLVED.value
            mistake.is_resolved = True
            mistake.resolved_at = now
        else:
            mistake.pattern_state = PatternState.RECURRING.value

        mistake.updated_at = now

        # Log LearningEvent
        db.add(LearningEvent(
            user_id=user_id,
            session_id=mistake.session_id,
            event_type="MISTAKE_PRACTICE",
            payload={
                "mistake_id": mistake.id,
                "topic": mistake.topic,
                "score": correct_count,
                "total": total,
                "percentage": pct,
                "passed": passed,
                "pattern_state": mistake.pattern_state
            },
            timestamp=now
        ))

        db.commit()
        db.refresh(mistake)

        feedback = (
            f"Excellent recovery! You scored {pct}% on your targeted practice. Misconception resolved."
            if passed else
            f"You scored {pct}%. The concept still needs reinforcement. Consider scheduling a study plan task."
        )

        return PracticeResultResponse(
            mistake_id=mistake.id,
            score=correct_count,
            total_questions=total,
            percentage=pct,
            passed=passed,
            pattern_state=mistake.pattern_state,
            is_resolved=bool(mistake.is_resolved),
            feedback=feedback,
            graded_questions=graded_list
        )

    @classmethod
    def schedule_planner_task(
        cls,
        db: Session,
        user_id: int,
        mistake_id: int,
        plan_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Schedules targeted review for this mistake directly into the Adaptive Study Planner."""
        mistake = cls.get_mistake_or_404(db, user_id, mistake_id)

        # Find active plan or create one
        plan = None
        if plan_id:
            plan = db.query(StudyPlan).filter(StudyPlan.id == plan_id, StudyPlan.user_id == user_id).first()
        if not plan:
            plan = db.query(StudyPlan).filter(StudyPlan.user_id == user_id, StudyPlan.status == "active").order_by(StudyPlan.created_at.desc()).first()

        now = cls._now_utc()
        if not plan:
            plan = StudyPlan(
                user_id=user_id,
                title="Adaptive Mastery Plan",
                description="Auto-generated plan for targeted remediation of weak topics.",
                plan_mode="daily",
                status="active",
                daily_available_minutes=60,
                preferred_days=["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
                focus_session_ids=[mistake.session_id] if mistake.session_id else [],
                focus_topics=[mistake.topic],
                total_tasks=0,
                completed_tasks=0,
                created_at=now,
                updated_at=now
            )
            db.add(plan)
            db.flush()

        priority = "critical" if mistake.pattern_state in ["PERSISTENT", "RECURRING"] else "high"
        task = StudyPlanTask(
            plan_id=plan.id,
            user_id=user_id,
            session_id=mistake.session_id,
            title=f"Review Weak Area: {mistake.topic}",
            description=f"Targeted review for {mistake.error_category}. Misconception: {mistake.misconception or 'Conceptual gap'}.",
            task_type="practice_weak_area",
            target_topic=mistake.topic,
            priority=priority,
            priority_score=85.0 if priority == "critical" else 75.0,
            estimated_minutes=20,
            scheduled_date=now,
            status="pending",
            is_user_created=True,
            recommendation_reason=f"Remediate {mistake.pattern_state.lower()} error in {mistake.topic}",
            reason_factors={
                "mistake_id": mistake.id,
                "error_category": mistake.error_category,
                "pattern_state": mistake.pattern_state
            },
            created_at=now,
            updated_at=now
        )
        db.add(task)
        plan.total_tasks = (plan.total_tasks or 0) + 1
        db.commit()
        db.refresh(task)

        return {
            "status": "scheduled",
            "task_id": task.id,
            "plan_id": plan.id,
            "topic": mistake.topic,
            "priority": task.priority
        }

    @classmethod
    def schedule_notification_reminder(
        cls,
        db: Session,
        user_id: int,
        mistake_id: int,
        scheduled_at: datetime
    ) -> Dict[str, Any]:
        """Schedules a revision reminder for this mistake using NotificationService."""
        mistake = cls.get_mistake_or_404(db, user_id, mistake_id)

        rem_req = ReminderCreateRequest(
            title=f"Review Mistake: {mistake.topic}",
            message=f"Misconception alert: {mistake.misconception or 'Revisit core rules and practice'}.",
            scheduled_at=scheduled_at,
            session_id=mistake.session_id,
            target_type="topic",
            target_reference=f"mistake:{mistake.id}",
            recurrence="once"
        )
        rem = NotificationService.create_manual_reminder(db, user_id, rem_req)
        return {"status": "reminder_scheduled", "reminder_id": rem.id, "scheduled_at": scheduled_at.isoformat()}

    @classmethod
    def auto_record_quiz_mistakes(
        cls,
        db: Session,
        user: User,
        session: Any,
        quiz_details: List[Dict[str, Any]],
        quiz_id: Optional[int] = None
    ) -> int:
        """
        Automatically records mistakes from a completed quiz into the Mistake Intelligence Bank.
        Guarantees that learner errors are never lost and are available for metacognitive practice.
        """
        if not quiz_details:
            return 0

        recorded_count = 0
        now = cls._now_utc()
        session_id = getattr(session, "id", None)
        session_name = getattr(session, "filename", None) or getattr(session, "title", None) or "General"

        for d in quiz_details:
            is_correct = d.get("is_correct")
            if is_correct is None:
                sel = d.get("selected")
                ans = d.get("answer")
                u_ans = d.get("user_answer")
                c_ans = d.get("correct_answer")
                is_correct = (
                    (sel is not None and ans is not None and sel == ans) or
                    (u_ans is not None and c_ans is not None and u_ans == c_ans)
                )

            if is_correct:
                continue

            q_text = str(d.get("question") or d.get("question_text") or "").strip()
            if not q_text:
                continue

            # Idempotency / duplicate check for this user and question
            existing = db.query(MistakeRecord).filter(
                MistakeRecord.user_id == user.id,
                MistakeRecord.question_text == q_text,
                MistakeRecord.is_resolved == False
            ).first()

            if existing:
                if existing.pattern_state == PatternState.ISOLATED.value:
                    existing.pattern_state = PatternState.RECURRING.value
                elif existing.pattern_state == PatternState.RECURRING.value:
                    existing.pattern_state = PatternState.PERSISTENT.value
                existing.updated_at = now
                continue

            opts = d.get("options") or []
            u_ans_raw = d.get("user_answer") if d.get("user_answer") is not None else d.get("selected", "Unanswered")
            c_ans_raw = d.get("correct_answer") if d.get("correct_answer") is not None else d.get("answer", "")
            topic = d.get("topic") or session_name
            subtopic = d.get("section_heading") or d.get("subtopic")
            difficulty = d.get("difficulty") or "intermediate"

            # Fast grounded diagnostic analysis
            analysis = MistakeAnalyzer.analyze(
                db=db,
                user_id=user.id,
                question_text=q_text,
                user_answer_raw=u_ans_raw,
                correct_answer_raw=c_ans_raw,
                options=opts,
                topic=topic,
                subtopic=subtopic,
                difficulty=difficulty,
                session_id=session_id,
                generate_fallback_fn=None,
                gemini_client=None
            )

            provided_explanation = str(d.get("explanation") or "").strip()
            correct_reasoning = analysis["correct_reasoning"]
            if provided_explanation and len(provided_explanation) > 10:
                correct_reasoning = f"{provided_explanation} {correct_reasoning}".strip()

            from .analyzer import resolve_answer_text
            u_text = resolve_answer_text(u_ans_raw, opts)
            c_text = resolve_answer_text(c_ans_raw, opts)

            record = MistakeRecord(
                user_id=user.id,
                session_id=session_id,
                source_type="quiz",
                source_id=quiz_id,
                question_text=q_text,
                user_answer=u_text,
                correct_answer=c_text,
                options=opts,
                topic=topic,
                subtopic=subtopic,
                difficulty=difficulty,
                teaching_mode="INTERMEDIATE",
                error_category=analysis["error_category"],
                misconception=analysis["misconception"],
                why_incorrect=analysis["why_incorrect"],
                correct_reasoning=correct_reasoning,
                prerequisite_concept=analysis.get("prerequisite_concept"),
                citations=analysis.get("citations", []),
                pattern_state=analysis.get("pattern_state", "ISOLATED"),
                is_resolved=False,
                created_at=now,
                updated_at=now
            )
            db.add(record)
            recorded_count += 1

        if recorded_count > 0:
            db.commit()
            logger.info(f"Auto-recorded {recorded_count} mistakes from quiz into Mistake Bank for user {user.id}")

        return recorded_count

    @classmethod
    def auto_record_exam_mistakes(
        cls,
        db: Session,
        user: User,
        attempt: Any
    ) -> int:
        """
        Automatically records mistakes from a completed exam attempt into the Mistake Bank.
        """
        if not attempt or not getattr(attempt, "exam", None) or not getattr(attempt.exam, "questions", None):
            return 0

        recorded_count = 0
        now = cls._now_utc()

        for q in attempt.exam.questions:
            ans = next((a for a in attempt.answers if a.question_id == q.id), None)
            is_corr = ans.is_correct if ans else False

            if is_corr:
                continue

            q_text = (q.question_text or "").strip()
            if not q_text:
                continue

            existing = db.query(MistakeRecord).filter(
                MistakeRecord.user_id == user.id,
                MistakeRecord.question_text == q_text,
                MistakeRecord.is_resolved == False
            ).first()

            if existing:
                if existing.pattern_state == PatternState.ISOLATED.value:
                    existing.pattern_state = PatternState.RECURRING.value
                elif existing.pattern_state == PatternState.RECURRING.value:
                    existing.pattern_state = PatternState.PERSISTENT.value
                existing.updated_at = now
                continue

            from .analyzer import resolve_answer_text
            u_ans_raw = ans.user_answer if ans and ans.user_answer is not None else "Unanswered"
            u_text = resolve_answer_text(u_ans_raw, q.options)
            c_text = resolve_answer_text(q.correct_answer, q.options)

            analysis = MistakeAnalyzer.analyze(
                db=db,
                user_id=user.id,
                question_text=q_text,
                user_answer_raw=u_ans_raw,
                correct_answer_raw=q.correct_answer,
                options=q.options or [],
                topic=q.topic or "General",
                subtopic=q.section_heading,
                difficulty=q.difficulty or "intermediate",
                session_id=attempt.exam.session_id,
                generate_fallback_fn=None,
                gemini_client=None
            )

            correct_reasoning = analysis["correct_reasoning"]
            if getattr(q, "explanation", None) and len(str(q.explanation).strip()) > 10:
                correct_reasoning = f"{q.explanation} {correct_reasoning}".strip()

            record = MistakeRecord(
                user_id=user.id,
                session_id=attempt.exam.session_id,
                source_type="exam",
                source_id=attempt.id,
                question_text=q_text,
                user_answer=u_text,
                correct_answer=c_text,
                options=q.options or [],
                topic=q.topic or "General",
                subtopic=q.section_heading,
                difficulty=q.difficulty or "intermediate",
                teaching_mode="EXAM",
                error_category=analysis["error_category"],
                misconception=analysis["misconception"],
                why_incorrect=analysis["why_incorrect"],
                correct_reasoning=correct_reasoning,
                prerequisite_concept=analysis.get("prerequisite_concept"),
                citations=analysis.get("citations", []),
                pattern_state=analysis.get("pattern_state", "ISOLATED"),
                is_resolved=False,
                created_at=now,
                updated_at=now
            )
            db.add(record)
            recorded_count += 1

        if recorded_count > 0:
            db.commit()
            logger.info(f"Auto-recorded {recorded_count} mistakes from exam attempt {attempt.id} for user {user.id}")

        return recorded_count

    @classmethod
    def sync_past_mistakes(cls, db: Session, user: User) -> Dict[str, Any]:
        """
        Scans all historical QuizResults and ExamAttempts for this user,
        identifying any unlogged mistakes and synchronizing them into MistakeRecord.
        """
        total_synced = 0

        # 1. Sync from QuizResults
        past_quizzes = db.query(QuizResult).filter(QuizResult.user_id == user.id).all()
        for qr in past_quizzes:
            if not qr.details:
                continue
            session = db.query(StudySession).filter(StudySession.id == qr.session_id).first()
            if not session:
                class MockSession:
                    id = qr.session_id
                    filename = "General Study Session"
                session = MockSession()
            count = cls.auto_record_quiz_mistakes(
                db=db,
                user=user,
                session=session,
                quiz_details=qr.details,
                quiz_id=qr.id
            )
            total_synced += count

        # 2. Sync from ExamAttempts
        attempts = db.query(ExamAttempt).filter(
            ExamAttempt.user_id == user.id,
            ExamAttempt.status.in_(["submitted", "graded", "timed_out"])
        ).all()
        for att in attempts:
            count = cls.auto_record_exam_mistakes(db=db, user=user, attempt=att)
            total_synced += count

        return {
            "status": "success",
            "synced_count": total_synced,
            "message": f"Successfully synchronized {total_synced} mistake(s) from past assessments."
        }

    @classmethod
    def seed_sample_mistake(cls, db: Session, user: User) -> MistakeAnalysisResponse:
        """
        Seeds a realistic high-yield academic diagnostic mistake for demonstration and testing.
        Allows immediate interactive exploration of the Metacognitive Debugger workflow.
        """
        now = cls._now_utc()
        sample_q = "Which of the following conditions is required for deadlock prevention using the Banker's Algorithm?"
        opts = [
            "The system must maintain hold-and-wait while denying mutual exclusion.",
            "Each process must declare its maximum resource claims in advance, and state transitions must preserve a safe sequence.",
            "Processes are permitted to preemptively seize non-shareable resources when a cycle is detected.",
            "Deadlock prevention requires purely statistical time-slicing without prior resource claims."
        ]
        u_ans = opts[0]
        c_ans = opts[1]

        rec = db.query(MistakeRecord).filter(
            MistakeRecord.user_id == user.id,
            MistakeRecord.question_text == sample_q
        ).first()

        if not rec:
            rec = MistakeRecord(
                user_id=user.id,
                session_id=None,
                source_type="demo",
                source_id=None,
                question_text=sample_q,
                user_answer=u_ans,
                correct_answer=c_ans,
                options=opts,
                topic="Operating Systems (Deadlocks & Concurrency)",
                subtopic="Deadlock Avoidance & Banker's Algorithm",
                difficulty="intermediate",
                teaching_mode="INTERMEDIATE",
                error_category=MistakeCategory.CONCEPTUAL_MISUNDERSTANDING.value,
                misconception="Confusing Deadlock Prevention (breaking Coffman conditions) with Deadlock Avoidance (safe state algorithms like Banker's Algorithm).",
                why_incorrect="Selecting 'hold-and-wait while denying mutual exclusion' conflates Coffman prevention strategies with avoidance protocols. Furthermore, mutual exclusion cannot simply be denied for non-shareable hardware resources like printers or mutex locks.",
                correct_reasoning="Banker's Algorithm is a Deadlock Avoidance algorithm. It requires a priori knowledge of maximum resource claims for every process and dynamically allocates resources only if the resulting state remains in a 'safe state' with at least one viable execution sequence.",
                prerequisite_concept="Coffman's 4 Conditions for Deadlock",
                citations=[
                    {
                        "chunk_index": 1,
                        "page_number": 42,
                        "section_heading": "Dijkstra's Banker's Algorithm & Resource Allocation Graphs",
                        "snippet": "A state is safe if the system can allocate resources to each process in some order and still avoid a deadlock. The algorithm requires each process to declare maximum claims."
                    }
                ],
                pattern_state=PatternState.ISOLATED.value,
                is_resolved=False,
                created_at=now,
                updated_at=now
            )
            db.add(rec)
            db.commit()
            db.refresh(rec)

        return cls.serialize_mistake(rec)

