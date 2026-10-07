"""Service layer for Adaptive Study Planner.

Orchestrates existing:
- Learner Topic Mastery
- Spaced Repetition (SM-2) Review Dates
- Quiz Results & Historical Scores
- Study Sessions & Document Chunks
- Visual Learning Artifacts
- Revision Notification & Reminder Infrastructure
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any, Tuple
import logging
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc
from fastapi import HTTPException

from database import (
    StudyPlan,
    StudyPlanTask,
    StudySession,
    LearnerTopicMastery,
    FlashcardProgress,
    QuizResult,
    VisualArtifact,
    User,
    Reminder,
)
from notifications import NotificationService, ReminderCreateRequest
from .models import (
    PlanCreateRequest,
    PlanUpdateRequest,
    TaskCreateRequest,
    TaskUpdateRequest,
    StudyPlanResponse,
    StudyPlanTaskResponse,
    PlanAdaptResponse,
)
from .prioritization import compute_planning_priority

logger = logging.getLogger(__name__)

DAY_ABBR = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


class StudyPlannerService:
    @staticmethod
    def _now_utc() -> datetime:
        return datetime.utcnow()

    @classmethod
    def get_plan_or_404(cls, db: Session, user_id: int, plan_id: int) -> StudyPlan:
        """Retrieves a study plan enforcing multi-tenant isolation."""
        plan = db.query(StudyPlan).filter(
            StudyPlan.id == plan_id,
            StudyPlan.user_id == user_id
        ).first()
        if not plan:
            raise HTTPException(status_code=404, detail="Study plan not found or unauthorized")
        return plan

    @classmethod
    def get_task_or_404(cls, db: Session, user_id: int, task_id: int) -> StudyPlanTask:
        """Retrieves a task enforcing multi-tenant isolation."""
        task = db.query(StudyPlanTask).filter(
            StudyPlanTask.id == task_id,
            StudyPlanTask.user_id == user_id
        ).first()
        if not task:
            raise HTTPException(status_code=404, detail="Study task not found or unauthorized")
        return task

    @classmethod
    def serialize_task(cls, task: StudyPlanTask) -> StudyPlanTaskResponse:
        session_title = task.session.ai_title or task.session.filename if task.session else None
        return StudyPlanTaskResponse(
            id=task.id,
            plan_id=task.plan_id,
            user_id=task.user_id,
            session_id=task.session_id,
            session_title=session_title,
            title=task.title,
            description=task.description,
            task_type=task.task_type,
            target_topic=task.target_topic,
            priority=task.priority,
            priority_score=round(task.priority_score or 50.0, 1),
            estimated_minutes=task.estimated_minutes,
            scheduled_date=task.scheduled_date.isoformat() if task.scheduled_date else "",
            status=task.status,
            is_user_created=task.is_user_created or False,
            recommendation_reason=task.recommendation_reason,
            reason_factors=task.reason_factors or {},
            completed_at=task.completed_at.isoformat() if task.completed_at else None,
            reminder_id=task.reminder_id,
            created_at=task.created_at.isoformat() if task.created_at else "",
            updated_at=task.updated_at.isoformat() if task.updated_at else "",
        )

    @classmethod
    def serialize_plan(cls, plan: StudyPlan) -> StudyPlanResponse:
        total = plan.total_tasks or 0
        done = plan.completed_tasks or 0
        progress = round((done / total * 100.0), 1) if total > 0 else 0.0

        tasks = [cls.serialize_task(t) for t in plan.tasks]
        return StudyPlanResponse(
            id=plan.id,
            user_id=plan.user_id,
            title=plan.title,
            description=plan.description,
            plan_mode=plan.plan_mode,
            status=plan.status,
            target_date=plan.target_date.isoformat() if plan.target_date else None,
            daily_available_minutes=plan.daily_available_minutes,
            preferred_days=plan.preferred_days or ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
            focus_session_ids=plan.focus_session_ids or [],
            focus_topics=plan.focus_topics or [],
            total_tasks=total,
            completed_tasks=done,
            progress_percent=progress,
            tasks=tasks,
            created_at=plan.created_at.isoformat() if plan.created_at else "",
            updated_at=plan.updated_at.isoformat() if plan.updated_at else "",
        )

    @classmethod
    def generate_plan(
        cls,
        db: Session,
        user_id: int,
        req: PlanCreateRequest
    ) -> StudyPlan:
        """Core orchestration generating an adaptive, explainable study plan from existing evidence."""
        now = cls._now_utc()

        # 1. Fetch eligible user sessions
        session_query = db.query(StudySession).filter(StudySession.user_id == user_id)
        if req.focus_session_ids:
            session_query = session_query.filter(StudySession.id.in_(req.focus_session_ids))
        sessions = session_query.all()

        if not sessions:
            # If no sessions exist yet, create a baseline welcoming plan
            plan = StudyPlan(
                user_id=user_id,
                title=req.title,
                description=req.description or "Personalized foundational study schedule.",
                plan_mode=req.plan_mode,
                status="active",
                target_date=req.target_date,
                daily_available_minutes=req.daily_available_minutes,
                preferred_days=req.preferred_days,
                focus_session_ids=[],
                focus_topics=req.focus_topics or [],
                total_tasks=1,
                completed_tasks=0,
                created_at=now,
                updated_at=now
            )
            db.add(plan)
            db.commit()
            db.refresh(plan)

            task = StudyPlanTask(
                plan_id=plan.id,
                user_id=user_id,
                session_id=None,
                title="Add your first study document or syllabus",
                description="Upload a PDF, link a YouTube lecture, or paste notes to activate AI-driven adaptive planning.",
                task_type="study_topic",
                target_topic="Onboarding",
                priority="high",
                priority_score=75.0,
                estimated_minutes=15,
                scheduled_date=now,
                status="pending",
                is_user_created=False,
                recommendation_reason="Initial workspace setup to build your personal knowledge base",
                reason_factors={"onboarding": True},
                created_at=now,
                updated_at=now
            )
            db.add(task)
            db.commit()
            db.refresh(plan)
            return plan

        # 2. Collect existing intelligence metrics across sessions
        # Learner Topic Mastery
        mastery_records = db.query(LearnerTopicMastery).filter(
            LearnerTopicMastery.user_id == user_id
        ).all()
        mastery_by_topic = {m.topic.lower(): m for m in mastery_records}

        # SM-2 Flashcard Due Dates
        flashcard_due_counts: Dict[int, int] = {}
        for s in sessions:
            due_c = db.query(FlashcardProgress).filter(
                FlashcardProgress.user_id == user_id,
                FlashcardProgress.session_id == s.id,
                FlashcardProgress.next_review <= now
            ).count()
            if due_c > 0:
                flashcard_due_counts[s.id] = due_c

        # Recent Quiz Results
        recent_quizzes = db.query(QuizResult).filter(
            QuizResult.user_id == user_id
        ).order_by(desc(QuizResult.date_taken)).limit(20).all()
        quiz_by_session: Dict[int, float] = {}
        for q in recent_quizzes:
            if q.session_id and q.session_id not in quiz_by_session:
                if q.total_questions and q.total_questions > 0:
                    quiz_by_session[q.session_id] = (q.score / q.total_questions) * 100.0

        # Visual Artifacts
        visual_by_session: Dict[int, int] = {}
        for s in sessions:
            v_count = db.query(VisualArtifact).filter(
                VisualArtifact.user_id == user_id,
                VisualArtifact.session_id == s.id
            ).count()
            if v_count > 0:
                visual_by_session[s.id] = v_count

        # 3. Calculate exam days if in exam mode
        days_to_exam = None
        if req.plan_mode == "exam" and req.target_date:
            td = req.target_date
            if td.tzinfo is not None:
                td = td.astimezone(timezone.utc).replace(tzinfo=None)
            days_to_exam = max(1, (td - now).days)

        # 4. Generate candidate prioritized tasks
        candidate_tasks = []
        user_focus_topics_lower = [t.lower() for t in (req.focus_topics or [])]

        for session in sessions:
            title = session.ai_title or session.filename
            due_cards = flashcard_due_counts.get(session.id, 0)
            recent_accuracy = quiz_by_session.get(session.id)
            has_visuals = visual_by_session.get(session.id, 0) > 0

            # Days since last study
            last_date = getattr(session, "upload_date", None) or getattr(session, "created_at", None) or now
            days_since = max(0, (now - last_date).days)

            # Check mastery on matching topic or session title
            matched_mastery = None
            for top_key, m_rec in mastery_by_topic.items():
                if top_key in title.lower() or title.lower() in top_key:
                    matched_mastery = m_rec
                    break

            m_score = matched_mastery.mastery_score if matched_mastery else None
            is_goal = any(t in title.lower() for t in user_focus_topics_lower)

            # Compute transparent priority
            score, level, reason, factors = compute_planning_priority(
                mastery_score=m_score,
                sm2_due_count=due_cards,
                recent_quiz_accuracy=recent_accuracy,
                days_to_exam=days_to_exam,
                days_since_last_studied=days_since,
                is_user_goal=is_goal
            )

            # A. Topic Study Task
            candidate_tasks.append({
                "session_id": session.id,
                "title": f"Deep Dive: {title}",
                "description": f"Focused study session covering core concepts and summary for {title}.",
                "task_type": "study_topic",
                "target_topic": title,
                "priority": level,
                "priority_score": score,
                "estimated_minutes": min(req.daily_available_minutes, 30),
                "recommendation_reason": reason,
                "reason_factors": factors,
            })

            # B. Spaced Repetition Flashcards (if cards due)
            if due_cards > 0:
                card_score = min(100.0, score + 10.0)
                candidate_tasks.append({
                    "session_id": session.id,
                    "title": f"Flashcard Revision: {title}",
                    "description": f"Review {due_cards} spaced repetition flashcard{'s' if due_cards != 1 else ''} scheduled by SM-2.",
                    "task_type": "review_flashcards",
                    "target_topic": title,
                    "priority": "critical" if card_score >= 80 else "high",
                    "priority_score": card_score,
                    "estimated_minutes": 15,
                    "recommendation_reason": f"Active recall is due for {due_cards} flashcard(s) under SM-2 schedule.",
                    "reason_factors": {**factors, "sm2_trigger": True, "due_count": due_cards},
                })

            # C. Practice Weak Area / Quiz (if accuracy was low or mastery < 0.6)
            if (recent_accuracy is not None and recent_accuracy < 65.0) or (m_score is not None and m_score < 0.6):
                weak_score = min(100.0, score + 5.0)
                candidate_tasks.append({
                    "session_id": session.id,
                    "title": f"Targeted Practice: {title}",
                    "description": "Reinforce knowledge through assessment and targeted question practice.",
                    "task_type": "practice_weak_area",
                    "target_topic": title,
                    "priority": "high",
                    "priority_score": weak_score,
                    "estimated_minutes": 20,
                    "recommendation_reason": f"Reinforce weaker concepts identified from recent quiz and topic mastery.",
                    "reason_factors": {**factors, "quiz_trigger": True},
                })

            # D. Visual Review (if session has concept maps)
            if has_visuals:
                candidate_tasks.append({
                    "session_id": session.id,
                    "title": f"Concept Map Review: {title}",
                    "description": "Inspect structural concept map and node relationships for mental model synthesis.",
                    "task_type": "visual_review",
                    "target_topic": title,
                    "priority": "medium",
                    "priority_score": max(30.0, score - 15.0),
                    "estimated_minutes": 15,
                    "recommendation_reason": "Visual concept mapping solidifies relational understanding across topics.",
                    "reason_factors": {**factors, "visual_trigger": True},
                })

        # 5. Sort all candidate tasks by priority score descending
        candidate_tasks.sort(key=lambda t: t["priority_score"], reverse=True)

        # 6. Distribute tasks across target timeline respecting daily_available_minutes
        # Determine schedule slots
        planning_days = 1
        if req.plan_mode == "daily":
            planning_days = 1
        elif req.plan_mode == "weekly":
            planning_days = 7
        elif req.plan_mode == "exam":
            planning_days = min(days_to_exam or 14, 60)
        elif req.plan_mode == "goal":
            planning_days = 14

        preferred = [d.lower() for d in (req.preferred_days or DAY_ABBR)]

        # Map dates
        schedule_slots: List[datetime] = []
        cur_day = now.date()
        days_checked = 0
        while len(schedule_slots) < planning_days and days_checked < 90:
            weekday_str = DAY_ABBR[cur_day.weekday()]
            if weekday_str in preferred:
                # Set target time (e.g. 09:00 UTC)
                slot_dt = datetime(cur_day.year, cur_day.month, cur_day.day, 9, 0, 0)
                schedule_slots.append(slot_dt)
            cur_day += timedelta(days=1)
            days_checked += 1

        if not schedule_slots:
            schedule_slots = [now]

        # Knapsack/Greedy allocation per day
        allocated_tasks: List[Tuple[datetime, Dict[str, Any]]] = []
        day_minutes: Dict[datetime, int] = {slot: 0 for slot in schedule_slots}

        # Cap max tasks generated to keep plans realistic and bounded
        max_total_tasks = min(len(candidate_tasks), len(schedule_slots) * 4, 40)
        selected_candidates = candidate_tasks[:max_total_tasks]

        for cand in selected_candidates:
            cand_dur = cand["estimated_minutes"]
            placed = False
            for slot in schedule_slots:
                if day_minutes[slot] + cand_dur <= req.daily_available_minutes:
                    allocated_tasks.append((slot, cand))
                    day_minutes[slot] += cand_dur
                    placed = True
                    break
            if not placed:
                # Find day with least load
                min_slot = min(schedule_slots, key=lambda s: day_minutes[s])
                allocated_tasks.append((min_slot, cand))
                day_minutes[min_slot] += cand_dur

        # 7. Persist StudyPlan
        plan = StudyPlan(
            user_id=user_id,
            title=req.title,
            description=req.description or f"Personalized {req.plan_mode.capitalize()} Study Schedule",
            plan_mode=req.plan_mode,
            status="active",
            target_date=req.target_date,
            daily_available_minutes=req.daily_available_minutes,
            preferred_days=req.preferred_days,
            focus_session_ids=req.focus_session_ids or [],
            focus_topics=req.focus_topics or [],
            total_tasks=len(allocated_tasks),
            completed_tasks=0,
            created_at=now,
            updated_at=now
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)

        # 8. Persist StudyPlanTasks and link notifications if requested
        for slot_dt, cand in allocated_tasks:
            task = StudyPlanTask(
                plan_id=plan.id,
                user_id=user_id,
                session_id=cand["session_id"],
                title=cand["title"],
                description=cand["description"],
                task_type=cand["task_type"],
                target_topic=cand["target_topic"],
                priority=cand["priority"],
                priority_score=cand["priority_score"],
                estimated_minutes=cand["estimated_minutes"],
                scheduled_date=slot_dt,
                status="pending",
                is_user_created=False,
                recommendation_reason=cand["recommendation_reason"],
                reason_factors=cand["reason_factors"],
                created_at=now,
                updated_at=now
            )
            db.add(task)
            db.commit()
            db.refresh(task)

            # Auto-schedule reminder if requested
            if req.auto_create_reminders:
                try:
                    rem_req = ReminderCreateRequest(
                        title=f"Study: {task.title}",
                        message=task.description or "Scheduled task from your Adaptive Study Plan",
                        scheduled_at=task.scheduled_date,
                        session_id=task.session_id,
                        target_type="session" if task.task_type == "study_topic" else (
                            "flashcard" if task.task_type == "review_flashcards" else (
                                "quiz" if task.task_type in ("take_quiz", "practice_weak_area") else "visual"
                            )
                        ),
                        target_reference=f"plan_task:{task.id}",
                        recurrence="once"
                    )
                    rem = NotificationService.create_manual_reminder(db, user_id, rem_req)
                    task.reminder_id = rem.id
                    db.commit()
                except Exception as ex:
                    logger.warning(f"Failed to auto-create reminder for task {task.id}: {ex}")

        db.refresh(plan)
        return plan

    @classmethod
    def list_plans(cls, db: Session, user_id: int, status: Optional[str] = None) -> List[StudyPlan]:
        """Lists user study plans enforcing multi-tenant isolation."""
        q = db.query(StudyPlan).filter(StudyPlan.user_id == user_id)
        if status:
            q = q.filter(StudyPlan.status == status)
        return q.order_by(desc(StudyPlan.created_at)).all()

    @classmethod
    def update_plan(
        cls,
        db: Session,
        user_id: int,
        plan_id: int,
        req: PlanUpdateRequest
    ) -> StudyPlan:
        """Updates plan settings."""
        plan = cls.get_plan_or_404(db, user_id, plan_id)
        now = cls._now_utc()

        if req.title is not None:
            plan.title = req.title
        if req.description is not None:
            plan.description = req.description
        if req.target_date is not None:
            plan.target_date = req.target_date
        if req.daily_available_minutes is not None:
            plan.daily_available_minutes = req.daily_available_minutes
        if req.preferred_days is not None:
            plan.preferred_days = req.preferred_days
        if req.status is not None:
            plan.status = req.status

        plan.updated_at = now
        db.commit()
        db.refresh(plan)
        return plan

    @classmethod
    def delete_plan(cls, db: Session, user_id: int, plan_id: int) -> bool:
        """Deletes a study plan and cascades to its tasks."""
        plan = cls.get_plan_or_404(db, user_id, plan_id)
        db.delete(plan)
        db.commit()
        return True

    @classmethod
    def add_manual_task(
        cls,
        db: Session,
        user_id: int,
        plan_id: int,
        req: TaskCreateRequest
    ) -> StudyPlanTask:
        """Allows learner to add a custom task to their plan."""
        plan = cls.get_plan_or_404(db, user_id, plan_id)
        now = cls._now_utc()

        # Validate session ownership if session_id provided
        if req.session_id:
            sess = db.query(StudySession).filter(
                StudySession.id == req.session_id,
                StudySession.user_id == user_id
            ).first()
            if not sess:
                raise HTTPException(status_code=404, detail="Study session not found or unauthorized")

        sched_dt = req.scheduled_date
        if sched_dt.tzinfo is not None:
            sched_dt = sched_dt.astimezone(timezone.utc).replace(tzinfo=None)

        task = StudyPlanTask(
            plan_id=plan.id,
            user_id=user_id,
            session_id=req.session_id,
            title=req.title,
            description=req.description,
            task_type=req.task_type,
            target_topic=req.target_topic,
            priority=req.priority,
            priority_score=60.0 if req.priority == "high" else (80.0 if req.priority == "critical" else 45.0),
            estimated_minutes=req.estimated_minutes,
            scheduled_date=sched_dt,
            status="pending",
            is_user_created=True,
            recommendation_reason="Created manually by learner",
            reason_factors={"user_created": True},
            created_at=now,
            updated_at=now
        )
        db.add(task)
        plan.total_tasks = (plan.total_tasks or 0) + 1
        plan.updated_at = now
        db.commit()
        db.refresh(task)

        if req.auto_create_reminder:
            try:
                rem_req = ReminderCreateRequest(
                    title=f"Study: {task.title}",
                    message=task.description or "Reminder for study task",
                    scheduled_at=task.scheduled_date,
                    session_id=task.session_id,
                    target_type="session" if task.task_type == "study_topic" else "flashcard",
                    target_reference=f"plan_task:{task.id}",
                    recurrence="once"
                )
                rem = NotificationService.create_manual_reminder(db, user_id, rem_req)
                task.reminder_id = rem.id
                db.commit()
                db.refresh(task)
            except Exception as e:
                logger.warning(f"Failed to create reminder for manual task: {e}")

        return task

    @classmethod
    def update_task(
        cls,
        db: Session,
        user_id: int,
        task_id: int,
        req: TaskUpdateRequest
    ) -> StudyPlanTask:
        """Updates task parameters (reschedule date, duration, priority)."""
        task = cls.get_task_or_404(db, user_id, task_id)
        now = cls._now_utc()

        if req.title is not None:
            task.title = req.title
        if req.description is not None:
            task.description = req.description
        if req.priority is not None:
            task.priority = req.priority
        if req.estimated_minutes is not None:
            task.estimated_minutes = req.estimated_minutes
        if req.scheduled_date is not None:
            dt = req.scheduled_date
            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
            task.scheduled_date = dt
            # If task was pending, status stays pending; if rescheduled, mark rescheduled
            if task.status == "pending":
                task.status = "rescheduled"

        task.updated_at = now
        db.commit()
        db.refresh(task)
        return task

    @classmethod
    def complete_task(cls, db: Session, user_id: int, task_id: int) -> StudyPlanTask:
        """Marks task completed and updates plan progress."""
        task = cls.get_task_or_404(db, user_id, task_id)
        now = cls._now_utc()

        if task.status != "completed":
            task.status = "completed"
            task.completed_at = now
            task.updated_at = now

            # Update parent plan count
            plan = task.plan
            done_count = db.query(StudyPlanTask).filter(
                StudyPlanTask.plan_id == plan.id,
                StudyPlanTask.status == "completed"
            ).count() + 1
            plan.completed_tasks = done_count

            if done_count >= (plan.total_tasks or 0):
                plan.status = "completed"
            plan.updated_at = now

            # If task has an associated reminder, resolve it
            if task.reminder_id:
                try:
                    NotificationService.complete_reminder(db, user_id, task.reminder_id)
                except Exception:
                    pass

            db.commit()
            db.refresh(task)
        return task

    @classmethod
    def skip_task(cls, db: Session, user_id: int, task_id: int) -> StudyPlanTask:
        """Marks task skipped and performs intelligent, bounded reschedule to avoid starvation."""
        task = cls.get_task_or_404(db, user_id, task_id)
        now = cls._now_utc()

        task.status = "skipped"
        task.updated_at = now

        # Intelligent reschedule: move to tomorrow or next slot, max 3 times
        factors = task.reason_factors or {}
        skip_count = factors.get("skip_count", 0) + 1
        factors["skip_count"] = skip_count
        task.reason_factors = factors

        if skip_count <= 3:
            # Reschedule to tomorrow
            next_date = (task.scheduled_date or now) + timedelta(days=1)
            task.scheduled_date = next_date
            task.status = "rescheduled"
            task.recommendation_reason = (task.recommendation_reason or "") + f" [Rescheduled after skip #{skip_count}]"

        db.commit()
        db.refresh(task)
        return task

    @classmethod
    def delete_task(cls, db: Session, user_id: int, task_id: int) -> bool:
        """Deletes a task and decrements plan task count."""
        task = cls.get_task_or_404(db, user_id, task_id)
        plan = task.plan

        if task.status == "completed":
            plan.completed_tasks = max(0, (plan.completed_tasks or 1) - 1)
        plan.total_tasks = max(0, (plan.total_tasks or 1) - 1)
        plan.updated_at = cls._now_utc()

        db.delete(task)
        db.commit()
        return True

    @classmethod
    def adapt_plan(cls, db: Session, user_id: int, plan_id: int) -> PlanAdaptResponse:
        """Re-evaluates learner performance signals and adjusts priority and schedules.

        Adapts:
        - If recent quiz performance on topic improved >= 85%: lowers priority of repeat tasks.
        - If SM-2 reviews became due on topic: elevates priority.
        - If tasks are overdue (< now) and pending: shifts them forward into upcoming slots.
        """
        plan = cls.get_plan_or_404(db, user_id, plan_id)
        now = cls._now_utc()

        # Query recent quizzes and topic mastery
        masteries = {
            m.topic.lower(): m for m in db.query(LearnerTopicMastery).filter(
                LearnerTopicMastery.user_id == user_id
            ).all()
        }

        # Check due flashcards per session
        card_dues = {}
        for sess_id in (plan.focus_session_ids or []):
            card_dues[sess_id] = db.query(FlashcardProgress).filter(
                FlashcardProgress.user_id == user_id,
                FlashcardProgress.session_id == sess_id,
                FlashcardProgress.next_review <= now
            ).count()

        pending_tasks = db.query(StudyPlanTask).filter(
            StudyPlanTask.plan_id == plan.id,
            StudyPlanTask.status.in_(["pending", "rescheduled"])
        ).all()

        rescheduled_count = 0
        reprioritized_count = 0

        for t in pending_tasks:
            # 1. Forward shift overdue tasks
            if t.scheduled_date and t.scheduled_date < now.replace(hour=0, minute=0, second=0):
                t.scheduled_date = now.replace(hour=9, minute=0, second=0)
                t.status = "rescheduled"
                rescheduled_count += 1

            # 2. Check topic mastery improvement
            top_name = (t.target_topic or "").lower()
            matched_m = masteries.get(top_name)
            if matched_m and matched_m.mastery_score >= 0.85:
                # Mastered: deprioritize
                if t.priority in ("critical", "high"):
                    t.priority = "medium"
                    t.priority_score = max(35.0, (t.priority_score or 60.0) - 25.0)
                    t.recommendation_reason = f"Priority adapted: topic mastery reached {int(matched_m.mastery_score * 100)}%."
                    reprioritized_count += 1
            elif matched_m and matched_m.mastery_score < 0.40:
                # Struggling: elevate priority
                if t.priority in ("low", "medium"):
                    t.priority = "high"
                    t.priority_score = min(95.0, (t.priority_score or 40.0) + 25.0)
                    t.recommendation_reason = f"Priority adapted: reinforcement needed (mastery {int(matched_m.mastery_score * 100)}%)."
                    reprioritized_count += 1

            t.updated_at = now

        plan.updated_at = now
        db.commit()
        db.refresh(plan)

        msg = f"Plan adapted: {rescheduled_count} overdue task(s) adjusted, {reprioritized_count} task(s) reprioritized based on latest mastery."
        return PlanAdaptResponse(
            plan_id=plan.id,
            tasks_rescheduled=rescheduled_count,
            tasks_reprioritized=reprioritized_count,
            message=msg,
            plan=cls.serialize_plan(plan)
        )
