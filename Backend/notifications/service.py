"""Service layer for Revision Notification & Reminder Infrastructure.

Handles:
- Synchronization of SM-2 spaced repetition dates into revision reminders.
- Manual reminder creation, editing, deletion with multi-tenant isolation.
- Separate notification schedule (snooze/dismiss) vs learning schedule (SM-2 intervals).
- Quiet hours evaluation and preference management.
- Recurrence handling for recurring reminders.
"""

from datetime import datetime, timedelta, time, timezone
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from fastapi import HTTPException

from database import Reminder, NotificationPreference, StudySession, FlashcardProgress, User
from .models import (
    ReminderCreateRequest,
    ReminderUpdateRequest,
    SnoozeRequest,
    NotificationPreferenceUpdate,
    NotificationPreferenceResponse,
    ReminderResponse,
    NotificationCenterResponse,
)


class NotificationService:
    @staticmethod
    def _now_utc() -> datetime:
        return datetime.utcnow()

    @staticmethod
    def is_in_quiet_hours(pref: NotificationPreference, now: Optional[datetime] = None) -> bool:
        """Determines whether the given or current UTC time falls within user quiet hours."""
        if not pref or not pref.quiet_hours_enabled:
            return False

        now_dt = now or NotificationService._now_utc()
        cur_time = now_dt.time()

        try:
            start_h, start_m = map(int, (pref.quiet_hours_start or "22:00").split(":"))
            end_h, end_m = map(int, (pref.quiet_hours_end or "08:00").split(":"))
            start_t = time(start_h, start_m)
            end_t = time(end_h, end_m)
        except Exception:
            return False

        if start_t <= end_t:
            return start_t <= cur_time < end_t
        else:
            # Crosses midnight (e.g. 22:00 -> 08:00)
            return cur_time >= start_t or cur_time < end_t

    @staticmethod
    def get_or_create_preference(db: Session, user_id: int) -> NotificationPreference:
        """Retrieves or initializes notification preferences for a user."""
        pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
        if not pref:
            pref = NotificationPreference(
                user_id=user_id,
                browser_notifications_enabled=True,
                sm2_auto_reminders=True,
                quiet_hours_enabled=False,
                quiet_hours_start="22:00",
                quiet_hours_end="08:00",
            )
            db.add(pref)
            db.commit()
            db.refresh(pref)
        return pref

    @staticmethod
    def update_preference(
        db: Session,
        user_id: int,
        updates: NotificationPreferenceUpdate
    ) -> NotificationPreference:
        """Updates user notification preferences."""
        pref = NotificationService.get_or_create_preference(db, user_id)

        if updates.browser_notifications_enabled is not None:
            pref.browser_notifications_enabled = updates.browser_notifications_enabled
        if updates.sm2_auto_reminders is not None:
            pref.sm2_auto_reminders = updates.sm2_auto_reminders
        if updates.quiet_hours_enabled is not None:
            pref.quiet_hours_enabled = updates.quiet_hours_enabled
        if updates.quiet_hours_start is not None:
            pref.quiet_hours_start = updates.quiet_hours_start
        if updates.quiet_hours_end is not None:
            pref.quiet_hours_end = updates.quiet_hours_end

        pref.updated_at = NotificationService._now_utc()
        db.commit()
        db.refresh(pref)
        return pref

    @classmethod
    def sync_sm2_revisions(cls, db: Session, user_id: int) -> List[Reminder]:
        """Synchronizes due SM-2 flashcard reviews for a user into revision reminders.

        Invariant: Never modifies SM-2 math, intervals, or FlashcardProgress history.
        Uses FlashcardProgress as single source of truth for review dates.
        """
        pref = cls.get_or_create_preference(db, user_id)
        if not pref.sm2_auto_reminders:
            return []

        now = cls._now_utc()
        sessions = db.query(StudySession).filter(StudySession.user_id == user_id).all()
        synced_reminders: List[Reminder] = []

        for session in sessions:
            cards = session.flashcards or []
            if not cards:
                continue

            # Query existing progress records
            progress_records = {
                p.card_index: p
                for p in db.query(FlashcardProgress).filter(
                    FlashcardProgress.user_id == user_id,
                    FlashcardProgress.session_id == session.id
                ).all()
            }

            due_indices = []
            for idx, _ in enumerate(cards):
                prog = progress_records.get(idx)
                if prog is None:
                    # Unreviewed cards are due
                    due_indices.append(idx)
                elif prog.next_review and prog.next_review <= now:
                    due_indices.append(idx)

            # Check if active sm2_revision reminder exists for this session
            active_reminder = db.query(Reminder).filter(
                Reminder.user_id == user_id,
                Reminder.session_id == session.id,
                Reminder.reminder_type == "sm2_revision",
                Reminder.status.in_(["pending", "due", "snoozed"])
            ).first()

            # Check if user recently completed or dismissed an sm2_revision for this session
            recent_resolved = db.query(Reminder).filter(
                Reminder.user_id == user_id,
                Reminder.session_id == session.id,
                Reminder.reminder_type == "sm2_revision",
                Reminder.status.in_(["completed", "dismissed"])
            ).order_by(Reminder.updated_at.desc()).first()

            if not active_reminder and recent_resolved:
                # If completed or dismissed within the last 20 hours, respect the user's action and do not respawn!
                time_since_resolved = (now - recent_resolved.updated_at).total_seconds()
                if time_since_resolved < 20 * 3600:
                    continue

            if due_indices:
                count = len(due_indices)
                title = f"Flashcard Revision: {session.ai_title or session.filename}"
                msg = f"You have {count} flashcard{'s' if count != 1 else ''} scheduled for spaced repetition review."

                if active_reminder:
                    active_reminder.title = title
                    active_reminder.message = msg
                    active_reminder.target_reference = f"due_count:{count}"
                    # If snoozed and snooze expired, transition to due
                    if active_reminder.status == "snoozed":
                        if not active_reminder.snoozed_until or active_reminder.snoozed_until <= now:
                            active_reminder.status = "due"
                    elif active_reminder.status == "pending":
                        active_reminder.status = "due"
                    active_reminder.updated_at = now
                    synced_reminders.append(active_reminder)
                else:
                    new_reminder = Reminder(
                        user_id=user_id,
                        session_id=session.id,
                        title=title,
                        message=msg,
                        reminder_type="sm2_revision",
                        target_type="flashcard",
                        target_reference=f"due_count:{count}",
                        scheduled_at=now,
                        status="due",
                        recurrence="once",
                        is_read=False,
                        created_at=now,
                        updated_at=now
                    )
                    db.add(new_reminder)
                    synced_reminders.append(new_reminder)
            else:
                # No due cards in this session. If active reminder was pending/due, auto-resolve it.
                if active_reminder and active_reminder.status in ("pending", "due"):
                    active_reminder.status = "completed"
                    active_reminder.completed_at = now
                    active_reminder.updated_at = now

        db.commit()
        return synced_reminders

    @classmethod
    def create_manual_reminder(
        cls,
        db: Session,
        user_id: int,
        req: ReminderCreateRequest
    ) -> Reminder:
        """Creates a manual study or revision reminder with ownership verification."""
        session_title = None
        if req.session_id is not None:
            session = db.query(StudySession).filter(
                StudySession.id == req.session_id,
                StudySession.user_id == user_id
            ).first()
            if not session:
                raise HTTPException(status_code=404, detail="Study session not found or access denied")
            session_title = session.ai_title or session.filename

        now = cls._now_utc()
        # Convert tz-aware datetime to naive UTC
        sched = req.scheduled_at
        if sched.tzinfo is not None:
            sched = sched.astimezone(timezone.utc).replace(tzinfo=None)

        status = "due" if sched <= now else "pending"

        reminder = Reminder(
            user_id=user_id,
            session_id=req.session_id,
            title=req.title,
            message=req.message,
            reminder_type="manual",
            target_type=req.target_type or "session",
            target_reference=req.target_reference,
            scheduled_at=sched,
            status=status,
            recurrence=req.recurrence or "once",
            is_read=False,
            created_at=now,
            updated_at=now
        )
        db.add(reminder)
        db.commit()
        db.refresh(reminder)
        return reminder

    @classmethod
    def snooze_reminder(
        cls,
        db: Session,
        user_id: int,
        reminder_id: int,
        req: SnoozeRequest
    ) -> Reminder:
        """Snoozes a reminder without modifying the underlying SM-2 spaced repetition dates."""
        reminder = db.query(Reminder).filter(
            Reminder.id == reminder_id,
            Reminder.user_id == user_id
        ).first()
        if not reminder:
            raise HTTPException(status_code=404, detail="Reminder not found")

        now = cls._now_utc()
        if req.minutes is not None:
            snooze_target = now + timedelta(minutes=req.minutes)
        elif req.until is not None:
            target = req.until
            if target.tzinfo is not None:
                target = target.astimezone(timezone.utc).replace(tzinfo=None)
            if target <= now:
                raise HTTPException(status_code=400, detail="Snooze target must be in the future")
            snooze_target = target
        else:
            raise HTTPException(status_code=400, detail="Must provide minutes or until")

        reminder.snoozed_until = snooze_target
        reminder.status = "snoozed"
        reminder.updated_at = now
        db.commit()
        db.refresh(reminder)
        return reminder

    @classmethod
    def complete_reminder(
        cls,
        db: Session,
        user_id: int,
        reminder_id: int
    ) -> Reminder:
        """Marks a reminder completed. If recurring, automatically spawns next occurrence."""
        reminder = db.query(Reminder).filter(
            Reminder.id == reminder_id,
            Reminder.user_id == user_id
        ).first()
        if not reminder:
            raise HTTPException(status_code=404, detail="Reminder not found")

        now = cls._now_utc()
        reminder.status = "completed"
        reminder.completed_at = now
        reminder.is_read = True
        reminder.updated_at = now

        # Recurrence handling
        if reminder.recurrence == "daily":
            next_sched = reminder.scheduled_at + timedelta(days=1)
            # If past now, schedule for tomorrow relative to now
            if next_sched <= now:
                next_sched = now + timedelta(days=1)
            next_reminder = Reminder(
                user_id=user_id,
                session_id=reminder.session_id,
                title=reminder.title,
                message=reminder.message,
                reminder_type=reminder.reminder_type,
                target_type=reminder.target_type,
                target_reference=reminder.target_reference,
                scheduled_at=next_sched,
                status="pending",
                recurrence=reminder.recurrence,
                is_read=False,
                created_at=now,
                updated_at=now
            )
            db.add(next_reminder)
        elif reminder.recurrence == "weekly":
            next_sched = reminder.scheduled_at + timedelta(weeks=1)
            if next_sched <= now:
                next_sched = now + timedelta(weeks=1)
            next_reminder = Reminder(
                user_id=user_id,
                session_id=reminder.session_id,
                title=reminder.title,
                message=reminder.message,
                reminder_type=reminder.reminder_type,
                target_type=reminder.target_type,
                target_reference=reminder.target_reference,
                scheduled_at=next_sched,
                status="pending",
                recurrence=reminder.recurrence,
                is_read=False,
                created_at=now,
                updated_at=now
            )
            db.add(next_reminder)

        db.commit()
        db.refresh(reminder)
        return reminder

    @classmethod
    def dismiss_reminder(
        cls,
        db: Session,
        user_id: int,
        reminder_id: int
    ) -> Reminder:
        """Dismisses an active reminder."""
        reminder = db.query(Reminder).filter(
            Reminder.id == reminder_id,
            Reminder.user_id == user_id
        ).first()
        if not reminder:
            raise HTTPException(status_code=404, detail="Reminder not found")

        now = cls._now_utc()
        reminder.status = "dismissed"
        reminder.is_read = True
        reminder.updated_at = now
        db.commit()
        db.refresh(reminder)
        return reminder

    @classmethod
    def delete_reminder(
        cls,
        db: Session,
        user_id: int,
        reminder_id: int
    ) -> bool:
        """Deletes a reminder permanently."""
        reminder = db.query(Reminder).filter(
            Reminder.id == reminder_id,
            Reminder.user_id == user_id
        ).first()
        if not reminder:
            raise HTTPException(status_code=404, detail="Reminder not found")

        db.delete(reminder)
        db.commit()
        return True

    @classmethod
    def mark_as_read(
        cls,
        db: Session,
        user_id: int,
        reminder_id: Optional[int] = None
    ) -> int:
        """Marks one or all reminders as read. For due alerts, transitions them to dismissed so they clear from Due Now into History."""
        now = cls._now_utc()
        if reminder_id is not None:
            reminder = db.query(Reminder).filter(
                Reminder.id == reminder_id,
                Reminder.user_id == user_id
            ).first()
            if not reminder:
                raise HTTPException(status_code=404, detail="Reminder not found")
            reminder.is_read = True
            if reminder.status == "due":
                reminder.status = "dismissed"
                reminder.updated_at = now
            db.commit()
            return 1
        else:
            # Dismiss all active due alerts so they clear from Due Now and move to history
            due_count = db.query(Reminder).filter(
                Reminder.user_id == user_id,
                Reminder.status == "due"
            ).update({
                "status": "dismissed",
                "is_read": True,
                "updated_at": now
            })
            other_count = db.query(Reminder).filter(
                Reminder.user_id == user_id,
                Reminder.is_read == False
            ).update({"is_read": True})
            db.commit()
            return due_count + other_count

    @classmethod
    def dismiss_all_due(cls, db: Session, user_id: int) -> int:
        """Dismisses all currently due reminders for a user and marks them read."""
        now = cls._now_utc()
        count = db.query(Reminder).filter(
            Reminder.user_id == user_id,
            Reminder.status == "due"
        ).update({
            "status": "dismissed",
            "is_read": True,
            "updated_at": now
        })
        db.commit()
        return count

    @classmethod
    def update_reminder(
        cls,
        db: Session,
        user_id: int,
        reminder_id: int,
        req: ReminderUpdateRequest
    ) -> Reminder:
        """Updates fields of an existing reminder."""
        reminder = db.query(Reminder).filter(
            Reminder.id == reminder_id,
            Reminder.user_id == user_id
        ).first()
        if not reminder:
            raise HTTPException(status_code=404, detail="Reminder not found")

        now = cls._now_utc()
        if req.title is not None:
            reminder.title = req.title
        if req.message is not None:
            reminder.message = req.message
        if req.scheduled_at is not None:
            sched = req.scheduled_at
            if sched.tzinfo is not None:
                sched = sched.astimezone(timezone.utc).replace(tzinfo=None)
            reminder.scheduled_at = sched
            if sched <= now and reminder.status == "pending":
                reminder.status = "due"
        if req.target_type is not None:
            reminder.target_type = req.target_type
        if req.target_reference is not None:
            reminder.target_reference = req.target_reference
        if req.recurrence is not None:
            reminder.recurrence = req.recurrence
        if req.is_read is not None:
            reminder.is_read = req.is_read

        reminder.updated_at = now
        db.commit()
        db.refresh(reminder)
        return reminder

    @classmethod
    def to_response(cls, r: Reminder) -> ReminderResponse:
        """Converts Reminder model to ReminderResponse schema."""
        now = cls._now_utc()
        is_due = (
            r.status == "due" or
            (r.status == "pending" and r.scheduled_at <= now) or
            (r.status == "snoozed" and (r.snoozed_until is None or r.snoozed_until <= now))
        )
        session_title = None
        if r.session:
            session_title = r.session.ai_title or r.session.filename

        return ReminderResponse(
            id=r.id,
            user_id=r.user_id,
            session_id=r.session_id,
            session_title=session_title,
            title=r.title,
            message=r.message,
            reminder_type=r.reminder_type,
            target_type=r.target_type,
            target_reference=r.target_reference,
            scheduled_at=r.scheduled_at,
            snoozed_until=r.snoozed_until,
            status=r.status,
            recurrence=r.recurrence,
            is_read=r.is_read,
            is_due=is_due,
            created_at=r.created_at,
            updated_at=r.updated_at,
            completed_at=r.completed_at
        )

    @classmethod
    def get_notification_center(
        cls,
        db: Session,
        user_id: int
    ) -> NotificationCenterResponse:
        """Retrieves structured notification center feed with counts and quiet hours status."""
        pref = cls.get_or_create_preference(db, user_id)
        now = cls._now_utc()

        # Sync SM-2 revisions if enabled
        if pref.sm2_auto_reminders:
            cls.sync_sm2_revisions(db, user_id)

        # Transition pending or snoozed whose time has arrived to due
        db.query(Reminder).filter(
            Reminder.user_id == user_id,
            Reminder.status == "pending",
            Reminder.scheduled_at <= now
        ).update({"status": "due", "updated_at": now})

        db.query(Reminder).filter(
            Reminder.user_id == user_id,
            Reminder.status == "snoozed",
            Reminder.snoozed_until <= now
        ).update({"status": "due", "updated_at": now})
        db.commit()

        # Query due reminders
        due_rows = db.query(Reminder).filter(
            Reminder.user_id == user_id,
            Reminder.status == "due"
        ).order_by(Reminder.scheduled_at.asc()).all()

        # Query upcoming reminders
        upcoming_rows = db.query(Reminder).filter(
            Reminder.user_id == user_id,
            or_(
                and_(Reminder.status == "pending", Reminder.scheduled_at > now),
                and_(Reminder.status == "snoozed", Reminder.snoozed_until > now)
            )
        ).order_by(Reminder.scheduled_at.asc()).limit(30).all()

        # Query recent history (completed / dismissed)
        history_rows = db.query(Reminder).filter(
            Reminder.user_id == user_id,
            Reminder.status.in_(["completed", "dismissed"])
        ).order_by(Reminder.updated_at.desc()).limit(20).all()

        # Unread count
        unread_count = db.query(Reminder).filter(
            Reminder.user_id == user_id,
            Reminder.is_read == False,
            Reminder.status.in_(["due", "pending", "snoozed"])
        ).count()

        due_count = len(due_rows)
        total_active = due_count + len(upcoming_rows)

        quiet_hours_active = cls.is_in_quiet_hours(pref, now)

        return NotificationCenterResponse(
            due_reminders=[cls.to_response(r) for r in due_rows],
            upcoming_reminders=[cls.to_response(r) for r in upcoming_rows],
            recent_history=[cls.to_response(r) for r in history_rows],
            counts={
                "unread": unread_count,
                "due": due_count,
                "total_active": total_active
            },
            quiet_hours_active=quiet_hours_active,
            preferences=NotificationPreferenceResponse(
                browser_notifications_enabled=pref.browser_notifications_enabled,
                sm2_auto_reminders=pref.sm2_auto_reminders,
                quiet_hours_enabled=pref.quiet_hours_enabled,
                quiet_hours_start=pref.quiet_hours_start,
                quiet_hours_end=pref.quiet_hours_end
            )
        )
