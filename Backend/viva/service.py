"""Service layer for Viva / Oral Examination Mode.

Orchestrates:
- Multi-tenant session lifecycle with strict IDOR/BOLA defense
- Authoritative server timer & auto-expiration enforcement
- Grounded question sequencing and adaptive follow-up branching
- Integration with Mistake Intelligence, Topic Mastery, Adaptive Planner, and Notifications
- Idempotent answer submissions preventing duplicate evaluations
"""

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
import logging
from sqlalchemy.orm import Session
from fastapi import HTTPException

from database import (
    VivaSession,
    VivaQuestion,
    VivaTurn,
    StudySession,
    DocumentChunk,
    User,
    LearningEvent,
    StudyPlan,
    StudyPlanTask,
    MistakeRecord
)
from intelligence import LearnerEngine
from mistake.service import MistakeService
from mistake.models import MistakeAnalyzeRequest
from planner.service import StudyPlannerService
from planner.models import TaskCreateRequest
from notifications.service import NotificationService
from notifications.models import ReminderCreateRequest

from .models import (
    VivaCreateRequest,
    VivaAnswerRequest,
    VivaQuestionResponse,
    VivaTurnResponse,
    VivaSessionResponse,
    VivaResultsResponse,
    VivaStatus,
)
from .evaluator import VivaEvaluator
from .orchestrator import VivaOrchestrator

logger = logging.getLogger("florix.viva.service")


class VivaService:
    """Core domain service for viva examinations."""

    @classmethod
    def _now_utc(cls) -> datetime:
        return datetime.utcnow()

    @classmethod
    def get_viva_or_404(cls, db: Session, user_id: int, viva_id: int) -> VivaSession:
        """Retrieves a viva session enforcing strict multi-tenant ownership."""
        viva = db.query(VivaSession).filter(
            VivaSession.id == viva_id,
            VivaSession.user_id == user_id
        ).first()
        if not viva:
            raise HTTPException(status_code=404, detail="Viva session not found or unauthorized")
        return viva

    @classmethod
    def create_viva(
        cls,
        db: Session,
        user: User,
        req: VivaCreateRequest,
        chunks: Optional[List[Any]] = None,
        gemini_client: Any = None,
        model_name: str = "gemini-3.6-flash",
        generate_fallback_fn: Any = None,
    ) -> VivaSessionResponse:
        """Initializes a new viva session with grounded primary questions."""
        study_session = None
        session_chunks = chunks or []

        if req.session_id:
            study_session = db.query(StudySession).filter(
                StudySession.id == req.session_id,
                StudySession.user_id == user.id
            ).first()
            if not study_session:
                raise HTTPException(status_code=404, detail="Study session not found or unauthorized")

            if not session_chunks:
                session_chunks = db.query(DocumentChunk).filter(
                    DocumentChunk.session_id == study_session.id
                ).order_by(DocumentChunk.chunk_index).all()

        effective_topic = req.topic or (study_session.filename if study_session else "General Academic Practice")
        effective_title = req.title or f"Oral Examination: {effective_topic}"

        viva = VivaSession(
            user_id=user.id,
            session_id=study_session.id if study_session else None,
            title=effective_title,
            viva_mode=req.viva_mode or "TOPIC_VIVA",
            teaching_mode=req.teaching_mode or "INTERMEDIATE",
            topic=effective_topic,
            difficulty=req.difficulty or "intermediate",
            status=VivaStatus.CREATED.value,
            total_questions=req.total_questions or 5,
            current_question_index=0,
            time_limit_minutes=req.time_limit_minutes,
            strong_areas=[],
            weak_areas=[],
        )
        db.add(viva)
        db.commit()
        db.refresh(viva)

        # Synthesize Grounded Questions
        generated_qs = VivaOrchestrator.generate_questions(
            topic=effective_topic,
            viva_mode=viva.viva_mode,
            teaching_mode=viva.teaching_mode,
            difficulty=viva.difficulty,
            num_questions=viva.total_questions,
            chunks=session_chunks,
            session=study_session,
            gemini_client=gemini_client,
            model_name=model_name,
            generate_fallback_fn=generate_fallback_fn
        )

        for idx, q_dict in enumerate(generated_qs):
            q_row = VivaQuestion(
                viva_session_id=viva.id,
                question_order=idx + 1,
                question_text=q_dict.get("question_text", "Explain the concept."),
                question_type=q_dict.get("question_type", "conceptual"),
                expected_concepts=q_dict.get("expected_concepts", [effective_topic]),
                topic=q_dict.get("topic", effective_topic),
                difficulty=q_dict.get("difficulty", viva.difficulty),
                source_chunk_id=q_dict.get("source_chunk_id"),
                page_number=q_dict.get("page_number"),
                citation_excerpt=q_dict.get("citation_excerpt"),
                is_follow_up=False,
                max_follow_ups=q_dict.get("max_follow_ups", 1),
            )
            db.add(q_row)

        db.commit()
        db.refresh(viva)
        return cls.serialize_session(viva)

    @classmethod
    def start_viva(cls, db: Session, user: User, viva_id: int) -> VivaSessionResponse:
        """Starts or resumes a viva session, establishing server-authoritative timers."""
        viva = cls.get_viva_or_404(db, user.id, viva_id)

        if viva.status in [VivaStatus.COMPLETED.value, VivaStatus.CANCELLED.value]:
            return cls.serialize_session(viva)

        now = cls._now_utc()
        if viva.status == VivaStatus.CREATED.value:
            viva.status = VivaStatus.IN_PROGRESS.value
            viva.started_at = now
            if viva.time_limit_minutes:
                viva.expires_at = now + timedelta(minutes=viva.time_limit_minutes)
        elif viva.status == VivaStatus.PAUSED.value:
            viva.status = VivaStatus.IN_PROGRESS.value
            if viva.expires_at and viva.updated_at:
                pause_duration = now - viva.updated_at
                if pause_duration.total_seconds() > 0:
                    viva.expires_at = viva.expires_at + pause_duration

        db.commit()
        db.refresh(viva)
        return cls.serialize_session(viva)

    @classmethod
    def submit_answer(
        cls,
        db: Session,
        user: User,
        viva_id: int,
        req: VivaAnswerRequest,
        gemini_client: Any = None,
        model_name: str = "gemini-3.6-flash",
        generate_fallback_fn: Any = None,
    ) -> Dict[str, Any]:
        """Evaluates an oral/typed response, manages state transitions and follow-ups."""
        viva = cls.get_viva_or_404(db, user.id, viva_id)

        # Check server timer expiration (15-second grace period for latency)
        now = cls._now_utc()
        if viva.expires_at and now > (viva.expires_at + timedelta(seconds=15)):
            viva.status = VivaStatus.TIME_EXPIRED.value
            db.commit()
            return cls.finalize_viva(db, user, viva)

        if viva.status not in [VivaStatus.IN_PROGRESS.value, VivaStatus.CREATED.value]:
            raise HTTPException(status_code=400, detail=f"Cannot submit answer when viva is in {viva.status} state")

        question = db.query(VivaQuestion).filter(
            VivaQuestion.id == req.question_id,
            VivaQuestion.viva_session_id == viva.id
        ).first()
        if not question:
            raise HTTPException(status_code=404, detail="Question not found in this viva session")

        # Idempotency check: if this question already has a recorded turn with identical answer
        existing_turn = db.query(VivaTurn).filter(
            VivaTurn.viva_session_id == viva.id,
            VivaTurn.question_id == question.id,
            VivaTurn.user_answer == req.user_answer
        ).first()
        if existing_turn:
            return {
                "turn": cls._serialize_turn(existing_turn),
                "session": cls.serialize_session(viva),
                "is_complete": viva.status == VivaStatus.COMPLETED.value
            }

        # Retrieve source context if available
        source_context = question.citation_excerpt or ""
        if question.source_chunk_id and viva.session_id:
            chunk = db.query(DocumentChunk).filter(
                DocumentChunk.session_id == viva.session_id,
                DocumentChunk.chunk_index == int(question.source_chunk_id) if question.source_chunk_id.isdigit() else False
            ).first()
            if chunk:
                source_context = chunk.text_content

        # Grounded Evaluation
        eval_result = VivaEvaluator.evaluate_answer(
            question_text=question.question_text,
            user_answer=req.user_answer,
            expected_concepts=question.expected_concepts or [],
            source_context=source_context,
            teaching_mode=viva.teaching_mode,
            gemini_client=gemini_client,
            model_name=model_name,
            generate_fallback_fn=generate_fallback_fn
        )

        turn = VivaTurn(
            viva_session_id=viva.id,
            question_id=question.id,
            user_answer=req.user_answer,
            input_mode=req.input_mode or "typed",
            correctness_score=eval_result["correctness_score"],
            completeness_score=eval_result["completeness_score"],
            reasoning_score=eval_result["reasoning_score"],
            clarity_score=eval_result["clarity_score"],
            overall_score=eval_result["overall_score"],
            is_grounded=eval_result["is_grounded"],
            evidence_found=eval_result["evidence_found"],
            misconceptions=eval_result["misconceptions"],
            missing_concepts=eval_result["missing_concepts"],
            strengths=eval_result["strengths"],
            improvement_feedback=eval_result["improvement_feedback"],
            follow_up_prompt=eval_result.get("follow_up_prompt"),
            needs_follow_up=eval_result.get("needs_follow_up", False),
            time_spent_seconds=req.time_spent_seconds or 0,
            answered_at=now
        )
        db.add(turn)
        db.commit()
        db.refresh(turn)

        # Mistake Intelligence Integration: Record error if score < 70 or misconception found
        if eval_result["overall_score"] < 70.0 or eval_result.get("misconceptions"):
            try:
                mistake_req = MistakeAnalyzeRequest(
                    question_text=question.question_text,
                    options=[],
                    user_answer=req.user_answer,
                    correct_answer=", ".join(question.expected_concepts or [question.topic]),
                    topic=question.topic,
                    difficulty=question.difficulty,
                    session_id=viva.session_id,
                    source_type="viva",
                    source_id=viva.id,
                    teaching_mode=viva.teaching_mode,
                    persist=True
                )
                MistakeService.analyze_and_record(
                    db=db,
                    user=user,
                    req=mistake_req,
                    gemini_client=gemini_client,
                    model_name=model_name,
                    generate_fallback_fn=generate_fallback_fn
                )
            except Exception as me:
                logger.warning(f"⚠️ Failed to log mistake record for viva: {me}")

        # Follow-up Question Branching
        can_follow_up = (
            turn.needs_follow_up and
            question.follow_up_count < question.max_follow_ups
        )

        follow_up_created = False
        if can_follow_up:
            fu_dict = VivaOrchestrator.generate_follow_up(
                parent_question=question,
                user_answer=req.user_answer,
                eval_result=eval_result,
                source_context=source_context,
                gemini_client=gemini_client,
                model_name=model_name
            )
            if fu_dict:
                fu_q = VivaQuestion(
                    viva_session_id=viva.id,
                    question_order=viva.current_question_index + 1,
                    question_text=fu_dict["question_text"],
                    question_type="follow_up",
                    expected_concepts=fu_dict.get("expected_concepts", []),
                    topic=fu_dict.get("topic", question.topic),
                    difficulty=fu_dict.get("difficulty", question.difficulty),
                    source_chunk_id=fu_dict.get("source_chunk_id"),
                    page_number=fu_dict.get("page_number"),
                    citation_excerpt=fu_dict.get("citation_excerpt"),
                    is_follow_up=True,
                    parent_question_id=question.id,
                    follow_up_count=question.follow_up_count + 1,
                    max_follow_ups=question.max_follow_ups,
                )
                question.follow_up_count += 1
                db.add(fu_q)
                db.commit()
                follow_up_created = True

        all_qs = db.query(VivaQuestion).filter(VivaQuestion.viva_session_id == viva.id).order_by(VivaQuestion.question_order).all()
        all_answered = all(len(q.turns) > 0 for q in all_qs)

        if all_answered and not follow_up_created:
            return cls.finalize_viva(db, user, viva)

        db.commit()
        db.refresh(viva)

        return {
            "turn": cls._serialize_turn(turn),
            "session": cls.serialize_session(viva),
            "is_complete": viva.status in [VivaStatus.COMPLETED.value, VivaStatus.TIME_EXPIRED.value]
        }

    @classmethod
    def pause_viva(cls, db: Session, user: User, viva_id: int) -> VivaSessionResponse:
        """Pauses an in-progress viva session."""
        viva = cls.get_viva_or_404(db, user.id, viva_id)
        if viva.status == VivaStatus.IN_PROGRESS.value:
            viva.status = VivaStatus.PAUSED.value
            viva.updated_at = cls._now_utc()
            db.commit()
            db.refresh(viva)
        return cls.serialize_session(viva)

    @classmethod
    def finalize_viva(cls, db: Session, user: User, viva: VivaSession) -> Dict[str, Any]:
        """Synthesizes results, updates topic mastery, and logs learning event."""
        turns = db.query(VivaTurn).filter(VivaTurn.viva_session_id == viva.id).all()
        synthesis = VivaOrchestrator.synthesize_results(viva, turns)

        if viva.status != VivaStatus.TIME_EXPIRED.value:
            viva.status = VivaStatus.COMPLETED.value
        viva.completed_at = cls._now_utc()
        viva.overall_score = synthesis["overall_score"]
        viva.overall_feedback = synthesis["overall_feedback"]
        viva.strong_areas = synthesis["strong_areas"]
        viva.weak_areas = synthesis["weak_areas"]

        # 1. Update Topic Mastery via LearnerEngine
        try:
            sess_id = viva.session_id
            if not sess_id:
                s_obj = db.query(StudySession).filter(StudySession.user_id == user.id).first()
                if not s_obj:
                    s_obj = StudySession(
                        user_id=user.id,
                        title=f"Viva Study - {viva.topic}",
                        subject=viva.topic,
                        status="active"
                    )
                    db.add(s_obj)
                    db.flush()
                sess_id = s_obj.id
                viva.session_id = sess_id

            LearnerEngine.record_topic_interaction(
                db=db,
                user_id=user.id,
                session_id=sess_id,
                topic=viva.topic,
                is_correct=(viva.overall_score >= 60.0),
                difficulty=viva.difficulty
            )
        except Exception as le:
            db.rollback()
            logger.warning(f"⚠️ Failed to update topic mastery from viva: {le}")

        # 2. Log LearningEvent
        try:
            event = LearningEvent(
                user_id=user.id,
                session_id=viva.session_id,
                event_type="VIVA_COMPLETION",
                payload={
                    "viva_id": viva.id,
                    "title": viva.title,
                    "topic": viva.topic,
                    "overall_score": viva.overall_score,
                    "passed": synthesis["passed"],
                    "turns_count": len(turns),
                }
            )
            db.add(event)
        except Exception as ee:
            logger.warning(f"⚠️ Failed to log viva learning event: {ee}")

        db.commit()
        db.refresh(viva)

        return {
            "session": cls.serialize_session(viva),
            "results": cls.get_results(db, user, viva.id),
            "is_complete": True
        }

    @classmethod
    def get_results(cls, db: Session, user: User, viva_id: int) -> VivaResultsResponse:
        """Retrieves full post-viva scorecard and synthesis."""
        viva = cls.get_viva_or_404(db, user.id, viva_id)
        turns = db.query(VivaTurn).filter(VivaTurn.viva_session_id == viva.id).all()
        qs = db.query(VivaQuestion).filter(VivaQuestion.viva_session_id == viva.id).all()

        synthesis = VivaOrchestrator.synthesize_results(viva, turns)

        # Associated mistake records
        mistakes = db.query(MistakeRecord).filter(
            MistakeRecord.user_id == user.id,
            MistakeRecord.source_type == "viva",
            MistakeRecord.source_id == viva.id
        ).all()

        return VivaResultsResponse(
            id=viva.id,
            title=viva.title,
            viva_mode=viva.viva_mode,
            teaching_mode=viva.teaching_mode,
            topic=viva.topic,
            status=viva.status,
            overall_score=viva.overall_score or synthesis["overall_score"],
            passed=synthesis["passed"],
            proficiency_level=synthesis["proficiency_level"],
            total_questions=len(qs),
            answered_questions=len(turns),
            overall_feedback=viva.overall_feedback or synthesis["overall_feedback"],
            strong_areas=viva.strong_areas or synthesis["strong_areas"],
            weak_areas=viva.weak_areas or synthesis["weak_areas"],
            turns=[cls._serialize_turn(t) for t in turns],
            mistake_ids=[m.id for m in mistakes]
        )

    @classmethod
    def schedule_planner_task(cls, db: Session, user: User, viva_id: int, target_date: Optional[str] = None) -> Dict[str, Any]:
        """Schedules targeted weak-area remediation task in Adaptive Study Planner."""
        viva = cls.get_viva_or_404(db, user.id, viva_id)

        # Find active plan or create default
        plan = db.query(StudyPlan).filter(
            StudyPlan.user_id == user.id,
            StudyPlan.status == "active"
        ).order_by(StudyPlan.created_at.desc()).first()

        if not plan:
            plan = StudyPlan(
                user_id=user.id,
                title=f"Adaptive Plan for {getattr(user, 'username', 'Learner')}",
                plan_mode="daily",
                status="active",
                daily_available_minutes=60
            )
            db.add(plan)
            db.flush()

        plan_id = plan.id
        sched_date = target_date or (cls._now_utc() + timedelta(days=1)).strftime("%Y-%m-%d")

        task_title = f"Oral Viva Weak-Area Practice: {viva.topic}"
        description = f"Reinforce oral explanations and technical depth for {viva.topic} following viva #{viva.id}."

        task = StudyPlanTask(
            user_id=user.id,
            plan_id=plan_id,
            session_id=viva.session_id,
            title=task_title,
            description=description,
            task_type="practice_weak_area",
            priority="high",
            estimated_minutes=25,
            scheduled_date=datetime.strptime(sched_date, "%Y-%m-%d") if isinstance(sched_date, str) else sched_date,
            status="pending"
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        return {
            "task_id": task.id,
            "plan_id": plan_id,
            "title": task.title,
            "scheduled_date": sched_date,
            "status": "scheduled"
        }

    @classmethod
    def schedule_reminder(cls, db: Session, user: User, viva_id: int, scheduled_at_iso: str, recurrence: str = "once") -> Dict[str, Any]:
        """Schedules a revision alert via NotificationCenter."""
        viva = cls.get_viva_or_404(db, user.id, viva_id)
        dt = datetime.fromisoformat(scheduled_at_iso.replace("Z", "+00:00"))

        req = ReminderCreateRequest(
            title=f"Viva Revision: {viva.title}",
            scheduled_at=dt,
            session_id=viva.session_id,
            recurrence=recurrence
        )
        res = NotificationService.create_manual_reminder(db=db, user_id=user.id, req=req)
        return {
            "reminder_id": res.id,
            "title": res.title,
            "scheduled_at": res.scheduled_at.isoformat() if res.scheduled_at else scheduled_at_iso,
            "status": "scheduled"
        }

    @classmethod
    def serialize_session(cls, v: VivaSession) -> VivaSessionResponse:
        now = cls._now_utc()
        qs = [cls._serialize_question(q) for q in (v.questions or [])]
        ts = [cls._serialize_turn(t) for t in (v.turns or [])]

        cur_q = None
        if v.current_question_index < len(qs):
            cur_q = qs[v.current_question_index]

        rem_seconds = None
        if v.expires_at and v.status == VivaStatus.IN_PROGRESS.value:
            rem_seconds = max(0, int((v.expires_at - now).total_seconds()))
        elif v.status == VivaStatus.PAUSED.value and v.expires_at and v.updated_at:
            rem_seconds = max(0, int((v.expires_at - v.updated_at).total_seconds()))
        elif v.time_limit_minutes and v.status in [VivaStatus.CREATED.value, VivaStatus.PAUSED.value]:
            rem_seconds = v.time_limit_minutes * 60

        expires_str = v.expires_at.strftime("%Y-%m-%dT%H:%M:%SZ") if v.expires_at else None
        started_str = v.started_at.strftime("%Y-%m-%dT%H:%M:%SZ") if v.started_at else None
        completed_str = v.completed_at.strftime("%Y-%m-%dT%H:%M:%SZ") if v.completed_at else None

        return VivaSessionResponse(
            id=v.id,
            session_id=v.session_id,
            title=v.title,
            viva_mode=v.viva_mode,
            teaching_mode=v.teaching_mode,
            topic=v.topic,
            difficulty=v.difficulty,
            status=v.status,
            total_questions=v.total_questions,
            current_question_index=v.current_question_index,
            time_limit_minutes=v.time_limit_minutes,
            remaining_seconds=rem_seconds,
            started_at=started_str,
            expires_at=expires_str,
            completed_at=completed_str,
            overall_score=v.overall_score,
            current_question=cur_q,
            questions=qs,
            turns=ts
        )

    @classmethod
    def _serialize_question(cls, q: VivaQuestion) -> VivaQuestionResponse:
        return VivaQuestionResponse(
            id=q.id,
            question_order=q.question_order,
            question_text=q.question_text,
            question_type=q.question_type,
            topic=q.topic,
            difficulty=q.difficulty,
            is_follow_up=q.is_follow_up,
            parent_question_id=q.parent_question_id,
            page_number=q.page_number,
            citation_excerpt=q.citation_excerpt,
            is_answered=bool(q.turns)
        )

    @classmethod
    def _serialize_turn(cls, t: VivaTurn) -> VivaTurnResponse:
        return VivaTurnResponse(
            id=t.id,
            question_id=t.question_id,
            user_answer=t.user_answer,
            input_mode=t.input_mode,
            correctness_score=t.correctness_score,
            completeness_score=t.completeness_score,
            reasoning_score=t.reasoning_score,
            clarity_score=t.clarity_score,
            overall_score=t.overall_score,
            is_grounded=t.is_grounded,
            evidence_found=t.evidence_found or [],
            misconceptions=t.misconceptions or [],
            missing_concepts=t.missing_concepts or [],
            strengths=t.strengths,
            improvement_feedback=t.improvement_feedback,
            follow_up_prompt=t.follow_up_prompt,
            needs_follow_up=t.needs_follow_up,
            time_spent_seconds=t.time_spent_seconds,
            answered_at=t.answered_at.isoformat() if t.answered_at else None
        )
