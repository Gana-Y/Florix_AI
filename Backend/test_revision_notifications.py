"""
Florix AI — Revision Notification & Reminder Infrastructure Test Suite
Validates:
- Automatic SM-2 spaced revision synchronization without mathematical duplication.
- Manual study reminder lifecycle: pending -> due -> snoozed -> completed / dismissed.
- Strict schedule separation: snoozing modifies reminder schedule only, never FlashcardProgress.
- Multi-tenant isolation and IDOR defense across all endpoints.
- Quiet hours overnight and daytime logic.
- Recurrence spawning (daily and weekly).
- Cascading deletion when study sessions are deleted.
"""

import pytest
from datetime import datetime, timedelta, time
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import sys
import os
sys.path.insert(0, os.path.abspath("Backend"))

from database import (
    Base, User, StudySession, FlashcardProgress,
    Reminder, NotificationPreference
)
from auth import get_password_hash, create_access_token
from main import app, get_db
from notifications import NotificationService
from notifications.models import (
    ReminderCreateRequest,
    ReminderUpdateRequest,
    SnoozeRequest,
    NotificationPreferenceUpdate,
)

# In-memory SQLite DB for fast isolated testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine_test = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine_test)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine_test)


@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(db):
    user = User(
        email="learner@florix.edu",
        hashed_password=get_password_hash("StrongSecret123!"),
        name="Alex Learner"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": user.email})
    return {"Authorization": f"Bearer {token}"}, user


@pytest.fixture
def attacker_headers(db):
    user = User(
        email="attacker@florix.edu",
        hashed_password=get_password_hash("StrongSecret123!"),
        name="Attacker"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": user.email})
    return {"Authorization": f"Bearer {token}"}, user


@pytest.fixture
def sample_session(db, auth_headers):
    _, user = auth_headers
    session = StudySession(
        filename="distributed_systems.pdf",
        ai_title="Distributed Consensus & Raft",
        summary="Deep dive into consensus algorithms and fault tolerance.",
        content="Consensus algorithms allow a collection of machines to work as a coherent group...",
        user_id=user.id,
        flashcards=[
            {"question": "What is the Raft quorum size?", "answer": "Majorities of nodes (N/2 + 1)"},
            {"question": "What is split brain?", "answer": "When network partition creates multiple leaders"}
        ]
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


# =============================================================================
# CATEGORY A: AUTOMATIC SM-2 REVISION SYNCHRONIZATION
# =============================================================================

class TestSM2RevisionSync:
    def test_sm2_sync_creates_reminder_for_due_cards(self, db, auth_headers, sample_session):
        _, user = auth_headers
        now = datetime.utcnow()
        # Card 0 due for review (next_review in the past)
        p1 = FlashcardProgress(
            user_id=user.id,
            session_id=sample_session.id,
            card_index=0,
            ease_factor=250,
            interval=1,
            repetitions=1,
            next_review=now - timedelta(hours=2)
        )
        db.add(p1)
        db.commit()

        # Trigger sync
        reminders = NotificationService.sync_sm2_revisions(db, user.id)
        assert len(reminders) >= 1

        reminder = reminders[0]
        assert reminder.user_id == user.id
        assert reminder.session_id == sample_session.id
        assert reminder.reminder_type == "sm2_revision"
        assert reminder.status == "due"
        assert reminder.target_type == "flashcard"

        # Verify SM-2 FlashcardProgress is untouched
        db.refresh(p1)
        assert p1.ease_factor == 250
        assert p1.interval == 1
        assert p1.repetitions == 1

    def test_sm2_sync_idempotency_does_not_create_duplicates(self, db, auth_headers, sample_session):
        _, user = auth_headers
        now = datetime.utcnow()
        p1 = FlashcardProgress(
            user_id=user.id,
            session_id=sample_session.id,
            card_index=0,
            ease_factor=250,
            interval=1,
            repetitions=1,
            next_review=now - timedelta(hours=1)
        )
        db.add(p1)
        db.commit()

        # Sync multiple times
        NotificationService.sync_sm2_revisions(db, user.id)
        NotificationService.sync_sm2_revisions(db, user.id)
        NotificationService.sync_sm2_revisions(db, user.id)

        # Must have exactly 1 active reminder for this session
        count = db.query(Reminder).filter(
            Reminder.user_id == user.id,
            Reminder.session_id == sample_session.id,
            Reminder.reminder_type == "sm2_revision",
            Reminder.status.in_(["pending", "due", "snoozed"])
        ).count()
        assert count == 1

    def test_sm2_sync_respects_active_snooze(self, db, auth_headers, sample_session):
        _, user = auth_headers
        now = datetime.utcnow()
        p1 = FlashcardProgress(
            user_id=user.id,
            session_id=sample_session.id,
            card_index=0,
            ease_factor=250,
            interval=1,
            repetitions=1,
            next_review=now - timedelta(hours=1)
        )
        db.add(p1)
        db.commit()

        # Sync first time
        NotificationService.sync_sm2_revisions(db, user.id)
        r = db.query(Reminder).filter(Reminder.user_id == user.id, Reminder.session_id == sample_session.id).first()
        assert r.status == "due"

        # User snoozes the reminder for 2 hours
        snooze_target = now + timedelta(hours=2)
        NotificationService.snooze_reminder(db, user.id, r.id, SnoozeRequest(minutes=120))
        db.refresh(r)
        assert r.status == "snoozed"

        # Subsequent sync MUST NOT revert status back to 'due' because snooze is active
        NotificationService.sync_sm2_revisions(db, user.id)
        db.refresh(r)
        assert r.status == "snoozed"

    def test_sm2_sync_auto_resolves_when_cards_reviewed(self, db, auth_headers, sample_session):
        _, user = auth_headers
        now = datetime.utcnow()
        # Create due card and sync
        p1 = FlashcardProgress(
            user_id=user.id,
            session_id=sample_session.id,
            card_index=0,
            ease_factor=250,
            interval=1,
            repetitions=1,
            next_review=now - timedelta(hours=1)
        )
        # Mark card 1 reviewed into the future as well
        p2 = FlashcardProgress(
            user_id=user.id,
            session_id=sample_session.id,
            card_index=1,
            ease_factor=250,
            interval=6,
            repetitions=2,
            next_review=now + timedelta(days=6)
        )
        db.add_all([p1, p2])
        db.commit()

        NotificationService.sync_sm2_revisions(db, user.id)
        r = db.query(Reminder).filter(Reminder.user_id == user.id, Reminder.session_id == sample_session.id).first()
        assert r.status == "due"

        # Now learner completes revision of card 0 (next_review pushed to future)
        p1.next_review = now + timedelta(days=3)
        db.commit()

        # Sync again
        NotificationService.sync_sm2_revisions(db, user.id)
        db.refresh(r)
        assert r.status == "completed"
        assert r.completed_at is not None

    def test_sm2_sync_disabled_via_preference(self, db, auth_headers, sample_session):
        _, user = auth_headers
        NotificationService.update_preference(db, user.id, NotificationPreferenceUpdate(sm2_auto_reminders=False))

        reminders = NotificationService.sync_sm2_revisions(db, user.id)
        assert reminders == []


# =============================================================================
# CATEGORY B: MANUAL REMINDERS CRUD & API ENDPOINTS
# =============================================================================

class TestManualRemindersCRUD:
    def test_create_manual_reminder_success(self, client, auth_headers):
        headers, user = auth_headers
        future_dt = (datetime.utcnow() + timedelta(days=2)).isoformat()
        payload = {
            "title": "Review Thermodynamics Chapter 4",
            "message": "Focus on Carnot cycles and entropy derivations.",
            "scheduled_at": future_dt,
            "target_type": "session",
            "recurrence": "once"
        }
        res = client.post("/reminders", json=payload, headers=headers)
        assert res.status_code == 201
        data = res.json()
        assert data["title"] == payload["title"]
        assert data["message"] == payload["message"]
        assert data["status"] == "pending"
        assert data["target_type"] == "session"
        assert data["reminder_type"] == "manual"
        assert data["is_read"] is False

    def test_create_manual_reminder_with_session(self, client, auth_headers, sample_session):
        headers, user = auth_headers
        future_dt = (datetime.utcnow() + timedelta(days=1)).isoformat()
        payload = {
            "title": "Quiz Review for Distributed Consensus",
            "scheduled_at": future_dt,
            "session_id": sample_session.id,
            "target_type": "quiz",
            "recurrence": "once"
        }
        res = client.post("/reminders", json=payload, headers=headers)
        assert res.status_code == 201
        data = res.json()
        assert data["session_id"] == sample_session.id
        assert data["session_title"] == "Distributed Consensus & Raft"

    def test_create_manual_reminder_invalid_session_returns_404(self, client, auth_headers):
        headers, _ = auth_headers
        payload = {
            "title": "Invalid session reminder",
            "scheduled_at": (datetime.utcnow() + timedelta(days=1)).isoformat(),
            "session_id": 999999
        }
        res = client.post("/reminders", json=payload, headers=headers)
        assert res.status_code == 404

    def test_list_and_filter_reminders(self, client, auth_headers):
        headers, user = auth_headers
        # Create two reminders
        client.post("/reminders", json={
            "title": "Flashcards Practice",
            "scheduled_at": (datetime.utcnow() + timedelta(days=1)).isoformat(),
            "target_type": "flashcard"
        }, headers=headers)
        client.post("/reminders", json={
            "title": "Concept Map Review",
            "scheduled_at": (datetime.utcnow() + timedelta(days=2)).isoformat(),
            "target_type": "visual"
        }, headers=headers)

        # List all
        res = client.get("/reminders", headers=headers)
        assert res.status_code == 200
        assert len(res.json()) >= 2

        # Filter by target_type
        res_fc = client.get("/reminders?target_type=flashcard", headers=headers)
        assert res_fc.status_code == 200
        for item in res_fc.json():
            assert item["target_type"] == "flashcard"

    def test_update_reminder(self, client, auth_headers):
        headers, _ = auth_headers
        create_res = client.post("/reminders", json={
            "title": "Initial Title",
            "scheduled_at": (datetime.utcnow() + timedelta(days=1)).isoformat()
        }, headers=headers)
        rem_id = create_res.json()["id"]

        update_res = client.patch(f"/reminders/{rem_id}", json={
            "title": "Updated Title",
            "message": "Added notes."
        }, headers=headers)
        assert update_res.status_code == 200
        assert update_res.json()["title"] == "Updated Title"
        assert update_res.json()["message"] == "Added notes."

    def test_delete_reminder(self, client, auth_headers):
        headers, _ = auth_headers
        create_res = client.post("/reminders", json={
            "title": "To be deleted",
            "scheduled_at": (datetime.utcnow() + timedelta(days=1)).isoformat()
        }, headers=headers)
        rem_id = create_res.json()["id"]

        del_res = client.delete(f"/reminders/{rem_id}", headers=headers)
        assert del_res.status_code == 200

        # Verify not found
        get_res = client.get(f"/reminders/{rem_id}", headers=headers)
        assert get_res.status_code == 404


# =============================================================================
# CATEGORY C: SNOOZE & SCHEDULE SEPARATION
# =============================================================================

class TestSnoozeAndScheduleSeparation:
    def test_snooze_minutes_sets_snoozed_until(self, client, auth_headers):
        headers, _ = auth_headers
        create_res = client.post("/reminders", json={
            "title": "Snooze test",
            "scheduled_at": datetime.utcnow().isoformat()
        }, headers=headers)
        rem_id = create_res.json()["id"]

        snooze_res = client.patch(f"/reminders/{rem_id}/snooze", json={"minutes": 30}, headers=headers)
        assert snooze_res.status_code == 200
        data = snooze_res.json()
        assert data["status"] == "snoozed"
        assert data["snoozed_until"] is not None

    def test_snooze_never_modifies_sm2_flashcard_progress(self, client, auth_headers, sample_session, db):
        headers, user = auth_headers
        now = datetime.utcnow()
        p = FlashcardProgress(
            user_id=user.id,
            session_id=sample_session.id,
            card_index=0,
            ease_factor=260,
            interval=3,
            repetitions=2,
            next_review=now - timedelta(hours=1)
        )
        db.add(p)
        db.commit()

        # Trigger sync to create sm2_revision reminder
        NotificationService.sync_sm2_revisions(db, user.id)
        rem = db.query(Reminder).filter(Reminder.session_id == sample_session.id).first()

        # Snooze the revision reminder for 60 minutes
        snooze_res = client.patch(f"/reminders/{rem.id}/snooze", json={"minutes": 60}, headers=headers)
        assert snooze_res.status_code == 200
        assert snooze_res.json()["status"] == "snoozed"

        # Verify FlashcardProgress is untouched: review schedule remains pure!
        db.refresh(p)
        assert p.ease_factor == 260
        assert p.interval == 3
        assert p.repetitions == 2
        assert p.next_review == now - timedelta(hours=1)

    def test_snooze_past_datetime_rejected(self, client, auth_headers):
        headers, _ = auth_headers
        create_res = client.post("/reminders", json={
            "title": "Past snooze test",
            "scheduled_at": datetime.utcnow().isoformat()
        }, headers=headers)
        rem_id = create_res.json()["id"]

        past_dt = (datetime.utcnow() - timedelta(minutes=10)).isoformat()
        snooze_res = client.patch(f"/reminders/{rem_id}/snooze", json={"until": past_dt}, headers=headers)
        assert snooze_res.status_code == 400


# =============================================================================
# CATEGORY D: COMPLETION & RECURRENCE ENGINE
# =============================================================================

class TestCompletionAndRecurrence:
    def test_complete_once_reminder(self, client, auth_headers):
        headers, _ = auth_headers
        create_res = client.post("/reminders", json={
            "title": "Single completion",
            "scheduled_at": datetime.utcnow().isoformat(),
            "recurrence": "once"
        }, headers=headers)
        rem_id = create_res.json()["id"]

        comp_res = client.patch(f"/reminders/{rem_id}/complete", headers=headers)
        assert comp_res.status_code == 200
        data = comp_res.json()
        assert data["status"] == "completed"
        assert data["completed_at"] is not None
        assert data["is_read"] is True

    def test_complete_daily_recurring_spawns_next_occurrence(self, client, auth_headers, db):
        headers, user = auth_headers
        now = datetime.utcnow()
        create_res = client.post("/reminders", json={
            "title": "Daily Morning Review",
            "scheduled_at": now.isoformat(),
            "recurrence": "daily"
        }, headers=headers)
        rem_id = create_res.json()["id"]

        comp_res = client.patch(f"/reminders/{rem_id}/complete", headers=headers)
        assert comp_res.status_code == 200

        # Check that a new pending reminder was spawned for tomorrow
        spawned = db.query(Reminder).filter(
            Reminder.user_id == user.id,
            Reminder.title == "Daily Morning Review",
            Reminder.status == "pending"
        ).first()
        assert spawned is not None
        assert spawned.recurrence == "daily"
        assert spawned.scheduled_at > now

    def test_dismiss_reminder(self, client, auth_headers):
        headers, _ = auth_headers
        create_res = client.post("/reminders", json={
            "title": "Dismiss test",
            "scheduled_at": datetime.utcnow().isoformat()
        }, headers=headers)
        rem_id = create_res.json()["id"]

        dis_res = client.patch(f"/reminders/{rem_id}/dismiss", headers=headers)
        assert dis_res.status_code == 200
        assert dis_res.json()["status"] == "dismissed"
        assert dis_res.json()["is_read"] is True


# =============================================================================
# CATEGORY E: MULTI-TENANT ISOLATION & IDOR DEFENSE
# =============================================================================

class TestMultiTenantAuthorizationAndIDOR:
    def test_user_b_cannot_read_user_a_reminder(self, client, auth_headers, attacker_headers):
        headers_a, _ = auth_headers
        headers_b, _ = attacker_headers

        create_res = client.post("/reminders", json={
            "title": "User A Private Study Plan",
            "scheduled_at": (datetime.utcnow() + timedelta(days=1)).isoformat()
        }, headers=headers_a)
        rem_id = create_res.json()["id"]

        # Attacker tries to read
        res = client.get(f"/reminders/{rem_id}", headers=headers_b)
        assert res.status_code == 404

    def test_user_b_cannot_update_user_a_reminder(self, client, auth_headers, attacker_headers):
        headers_a, _ = auth_headers
        headers_b, _ = attacker_headers

        create_res = client.post("/reminders", json={
            "title": "User A Reminder",
            "scheduled_at": (datetime.utcnow() + timedelta(days=1)).isoformat()
        }, headers=headers_a)
        rem_id = create_res.json()["id"]

        # Attacker tries to modify
        res = client.patch(f"/reminders/{rem_id}", json={"title": "Hacked Title"}, headers=headers_b)
        assert res.status_code == 404

    def test_user_b_cannot_snooze_user_a_reminder(self, client, auth_headers, attacker_headers):
        headers_a, _ = auth_headers
        headers_b, _ = attacker_headers

        create_res = client.post("/reminders", json={
            "title": "User A Reminder",
            "scheduled_at": datetime.utcnow().isoformat()
        }, headers=headers_a)
        rem_id = create_res.json()["id"]

        res = client.patch(f"/reminders/{rem_id}/snooze", json={"minutes": 30}, headers=headers_b)
        assert res.status_code == 404

    def test_user_b_cannot_delete_user_a_reminder(self, client, auth_headers, attacker_headers):
        headers_a, _ = auth_headers
        headers_b, _ = attacker_headers

        create_res = client.post("/reminders", json={
            "title": "User A Reminder",
            "scheduled_at": datetime.utcnow().isoformat()
        }, headers=headers_a)
        rem_id = create_res.json()["id"]

        res = client.delete(f"/reminders/{rem_id}", headers=headers_b)
        assert res.status_code == 404

    def test_user_b_cannot_create_reminder_for_user_a_session(self, client, auth_headers, attacker_headers, sample_session):
        headers_b, _ = attacker_headers
        # sample_session belongs to user A
        res = client.post("/reminders", json={
            "title": "Attacker linking to User A session",
            "scheduled_at": (datetime.utcnow() + timedelta(days=1)).isoformat(),
            "session_id": sample_session.id
        }, headers=headers_b)
        assert res.status_code == 404


# =============================================================================
# CATEGORY F: NOTIFICATION CENTER FEED & QUIET HOURS
# =============================================================================

class TestNotificationCenterFeedAndQuietHours:
    def test_notification_center_feed_structure(self, client, auth_headers):
        headers, _ = auth_headers
        # Create one due reminder and one upcoming reminder
        client.post("/reminders", json={
            "title": "Due Task",
            "scheduled_at": (datetime.utcnow() - timedelta(minutes=5)).isoformat()
        }, headers=headers)
        client.post("/reminders", json={
            "title": "Upcoming Task",
            "scheduled_at": (datetime.utcnow() + timedelta(days=2)).isoformat()
        }, headers=headers)

        res = client.get("/notifications", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "due_reminders" in data
        assert "upcoming_reminders" in data
        assert "recent_history" in data
        assert "counts" in data
        assert data["counts"]["due"] >= 1
        assert "preferences" in data

    def test_quiet_hours_overnight_span(self):
        pref = NotificationPreference(
            user_id=1,
            quiet_hours_enabled=True,
            quiet_hours_start="22:00",
            quiet_hours_end="08:00"
        )
        # 23:30 should be in quiet hours
        t1 = datetime(2026, 10, 1, 23, 30)
        assert NotificationService.is_in_quiet_hours(pref, t1) is True

        # 04:15 should be in quiet hours
        t2 = datetime(2026, 10, 1, 4, 15)
        assert NotificationService.is_in_quiet_hours(pref, t2) is True

        # 14:00 should NOT be in quiet hours
        t3 = datetime(2026, 10, 1, 14, 0)
        assert NotificationService.is_in_quiet_hours(pref, t3) is False

    def test_quiet_hours_daytime_span(self):
        pref = NotificationPreference(
            user_id=1,
            quiet_hours_enabled=True,
            quiet_hours_start="13:00",
            quiet_hours_end="15:00"
        )
        # 13:30 should be in quiet hours
        t1 = datetime(2026, 10, 1, 13, 30)
        assert NotificationService.is_in_quiet_hours(pref, t1) is True

        # 16:00 should NOT be in quiet hours
        t2 = datetime(2026, 10, 1, 16, 0)
        assert NotificationService.is_in_quiet_hours(pref, t2) is False

    def test_notification_settings_get_and_patch(self, client, auth_headers):
        headers, _ = auth_headers
        get_res = client.get("/user/notification-settings", headers=headers)
        assert get_res.status_code == 200
        assert get_res.json()["browser_notifications_enabled"] is True

        patch_res = client.patch("/user/notification-settings", json={
            "quiet_hours_enabled": True,
            "quiet_hours_start": "23:00",
            "quiet_hours_end": "07:00"
        }, headers=headers)
        assert patch_res.status_code == 200
        assert patch_res.json()["quiet_hours_enabled"] is True
        assert patch_res.json()["quiet_hours_start"] == "23:00"
        assert patch_res.json()["quiet_hours_end"] == "07:00"

    def test_mark_notifications_read(self, client, auth_headers):
        headers, _ = auth_headers
        c1 = client.post("/reminders", json={
            "title": "Unread 1",
            "scheduled_at": datetime.utcnow().isoformat()
        }, headers=headers).json()

        # Mark single read
        res_single = client.patch(f"/notifications/{c1['id']}/read", headers=headers)
        assert res_single.status_code == 200

        # Mark all read
        res_all = client.post("/notifications/read-all", headers=headers)
        assert res_all.status_code == 200


# =============================================================================
# CATEGORY G: CASCADING DELETION INTEGRITY
# =============================================================================

class TestCascadingDeletionIntegrity:
    def test_session_deletion_cascades_to_reminders(self, db, auth_headers, sample_session):
        _, user = auth_headers
        rem = Reminder(
            user_id=user.id,
            session_id=sample_session.id,
            title="Attached reminder",
            scheduled_at=datetime.utcnow(),
            status="pending"
        )
        db.add(rem)
        db.commit()
        rem_id = rem.id

        # Delete session
        db.delete(sample_session)
        db.commit()

        # Reminder must have been cascade-deleted
        found = db.query(Reminder).filter(Reminder.id == rem_id).first()
        assert found is None
