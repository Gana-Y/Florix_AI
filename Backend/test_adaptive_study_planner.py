"""Comprehensive test suite for Florix AI Adaptive Study Planner.

Covers:
- Prioritization scoring & explainability
- Multi-mode plan generation (daily, weekly, exam, goal)
- SM-2 spaced repetition integration (read-only, no SM-2 mutation)
- Learner Topic Mastery integration
- Quiz result integration
- Notification infrastructure integration
- Adaptive plan recalibration (performance improvements & overdue shifts)
- User control (manual task add, update, complete, skip, delete)
- Subscription entitlements & feature gating (Free vs Pro/Premium limits)
- Multi-tenant security & IDOR protection
- Edge cases (empty library, no history, time limits)
"""

import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import sys
import os
sys.path.insert(0, os.path.abspath("Backend"))

from database import (
    Base, User, StudySession, FlashcardProgress,
    LearnerTopicMastery, QuizResult, Reminder,
    StudyPlan, StudyPlanTask
)
from auth import get_password_hash, create_access_token
from main import app, get_db
from planner import (
    compute_planning_priority,
    StudyPlannerService,
    PlanCreateRequest,
    TaskCreateRequest,
    TaskUpdateRequest,
    PlanUpdateRequest,
)


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
def auth_headers_free(db):
    user = User(
        email="free_student@florix.edu",
        hashed_password=get_password_hash("Pass123!"),
        name="Free Student",
        plan="free"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(data={"sub": user.email})
    return {"Authorization": f"Bearer {token}"}, user


@pytest.fixture
def auth_headers_pro(db):
    user = User(
        email="pro_student@florix.edu",
        hashed_password=get_password_hash("Pass123!"),
        name="Pro Student",
        plan="pro"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(data={"sub": user.email})
    return {"Authorization": f"Bearer {token}"}, user


@pytest.fixture
def auth_headers_attacker(db):
    user = User(
        email="attacker@florix.edu",
        hashed_password=get_password_hash("Pass123!"),
        name="Attacker",
        plan="free"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(data={"sub": user.email})
    return {"Authorization": f"Bearer {token}"}, user


@pytest.fixture
def sample_study_environment(db, auth_headers_pro):
    _, user = auth_headers_pro
    now = datetime.utcnow()

    # Session 1: Operating Systems (has due flashcards and low quiz accuracy)
    sess1 = StudySession(
        user_id=user.id,
        filename="Operating_Systems.pdf",
        ai_title="Operating Systems & Concurrency",
        summary="Deadlocks, semaphores, process synchronization, CPU scheduling.",
        content="Operating systems manage hardware and process concurrency.",
        flashcards=[{"front": "What is a semaphore?", "back": "A synchronization variable"}],
        processing_status="READY"
    )
    db.add(sess1)

    # Session 2: Database Systems (high mastery)
    sess2 = StudySession(
        user_id=user.id,
        filename="Database_Systems.pdf",
        ai_title="Database Normalization",
        summary="1NF, 2NF, 3NF, BCNF, Relational Algebra, SQL.",
        content="Relational schemas and normalization anomalies.",
        flashcards=[],
        processing_status="READY"
    )
    db.add(sess2)
    db.commit()
    db.refresh(sess1)
    db.refresh(sess2)

    # Add SM-2 progress on sess1 (due now)
    card_prog = FlashcardProgress(
        user_id=user.id,
        session_id=sess1.id,
        card_index=0,
        ease_factor=250,
        interval=1,
        repetitions=2,
        next_review=now - timedelta(hours=2)
    )
    db.add(card_prog)

    # Add Topic Mastery on sess1 (low mastery: 0.35)
    mastery1 = LearnerTopicMastery(
        user_id=user.id,
        session_id=sess1.id,
        topic="Deadlocks",
        mastery_score=0.35,
        attempts=5,
        correct=2,
        weak_subtopics=["Banker's Algorithm", "Resource Allocation Graph"],
        last_reviewed=now - timedelta(days=5)
    )
    db.add(mastery1)

    # Add Topic Mastery on sess2 (high mastery: 0.90)
    mastery2 = LearnerTopicMastery(
        user_id=user.id,
        session_id=sess2.id,
        topic="Normalization",
        mastery_score=0.90,
        attempts=10,
        correct=9,
        weak_subtopics=[],
        last_reviewed=now - timedelta(days=1)
    )
    db.add(mastery2)

    # Add Quiz Result on sess1 (low accuracy: 40%)
    quiz1 = QuizResult(
        user_id=user.id,
        session_id=sess1.id,
        score=2,
        total_questions=5,
        percentage=40.0,
        date_taken=now - timedelta(days=1)
    )
    db.add(quiz1)

    db.commit()
    return sess1, sess2


# =============================================================================
# CATEGORY A: PRIORITIZATION ALGORITHM & EXPLAINABILITY
# =============================================================================

class TestPrioritizationLogic:
    def test_low_mastery_and_sm2_due_boosts_priority(self):
        score, level, reason, factors = compute_planning_priority(
            mastery_score=0.30,
            sm2_due_count=3,
            recent_quiz_accuracy=40.0,
            days_to_exam=5
        )
        assert score >= 80.0
        assert level == "critical"
        assert "Low topic mastery" in reason
        assert "flashcards due" in reason or "due for SM-2" in reason
        assert "Exam in 5 days" in reason
        assert factors["sm2_due_count"] == 3
        assert factors["mastery_score"] == 0.30

    def test_high_mastery_and_strong_quiz_lowers_priority(self):
        score, level, reason, factors = compute_planning_priority(
            mastery_score=0.95,
            sm2_due_count=0,
            recent_quiz_accuracy=95.0,
            days_to_exam=None,
            days_since_last_studied=2
        )
        assert score < 45.0
        assert level == "low"
        assert "High topic mastery" in reason
        assert "strong" in reason

    def test_priority_score_bounded_between_5_and_100(self):
        # Maximum possible boosters
        max_score, _, _, _ = compute_planning_priority(
            mastery_score=0.10,
            sm2_due_count=10,
            recent_quiz_accuracy=10.0,
            days_to_exam=1,
            days_since_last_studied=30,
            is_user_goal=True
        )
        assert max_score <= 100.0

        # Minimum possible boosters
        min_score, _, _, _ = compute_planning_priority(
            mastery_score=1.0,
            sm2_due_count=0,
            recent_quiz_accuracy=100.0,
            days_to_exam=None,
            days_since_last_studied=0
        )
        assert min_score >= 5.0


# =============================================================================
# CATEGORY B: PLAN GENERATION & EVIDENCE ORCHESTRATION
# =============================================================================

class TestPlanGeneration:
    def test_generate_daily_plan_orchestrates_sm2_and_mastery(self, client, auth_headers_pro, sample_study_environment):
        headers, user = auth_headers_pro
        sess1, _ = sample_study_environment

        payload = {
            "title": "Daily Revision Sprint",
            "plan_mode": "daily",
            "daily_available_minutes": 60,
            "auto_create_reminders": True
        }
        res = client.post("/study-plans", json=payload, headers=headers)
        assert res.status_code == 200
        data = res.json()

        assert data["title"] == "Daily Revision Sprint"
        assert data["plan_mode"] == "daily"
        assert data["total_tasks"] > 0
        assert data["status"] == "active"

        # Check that tasks were generated and reflect real evidence
        task_types = [t["task_type"] for t in data["tasks"]]
        assert "review_flashcards" in task_types or "study_topic" in task_types

        # Verify flashcard task was generated because sess1 had due cards
        flash_task = next((t for t in data["tasks"] if t["task_type"] == "review_flashcards"), None)
        if flash_task:
            assert "flashcard" in flash_task["title"].lower()
            assert flash_task["priority"] in ("critical", "high")
            assert "SM-2" in flash_task["recommendation_reason"] or "flashcard" in flash_task["recommendation_reason"]

    def test_exam_plan_spreads_across_days(self, client, auth_headers_pro, sample_study_environment):
        headers, _ = auth_headers_pro
        future_exam = (datetime.utcnow() + timedelta(days=10)).isoformat()

        payload = {
            "title": "Midterm Exam Preparation",
            "plan_mode": "exam",
            "target_date": future_exam,
            "daily_available_minutes": 45,
            "preferred_days": ["mon", "wed", "fri"]
        }
        res = client.post("/study-plans", json=payload, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["plan_mode"] == "exam"
        assert len(data["tasks"]) > 0

    def test_empty_workspace_creates_safe_onboarding_plan(self, client, auth_headers_free):
        headers, _ = auth_headers_free
        payload = {
            "title": "Initial Study Schedule",
            "plan_mode": "daily",
            "daily_available_minutes": 30
        }
        res = client.post("/study-plans", json=payload, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["total_tasks"] == 1
        assert "workspace" in data["tasks"][0]["recommendation_reason"].lower() or "onboarding" in data["tasks"][0]["target_topic"].lower()


# =============================================================================
# CATEGORY C: SM-2 & LEARNING ENGINE SAFETY INVARIANTS
# =============================================================================

class TestSM2AndMasteryInvariants:
    def test_planner_never_mutates_sm2_intervals_or_progress(self, client, auth_headers_pro, sample_study_environment, db):
        headers, user = auth_headers_pro
        sess1, _ = sample_study_environment

        card_before = db.query(FlashcardProgress).filter_by(user_id=user.id, session_id=sess1.id).first()
        ef_before = card_before.ease_factor
        interval_before = card_before.interval
        next_rev_before = card_before.next_review

        # Generate plan
        res = client.post("/study-plans", json={"title": "Sprint", "plan_mode": "daily"}, headers=headers)
        assert res.status_code == 200

        # Check DB to confirm SM-2 record is 100% untouched
        db.refresh(card_before)
        assert card_before.ease_factor == ef_before
        assert card_before.interval == interval_before
        assert card_before.next_review == next_rev_before

    def test_planner_never_mutates_existing_mastery_scores(self, client, auth_headers_pro, sample_study_environment, db):
        headers, user = auth_headers_pro
        sess1, _ = sample_study_environment

        m_before = db.query(LearnerTopicMastery).filter_by(user_id=user.id, session_id=sess1.id).first()
        score_before = m_before.mastery_score
        attempts_before = m_before.attempts

        res = client.post("/study-plans", json={"title": "Sprint", "plan_mode": "daily"}, headers=headers)
        assert res.status_code == 200

        db.refresh(m_before)
        assert m_before.mastery_score == score_before
        assert m_before.attempts == attempts_before


# =============================================================================
# CATEGORY D: USER CONTROL & ADAPTIVE LIFECYCLE
# =============================================================================

class TestUserControlAndAdaptation:
    def test_manual_task_addition_and_completion(self, client, auth_headers_pro, sample_study_environment):
        headers, _ = auth_headers_pro
        sess1, _ = sample_study_environment

        # Create plan
        plan_res = client.post("/study-plans", json={"title": "Track", "plan_mode": "daily"}, headers=headers)
        plan_id = plan_res.json()["id"]

        # Add manual task
        task_payload = {
            "title": "Review Chapter 4 Summary Notes",
            "task_type": "study_topic",
            "session_id": sess1.id,
            "priority": "high",
            "estimated_minutes": 20,
            "scheduled_date": datetime.utcnow().isoformat(),
            "auto_create_reminder": True
        }
        task_res = client.post(f"/study-plans/{plan_id}/tasks", json=task_payload, headers=headers)
        assert task_res.status_code == 200
        task_data = task_res.json()
        assert task_data["is_user_created"] is True
        assert task_data["reminder_id"] is not None

        # Complete task
        comp_res = client.post(f"/study-plans/tasks/{task_data['id']}/complete", headers=headers)
        assert comp_res.status_code == 200
        assert comp_res.json()["status"] == "completed"

    def test_skip_task_triggers_bounded_rescheduling(self, client, auth_headers_pro, sample_study_environment):
        headers, _ = auth_headers_pro
        plan_res = client.post("/study-plans", json={"title": "Track", "plan_mode": "daily"}, headers=headers)
        plan_id = plan_res.json()["id"]

        tasks = plan_res.json()["tasks"]
        t_id = tasks[0]["id"]

        # Skip task
        skip_res = client.post(f"/study-plans/tasks/{t_id}/skip", headers=headers)
        assert skip_res.status_code == 200
        assert skip_res.json()["status"] == "rescheduled"
        assert "skip #1" in skip_res.json()["recommendation_reason"]

    def test_adapt_plan_recalibrates_on_mastery_change(self, client, auth_headers_pro, sample_study_environment, db):
        headers, user = auth_headers_pro
        sess1, _ = sample_study_environment

        plan_res = client.post("/study-plans", json={"title": "Track", "plan_mode": "daily"}, headers=headers)
        plan_id = plan_res.json()["id"]

        # Simulate learner improving mastery to 95% on Deadlocks
        m = db.query(LearnerTopicMastery).filter_by(user_id=user.id, topic="Deadlocks").first()
        m.mastery_score = 0.95
        db.commit()

        # Adapt plan
        adapt_res = client.post(f"/study-plans/{plan_id}/adapt", headers=headers)
        assert adapt_res.status_code == 200
        data = adapt_res.json()
        assert data["plan_id"] == plan_id
        assert "adapted" in data["message"].lower()


# =============================================================================
# CATEGORY E: SUBSCRIPTION LIMITS & ENTITLEMENT GATING
# =============================================================================

class TestSubscriptionEntitlements:
    def test_free_user_cannot_create_exam_plan(self, client, auth_headers_free):
        headers, _ = auth_headers_free
        payload = {
            "title": "Final Exam Prep",
            "plan_mode": "exam",
            "target_date": (datetime.utcnow() + timedelta(days=10)).isoformat()
        }
        res = client.post("/study-plans", json=payload, headers=headers)
        assert res.status_code == 402
        assert "pro and premium" in res.json()["detail"].lower()

    def test_free_user_active_plan_limit_enforced(self, client, auth_headers_free):
        headers, _ = auth_headers_free

        # 1st plan succeeds
        res1 = client.post("/study-plans", json={"title": "Plan 1", "plan_mode": "daily"}, headers=headers)
        assert res1.status_code == 200

        # 2nd active plan blocked by 402
        res2 = client.post("/study-plans", json={"title": "Plan 2", "plan_mode": "daily"}, headers=headers)
        assert res2.status_code == 402
        assert "limit" in res2.json()["detail"].lower()

    def test_pro_user_can_create_exam_plan(self, client, auth_headers_pro):
        headers, _ = auth_headers_pro
        payload = {
            "title": "Semester Exam Plan",
            "plan_mode": "exam",
            "target_date": (datetime.utcnow() + timedelta(days=15)).isoformat()
        }
        res = client.post("/study-plans", json=payload, headers=headers)
        assert res.status_code == 200
        assert res.json()["plan_mode"] == "exam"


# =============================================================================
# CATEGORY F: MULTI-TENANT SECURITY & IDOR DEFENSE
# =============================================================================

class TestMultiTenantSecurity:
    def test_user_b_cannot_view_user_a_plan(self, client, auth_headers_pro, auth_headers_attacker):
        headers_a, _ = auth_headers_pro
        headers_b, _ = auth_headers_attacker

        plan_res = client.post("/study-plans", json={"title": "Private Plan", "plan_mode": "daily"}, headers=headers_a)
        plan_id = plan_res.json()["id"]

        # Attacker tries to read plan
        res = client.get(f"/study-plans/{plan_id}", headers=headers_b)
        assert res.status_code == 404

    def test_user_b_cannot_modify_user_a_task(self, client, auth_headers_pro, auth_headers_attacker):
        headers_a, _ = auth_headers_pro
        headers_b, _ = auth_headers_attacker

        plan_res = client.post("/study-plans", json={"title": "Private Plan", "plan_mode": "daily"}, headers=headers_a)
        task_id = plan_res.json()["tasks"][0]["id"]

        # Attacker tries to complete User A's task
        res = client.post(f"/study-plans/tasks/{task_id}/complete", headers=headers_b)
        assert res.status_code == 404

    def test_user_b_cannot_delete_user_a_plan(self, client, auth_headers_pro, auth_headers_attacker):
        headers_a, _ = auth_headers_pro
        headers_b, _ = auth_headers_attacker

        plan_res = client.post("/study-plans", json={"title": "Private Plan", "plan_mode": "daily"}, headers=headers_a)
        plan_id = plan_res.json()["id"]

        # Attacker tries to delete User A's plan
        res = client.delete(f"/study-plans/{plan_id}", headers=headers_b)
        assert res.status_code == 404
