"""Comprehensive test suite for Florix AI Exam / Mock Exam Engine.

Covers:
- Exam blueprint creation and configuration (modes, difficulty, question count)
- Grounded question generation and persistence
- Subscription entitlements & feature gating (Free vs Pro/Premium limits)
- Answer leakage defense (withholding correct answers during active attempts)
- Server-authoritative timer, expiration, and auto-submission
- Deterministic scoring without None == None vulnerabilities
- Topic-level performance analysis and mistake tracking
- Multi-tenant security & IDOR protection across all endpoints
- Phase 3 Learner Topic Mastery & LearningEvent integration
- Revision notification infrastructure integration
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
    Base, User, StudySession, DocumentChunk,
    Exam, ExamQuestion, ExamAttempt, ExamAnswer,
    LearnerTopicMastery, LearningEvent, Reminder
)
from auth import get_password_hash, create_access_token
from main import app, get_db
from exam.scoring import evaluate_answer, calculate_topic_performance, generate_recommended_actions


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
        email="free_exam_user@florix.edu",
        hashed_password=get_password_hash("SecretPass123!"),
        name="Free Exam Student",
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
        email="pro_exam_user@florix.edu",
        hashed_password=get_password_hash("SecretPass123!"),
        name="Pro Exam Student",
        plan="pro"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(data={"sub": user.email})
    return {"Authorization": f"Bearer {token}"}, user


@pytest.fixture
def auth_headers_user_b(db):
    user = User(
        email="other_student@florix.edu",
        hashed_password=get_password_hash("SecretPass123!"),
        name="User B",
        plan="pro"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(data={"sub": user.email})
    return {"Authorization": f"Bearer {token}"}, user


@pytest.fixture
def auth_headers_admin(db):
    user = User(
        email="admin_user@florix.edu",
        hashed_password=get_password_hash("SecretPass123!"),
        name="Admin User",
        plan="free",
        is_admin=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(data={"sub": user.email})
    return {"Authorization": f"Bearer {token}"}, user


@pytest.fixture
def study_session_with_chunks(db, auth_headers_free):
    _, user = auth_headers_free
    session = StudySession(
        filename="Database_Systems.pdf",
        ai_title="Relational Database Systems",
        summary="Comprehensive coverage of normalization, transactions, and indexing.",
        content="Normalization removes redundancy. 1NF requires atomic values. 2NF removes partial dependencies. 3NF removes transitive dependencies. BCNF is stronger than 3NF. Transactions must satisfy ACID properties.",
        user_id=user.id,
        source_type="pdf",
        page_count=5
    )
    db.add(session)
    db.flush()

    c1 = DocumentChunk(
        chunk_index=0,
        text_content="Database Normalization decomposes relations to reduce anomaly. 1NF has atomic attribute domains. 2NF requires no partial dependency on candidate keys.",
        embedding=[0.0] * 10,
        page_number=2,
        section_heading="Relational Normalization",
        content_type="text",
        session_id=session.id
    )
    c2 = DocumentChunk(
        chunk_index=1,
        text_content="ACID properties guarantee reliability. Atomicity ensures all or nothing. Consistency maintains database invariants. Isolation prevents concurrency interference. Durability guarantees committed changes persist.",
        embedding=[0.0] * 10,
        page_number=4,
        section_heading="Transactions & ACID",
        content_type="text",
        session_id=session.id
    )
    db.add_all([c1, c2])
    db.commit()
    db.refresh(session)
    return session


class TestDeterministicScoringLogic:
    def test_evaluate_answer_correct(self):
        assert evaluate_answer(0, 0) is True
        assert evaluate_answer(2, 2) is True
        assert evaluate_answer("1", 1) is True

    def test_evaluate_answer_incorrect(self):
        assert evaluate_answer(0, 1) is False
        assert evaluate_answer(3, 2) is False

    def test_none_answer_never_evaluates_true(self):
        assert evaluate_answer(None, 0) is False
        assert evaluate_answer(None, None) is False

    def test_calculate_topic_performance(self):
        graded = [
            {"topic": "Normalization", "is_correct": True},
            {"topic": "Normalization", "is_correct": False},
            {"topic": "Normalization", "is_correct": True},
            {"topic": "ACID", "is_correct": True},
        ]
        perf = calculate_topic_performance(graded)
        assert "Normalization" in perf
        assert perf["Normalization"]["total"] == 3
        assert perf["Normalization"]["correct"] == 2
        assert perf["Normalization"]["percentage"] == 67

        assert "ACID" in perf
        assert perf["ACID"]["total"] == 1
        assert perf["ACID"]["correct"] == 1
        assert perf["ACID"]["percentage"] == 100

    def test_generate_recommended_actions_with_weak_topics(self):
        topic_scores = {
            "Normalization": {"correct": 1, "total": 3, "percentage": 33},
            "ACID": {"correct": 3, "total": 3, "percentage": 100}
        }
        recs = generate_recommended_actions(topic_scores, passing_percentage=70)
        assert len(recs) > 0
        assert any("Normalization" in r for r in recs)


class TestExamCreationAndEntitlements:
    def test_create_practice_exam_success(self, client, auth_headers_free, study_session_with_chunks):
        headers, _ = auth_headers_free
        payload = {
            "session_id": study_session_with_chunks.id,
            "title": "DBMS Practice Exam",
            "exam_mode": "practice",
            "difficulty": "intermediate",
            "duration_minutes": 20,
            "passing_percentage": 70,
            "num_questions": 5,
            "topics": ["Normalization"]
        }
        res = client.post("/exams", json=payload, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["title"] == "DBMS Practice Exam"
        assert data["exam_mode"] == "practice"
        assert data["total_questions"] > 0
        assert data["attempts_count"] == 0

    def test_free_user_cannot_create_mock_exam(self, client, auth_headers_free, study_session_with_chunks):
        headers, _ = auth_headers_free
        payload = {
            "session_id": study_session_with_chunks.id,
            "title": "DBMS Mock Exam",
            "exam_mode": "mock",
            "num_questions": 5
        }
        res = client.post("/exams", json=payload, headers=headers)
        assert res.status_code == 402
        assert "exam mode requires an upgraded plan" in res.json()["detail"]

    def test_pro_user_can_create_mock_exam(self, client, auth_headers_pro, db):
        headers, user = auth_headers_pro
        session = StudySession(
            filename="OS_Concepts.pdf",
            summary="Operating System processes and memory.",
            content="Deadlocks require mutual exclusion, hold and wait, no preemption, circular wait.",
            user_id=user.id
        )
        db.add(session)
        db.commit()

        payload = {
            "session_id": session.id,
            "title": "OS Mock Exam",
            "exam_mode": "mock",
            "duration_minutes": 45,
            "num_questions": 10
        }
        res = client.post("/exams", json=payload, headers=headers)
        assert res.status_code == 200
        assert res.json()["exam_mode"] == "mock"

    def test_question_count_plan_limit_enforced(self, client, auth_headers_free, study_session_with_chunks):
        headers, _ = auth_headers_free
        payload = {
            "session_id": study_session_with_chunks.id,
            "title": "Oversized Exam",
            "exam_mode": "practice",
            "num_questions": 25  # Free tier maximum is 10
        }
        res = client.post("/exams", json=payload, headers=headers)
        assert res.status_code == 402
        assert "exceeds the FREE plan maximum" in res.json()["detail"]

    def test_cross_user_session_access_forbidden(self, client, auth_headers_user_b, study_session_with_chunks):
        headers, _ = auth_headers_user_b
        payload = {
            "session_id": study_session_with_chunks.id,  # Owned by Free Student
            "title": "Illicit Exam",
            "exam_mode": "practice",
            "num_questions": 5
        }
        res = client.post("/exams", json=payload, headers=headers)
        assert res.status_code == 404
        assert "unauthorized" in res.json()["detail"].lower()


class TestAnswerLeakageDefense:
    def test_active_attempt_withholds_answers_and_explanations(self, client, auth_headers_free, study_session_with_chunks):
        headers, _ = auth_headers_free
        create_res = client.post("/exams", json={
            "session_id": study_session_with_chunks.id,
            "title": "Security Audit Exam",
            "exam_mode": "practice",
            "num_questions": 3
        }, headers=headers)
        exam_id = create_res.json()["id"]

        start_res = client.post(f"/exams/{exam_id}/start", headers=headers)
        assert start_res.status_code == 200
        attempt = start_res.json()

        assert attempt["status"] == "in_progress"
        assert len(attempt["questions"]) > 0

        # Verify anti-leakage invariants
        for q in attempt["questions"]:
            assert "correct_answer" not in q
            assert "explanation" not in q
            assert "source_chunk_id" not in q
            assert "options" in q
            assert "question_text" in q

        # Active attempt cannot fetch review
        attempt_id = attempt["id"]
        rev_res = client.get(f"/exams/attempts/{attempt_id}/review", headers=headers)
        assert rev_res.status_code == 400
        assert "still in progress" in rev_res.json()["detail"].lower()

    def test_review_reveals_explanations_only_after_submission(self, client, auth_headers_free, study_session_with_chunks):
        headers, _ = auth_headers_free
        create_res = client.post("/exams", json={
            "session_id": study_session_with_chunks.id,
            "title": "Review Access Exam",
            "exam_mode": "practice",
            "num_questions": 2
        }, headers=headers)
        exam_id = create_res.json()["id"]
        attempt_res = client.post(f"/exams/{exam_id}/start", headers=headers)
        attempt_id = attempt_res.json()["id"]

        sub_res = client.post(f"/exams/attempts/{attempt_id}/submit", headers=headers)
        assert sub_res.status_code == 200
        review = sub_res.json()
        assert review["status"] in ["submitted", "graded"]
        assert len(review["questions"]) > 0

        for q in review["questions"]:
            assert "correct_answer" in q
            assert "explanation" in q
            assert "is_correct" in q


class TestAttemptLifecycleAndState:
    def test_save_answers_and_resume_attempt(self, client, auth_headers_free, study_session_with_chunks):
        headers, _ = auth_headers_free
        create_res = client.post("/exams", json={
            "session_id": study_session_with_chunks.id,
            "title": "Interactive Exam",
            "exam_mode": "practice",
            "num_questions": 3
        }, headers=headers)
        exam_id = create_res.json()["id"]

        start_res = client.post(f"/exams/{exam_id}/start", headers=headers)
        attempt_id = start_res.json()["id"]
        q0 = start_res.json()["questions"][0]

        # Save answer for question 0
        save_res = client.put(f"/exams/attempts/{attempt_id}/answers", json={
            "answers": [
                {
                    "question_id": q0["id"],
                    "user_answer": 1,
                    "is_marked_for_review": True,
                    "time_spent_seconds": 35
                }
            ]
        }, headers=headers)
        assert save_res.status_code == 200

        # Resuming / refreshing returns saved state
        fetch_res = client.get(f"/exams/attempts/{attempt_id}", headers=headers)
        assert fetch_res.status_code == 200
        saved_map = fetch_res.json()["saved_answers"]
        assert str(q0["id"]) in saved_map
        assert saved_map[str(q0["id"])]["user_answer"] == 1
        assert saved_map[str(q0["id"])]["is_marked_for_review"] is True

    def test_cannot_save_answers_after_submission(self, client, auth_headers_free, study_session_with_chunks):
        headers, _ = auth_headers_free
        create_res = client.post("/exams", json={
            "session_id": study_session_with_chunks.id,
            "title": "Locked Exam",
            "exam_mode": "practice",
            "num_questions": 2
        }, headers=headers)
        exam_id = create_res.json()["id"]
        start_res = client.post(f"/exams/{exam_id}/start", headers=headers)
        attempt_id = start_res.json()["id"]

        # Submit attempt
        client.post(f"/exams/attempts/{attempt_id}/submit", headers=headers)

        # Attempt to save answers after submission
        q0 = start_res.json()["questions"][0]
        tamper_res = client.put(f"/exams/attempts/{attempt_id}/answers", json={
            "answers": [{"question_id": q0["id"], "user_answer": 0}]
        }, headers=headers)
        assert tamper_res.status_code == 400
        assert "cannot save answers" in tamper_res.json()["detail"].lower()

    def test_expired_attempt_auto_submits(self, client, auth_headers_pro, db):
        headers, user = auth_headers_pro
        session = StudySession(
            filename="Networks.pdf",
            summary="Networking protocols.",
            content="TCP is connection oriented. UDP is connectionless.",
            user_id=user.id
        )
        db.add(session)
        db.commit()

        create_res = client.post("/exams", json={
            "session_id": session.id,
            "title": "Expired Mock",
            "exam_mode": "mock",
            "duration_minutes": 10,
            "num_questions": 2
        }, headers=headers)
        exam_id = create_res.json()["id"]
        start_res = client.post(f"/exams/{exam_id}/start", headers=headers)
        attempt_id = start_res.json()["id"]

        # Backdate expiration time directly in DB to simulate timeout
        attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
        attempt.expires_at = datetime.utcnow() - timedelta(minutes=5)
        db.commit()

        # Fetch attempt; should trigger auto-submit
        fetch_res = client.get(f"/exams/attempts/{attempt_id}", headers=headers)
        assert fetch_res.status_code == 200
        assert fetch_res.json()["status"] in ["submitted", "timed_out"]


class TestMultiTenantIsolationAndSecurity:
    def test_user_b_cannot_view_user_a_exam(self, client, auth_headers_free, auth_headers_user_b, study_session_with_chunks):
        headers_a, _ = auth_headers_free
        headers_b, _ = auth_headers_user_b

        create_res = client.post("/exams", json={
            "session_id": study_session_with_chunks.id,
            "title": "Private Exam",
            "exam_mode": "practice",
            "num_questions": 2
        }, headers=headers_a)
        exam_id = create_res.json()["id"]

        res = client.get(f"/exams/{exam_id}", headers=headers_b)
        assert res.status_code == 404
        assert "unauthorized" in res.json()["detail"].lower()

    def test_user_b_cannot_submit_user_a_attempt(self, client, auth_headers_free, auth_headers_user_b, study_session_with_chunks):
        headers_a, _ = auth_headers_free
        headers_b, _ = auth_headers_user_b

        create_res = client.post("/exams", json={
            "session_id": study_session_with_chunks.id,
            "title": "Attempt Isolation Exam",
            "exam_mode": "practice",
            "num_questions": 2
        }, headers=headers_a)
        exam_id = create_res.json()["id"]
        start_res = client.post(f"/exams/{exam_id}/start", headers=headers_a)
        attempt_id = start_res.json()["id"]

        tamper_res = client.post(f"/exams/attempts/{attempt_id}/submit", headers=headers_b)
        assert tamper_res.status_code == 404
        assert "unauthorized" in tamper_res.json()["detail"].lower()


class TestMasteryAndEventIntegration:
    def test_submission_updates_mastery_and_logs_learning_event(self, client, auth_headers_free, study_session_with_chunks, db):
        headers, user = auth_headers_free
        create_res = client.post("/exams", json={
            "session_id": study_session_with_chunks.id,
            "title": "Mastery Verification Exam",
            "exam_mode": "practice",
            "num_questions": 2,
            "topics": ["Normalization"]
        }, headers=headers)
        exam_id = create_res.json()["id"]
        start_res = client.post(f"/exams/{exam_id}/start", headers=headers)
        attempt_id = start_res.json()["id"]

        # Submit exam
        sub_res = client.post(f"/exams/attempts/{attempt_id}/submit", headers=headers)
        assert sub_res.status_code == 200

        # Check LearnerTopicMastery record created
        mastery = db.query(LearnerTopicMastery).filter(
            LearnerTopicMastery.user_id == user.id,
            LearnerTopicMastery.session_id == study_session_with_chunks.id
        ).first()
        assert mastery is not None
        assert mastery.attempts > 0

        # Check LearningEvent created
        event = db.query(LearningEvent).filter(
            LearningEvent.user_id == user.id,
            LearningEvent.event_type == "EXAM_SUBMISSION"
        ).first()
        assert event is not None
        assert event.payload["attempt_id"] == attempt_id

    def test_duplicate_submission_is_idempotent(self, client, auth_headers_free, study_session_with_chunks, db):
        headers, user = auth_headers_free
        create_res = client.post("/exams", json={
            "session_id": study_session_with_chunks.id,
            "title": "Idempotent Exam",
            "exam_mode": "practice",
            "num_questions": 2
        }, headers=headers)
        exam_id = create_res.json()["id"]
        start_res = client.post(f"/exams/{exam_id}/start", headers=headers)
        attempt_id = start_res.json()["id"]

        # First submit
        res1 = client.post(f"/exams/attempts/{attempt_id}/submit", headers=headers)
        assert res1.status_code == 200

        # Count events before second submit
        events_count_1 = db.query(LearningEvent).filter(
            LearningEvent.user_id == user.id,
            LearningEvent.event_type == "EXAM_SUBMISSION"
        ).count()

        # Second submit
        res2 = client.post(f"/exams/attempts/{attempt_id}/submit", headers=headers)
        assert res2.status_code == 200
        assert res2.json()["score"] == res1.json()["score"]

        # No duplicate events created
        events_count_2 = db.query(LearningEvent).filter(
            LearningEvent.user_id == user.id,
            LearningEvent.event_type == "EXAM_SUBMISSION"
        ).count()
        assert events_count_1 == events_count_2


class TestNotificationIntegration:
    def test_schedule_exam_reminder(self, client, auth_headers_free, study_session_with_chunks, db):
        headers, user = auth_headers_free
        create_res = client.post("/exams", json={
            "session_id": study_session_with_chunks.id,
            "title": "Reminder Test Exam",
            "exam_mode": "practice",
            "num_questions": 2
        }, headers=headers)
        exam_id = create_res.json()["id"]

        future_iso = (datetime.utcnow() + timedelta(days=2)).isoformat()
        res = client.post(f"/exams/{exam_id}/remind?scheduled_at={future_iso}", headers=headers)
        assert res.status_code == 200
        rem_id = res.json()["reminder_id"]

        reminder = db.query(Reminder).filter(Reminder.id == rem_id, Reminder.user_id == user.id).first()
        assert reminder is not None
        assert "Reminder Test Exam" in reminder.title
        assert reminder.target_type == "quiz"
