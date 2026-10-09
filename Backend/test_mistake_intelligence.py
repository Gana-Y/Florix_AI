"""
Comprehensive Test Suite for Florix AI Mistake Intelligence / Metacognitive Debugger.

Verifies:
1. Error taxonomy classification and normalization across all 10 categories + UNKNOWN.
2. Longitudinal pattern state tracking (ISOLATED, RECURRING, PERSISTENT, IMPROVING, RESOLVED).
3. Prerequisite concept gap detection via Phase 5 Knowledge Graph artifacts.
4. Grounded metacognitive diagnostic analysis and citation provenance.
5. Deterministic targeted practice generation and instant grading.
6. Topic mastery integration via LearnerEngine and LearningEvent emission.
7. Adaptive Study Planner task creation (task_type="practice_weak_area").
8. Revision Notification & Reminder scheduling via NotificationService.
9. Strict multi-tenant IDOR defense (User A cannot access User B's mistakes).
10. Subscription plan limit enforcement (mistake_analyses_per_day and ai_practice_generations_per_day).
"""

import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi import HTTPException
from fastapi.testclient import TestClient

from database import (
    Base, User, StudySession, DocumentChunk, MistakeRecord,
    LearningEvent, StudyPlan, StudyPlanTask, Reminder,
    VisualArtifact, Activity, QuizResult
)
from mistake.taxonomy import (
    MistakeCategory,
    PatternState,
    CATEGORY_METADATA,
    normalize_category
)
from mistake.models import (
    MistakeAnalyzeRequest,
    TargetedPracticeRequest,
    PracticeSubmitRequest,
    PracticeAnswerItem
)
from mistake.analyzer import MistakeAnalyzer, resolve_answer_text
from mistake.service import MistakeService
from intelligence.models import TeachingMode
from main import app, PLAN_LIMITS, check_plan_limit
from auth import get_password_hash, create_access_token


SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine_test = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)


# In-memory test database fixture
@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine_test)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine_test)


@pytest.fixture
def test_user(db_session):
    u = User(
        name="Learner One",
        email="learner1@example.com",
        hashed_password=get_password_hash("Secret123!"),
        plan="free"
    )
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u


@pytest.fixture
def other_user(db_session):
    u = User(
        name="Learner Two",
        email="learner2@example.com",
        hashed_password=get_password_hash("Secret456!"),
        plan="free"
    )
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u


@pytest.fixture
def study_session(db_session, test_user):
    s = StudySession(
        user_id=test_user.id,
        filename="Physics_Mechanics.pdf",
        content="Newton's laws of motion form the basis of classical mechanics. First law is inertia. Second law states F = ma. Third law states action and reaction are equal and opposite.",
        summary="Foundations of Newtonian mechanics and laws of motion.",
        category="Physics"
    )
    db_session.add(s)
    db_session.commit()
    db_session.refresh(s)

    # Add document chunks
    c1 = DocumentChunk(
        session_id=s.id,
        chunk_index=0,
        page_number=1,
        text_content="Newton's second law mathematically states F = ma, where force is proportional to mass times acceleration.",
        section_heading="Newton's Second Law",
        content_type="text",
        embedding=[0.0] * 768
    )
    c2 = DocumentChunk(
        session_id=s.id,
        chunk_index=1,
        page_number=2,
        text_content="A common misconception is that a constant velocity requires a continuous net force. According to the First Law of Inertia, net force is zero when velocity is constant.",
        section_heading="Law of Inertia",
        content_type="text",
        embedding=[0.0] * 768
    )
    db_session.add_all([c1, c2])
    db_session.commit()
    return s


# =============================================================================
# 1. TAXONOMY & NORMALIZATION TESTS
# =============================================================================

def test_taxonomy_normalization_exact():
    for cat in MistakeCategory:
        assert normalize_category(cat.value) == cat.value
        assert cat.value in CATEGORY_METADATA


def test_taxonomy_normalization_fuzzy():
    assert normalize_category("conceptual understanding error") == MistakeCategory.CONCEPTUAL_MISUNDERSTANDING.value
    assert normalize_category("algorithm procedure failure") == MistakeCategory.PROCEDURAL_ERROR.value
    assert normalize_category("arithmetic mistake") == MistakeCategory.CALCULATION_ERROR.value
    assert normalize_category("prerequisite needed") == MistakeCategory.PREREQUISITE_GAP.value
    assert normalize_category("conflated concepts") == MistakeCategory.CONFUSION_BETWEEN_CONCEPTS.value
    assert normalize_category("reading error misread") == MistakeCategory.MISREAD_QUESTION.value
    assert normalize_category("careless pick") == MistakeCategory.CARELESS_ERROR.value
    assert normalize_category("memory recall slip") == MistakeCategory.MEMORY_RECALL_FAILURE.value
    assert normalize_category("random non existent") == MistakeCategory.UNKNOWN.value


def test_resolve_answer_text():
    options = ["Alpha", "Beta", "Gamma", "Delta"]
    assert resolve_answer_text(0, options) == "Alpha"
    assert resolve_answer_text(2, options) == "Gamma"
    assert resolve_answer_text("B", options) == "Beta"
    assert resolve_answer_text("Option 1", options) == "Alpha"
    assert resolve_answer_text("Direct Text", options) == "Direct Text"


# =============================================================================
# 2. PATTERN STATE TRACKING TESTS
# =============================================================================

def test_pattern_state_isolated(db_session, test_user):
    # No prior events -> ISOLATED
    state = MistakeAnalyzer.detect_pattern_state(db_session, test_user.id, "Thermodynamics")
    assert state == PatternState.ISOLATED.value


def test_pattern_state_recurring(db_session, test_user):
    # Add 2 prior failed learning events on topic
    now = datetime.utcnow()
    e1 = LearningEvent(
        user_id=test_user.id,
        event_type="QUIZ_ANSWER",
        payload={"topic": "Thermodynamics", "is_correct": False},
        timestamp=now - timedelta(hours=2)
    )
    e2 = LearningEvent(
        user_id=test_user.id,
        event_type="QUIZ_ANSWER",
        payload={"topic": "Thermodynamics", "is_correct": False},
        timestamp=now - timedelta(hours=1)
    )
    db_session.add_all([e1, e2])
    db_session.commit()

    state = MistakeAnalyzer.detect_pattern_state(db_session, test_user.id, "Thermodynamics")
    assert state == PatternState.RECURRING.value


def test_pattern_state_persistent(db_session, test_user):
    # Add 4 consecutive failed events on topic
    now = datetime.utcnow()
    for i in range(4):
        db_session.add(LearningEvent(
            user_id=test_user.id,
            event_type="QUIZ_ANSWER",
            payload={"topic": "Thermodynamics", "is_correct": False},
            timestamp=now - timedelta(minutes=10 * (4 - i))
        ))
    db_session.commit()

    state = MistakeAnalyzer.detect_pattern_state(db_session, test_user.id, "Thermodynamics")
    assert state == PatternState.PERSISTENT.value


# =============================================================================
# 3. PREREQUISITE DETECTION VIA KNOWLEDGE GRAPH ARTIFACTS
# =============================================================================

def test_prerequisite_detection_from_knowledge_graph(db_session, test_user, study_session):
    # Create a VisualArtifact concept map with edges indicating prerequisite
    art = VisualArtifact(
        id="vis_test_1",
        user_id=test_user.id,
        session_id=study_session.id,
        visual_type="concept_map",
        title="Physics Concepts",
        visual_data={
            "nodes": [
                {"id": "n1", "label": "Newtonian Dynamics"},
                {"id": "n2", "label": "Vector Algebra"}
            ],
            "edges": [
                {"source": "n2", "target": "n1", "relation": "prerequisite"}
            ]
        }
    )
    db_session.add(art)
    db_session.commit()

    prereq = MistakeAnalyzer.detect_prerequisites(db_session, study_session.id, "Newtonian Dynamics")
    assert prereq == "Vector Algebra"


# =============================================================================
# 4. GROUNDED METACONITIVE ANALYSIS (FALLBACK & DETERMINISTIC PATH)
# =============================================================================

def test_analyze_and_record_service(db_session, test_user, study_session):
    req = MistakeAnalyzeRequest(
        question_text="What is required to maintain constant velocity in vacuum?",
        options=["A constant net force", "Zero net force", "Infinite mass", "Negative gravity"],
        user_answer=0,  # "A constant net force" (Classic inertia misconception)
        correct_answer=1,  # "Zero net force"
        topic="Newton's First Law",
        subtopic="Inertia",
        difficulty="intermediate",
        session_id=study_session.id,
        teaching_mode="INTERMEDIATE",
        persist=True
    )

    res = MistakeService.analyze_and_record(
        db=db_session,
        user=test_user,
        req=req,
        gemini_client=None  # triggers verified deterministic grounded analysis
    )

    assert res.id is not None
    assert res.error_category in [c.value for c in MistakeCategory]
    assert res.misconception is not None
    assert len(res.why_incorrect) > 0
    assert len(res.correct_reasoning) > 0
    assert res.pattern_state == "ISOLATED"
    assert res.is_resolved is False

    # Verify DB record
    rec = db_session.query(MistakeRecord).filter(MistakeRecord.id == res.id).first()
    assert rec is not None
    assert rec.user_id == test_user.id
    assert rec.question_text == req.question_text
    assert rec.user_answer == "A constant net force"
    assert rec.correct_answer == "Zero net force"


# =============================================================================
# 5. MULTI-TENANT IDOR AUTHORIZATION DEFENSE
# =============================================================================

def test_idor_defense(db_session, test_user, other_user, study_session):
    req = MistakeAnalyzeRequest(
        question_text="Sample private question?",
        options=["A", "B"],
        user_answer="A",
        correct_answer="B",
        topic="Security",
        session_id=study_session.id,
        persist=True
    )
    res = MistakeService.analyze_and_record(db=db_session, user=test_user, req=req)

    # Learner One can access
    rec = MistakeService.get_mistake_or_404(db_session, test_user.id, res.id)
    assert rec.id == res.id

    # Learner Two CANNOT access Learner One's mistake
    with pytest.raises(HTTPException) as exc:
        MistakeService.get_mistake_or_404(db_session, other_user.id, res.id)
    assert exc.value.status_code == 404

    # Learner Two cannot resolve Learner One's mistake
    with pytest.raises(HTTPException) as exc:
        MistakeService.resolve_mistake(db_session, other_user.id, res.id)
    assert exc.value.status_code == 404

    # Learner Two cannot delete Learner One's mistake
    with pytest.raises(HTTPException) as exc:
        MistakeService.delete_mistake(db_session, other_user.id, res.id)
    assert exc.value.status_code == 404


# =============================================================================
# 6. TARGETED PRACTICE GENERATION & DETERMINISTIC GRADING
# =============================================================================

def test_targeted_practice_generation_and_grading(db_session, test_user, study_session):
    # 1. Analyze and record mistake
    req = MistakeAnalyzeRequest(
        question_text="What does F = ma signify?",
        options=["Force is mass times velocity", "Force is mass times acceleration"],
        user_answer=0,
        correct_answer=1,
        topic="Newton's Second Law",
        session_id=study_session.id,
        persist=True
    )
    analysis = MistakeService.analyze_and_record(db=db_session, user=test_user, req=req)

    # 2. Generate targeted practice
    prac_req = TargetedPracticeRequest(num_questions=2)
    practice = MistakeService.generate_targeted_practice(
        db=db_session,
        user_id=test_user.id,
        mistake_id=analysis.id,
        req=prac_req
    )
    assert len(practice.questions) == 2
    assert practice.mistake_id == analysis.id

    # 3. Submit 100% correct answers
    submit_req = PracticeSubmitRequest(
        answers=[
            PracticeAnswerItem(question_order=1, user_answer=0),  # In fallback, option 0 is grounded correct
            PracticeAnswerItem(question_order=2, user_answer=0)
        ]
    )
    result = MistakeService.submit_targeted_practice(
        db=db_session,
        user_id=test_user.id,
        mistake_id=analysis.id,
        req=submit_req
    )

    assert result.score == 2
    assert result.total_questions == 2
    assert result.percentage == 100
    assert result.passed is True
    assert result.pattern_state == PatternState.RESOLVED.value
    assert result.is_resolved is True

    # Verify LearningEvent was logged
    le = db_session.query(LearningEvent).filter(
        LearningEvent.user_id == test_user.id,
        LearningEvent.event_type == "MISTAKE_PRACTICE"
    ).first()
    assert le is not None
    assert le.payload["mistake_id"] == analysis.id
    assert le.payload["score"] == 2


# =============================================================================
# 7. ADAPTIVE STUDY PLANNER INTEGRATION
# =============================================================================

def test_schedule_planner_task(db_session, test_user, study_session):
    req = MistakeAnalyzeRequest(
        question_text="Formula error question",
        options=["X", "Y"],
        user_answer="X",
        correct_answer="Y",
        topic="Quantum Mechanics",
        session_id=study_session.id,
        persist=True
    )
    analysis = MistakeService.analyze_and_record(db=db_session, user=test_user, req=req)

    # Schedule into planner
    plan_res = MistakeService.schedule_planner_task(
        db=db_session,
        user_id=test_user.id,
        mistake_id=analysis.id
    )

    assert plan_res["status"] == "scheduled"
    task_id = plan_res["task_id"]
    plan_id = plan_res["plan_id"]

    task = db_session.query(StudyPlanTask).filter(StudyPlanTask.id == task_id).first()
    assert task is not None
    assert task.task_type == "practice_weak_area"
    assert task.target_topic == "Quantum Mechanics"
    assert task.plan_id == plan_id


# =============================================================================
# 8. REVISION NOTIFICATION & REMINDER INTEGRATION
# =============================================================================

def test_schedule_notification_reminder(db_session, test_user, study_session):
    req = MistakeAnalyzeRequest(
        question_text="Revision reminder question",
        options=["A", "B"],
        user_answer="A",
        correct_answer="B",
        topic="Biochemistry",
        session_id=study_session.id,
        persist=True
    )
    analysis = MistakeService.analyze_and_record(db=db_session, user=test_user, req=req)

    rem_time = datetime.utcnow() + timedelta(days=2)
    rem_res = MistakeService.schedule_notification_reminder(
        db=db_session,
        user_id=test_user.id,
        mistake_id=analysis.id,
        scheduled_at=rem_time
    )

    assert rem_res["status"] == "reminder_scheduled"
    rem = db_session.query(Reminder).filter(Reminder.id == rem_res["reminder_id"]).first()
    assert rem is not None
    assert "Biochemistry" in rem.title
    assert f"mistake:{analysis.id}" == rem.target_reference


# =============================================================================
# 9. SUBSCRIPTION PLAN LIMIT ENFORCEMENT
# =============================================================================

def test_subscription_limits_free_user(db_session, test_user):
    limit = PLAN_LIMITS["free"]["mistake_analyses_per_day"]
    assert limit == 20

    # Insert limit mistake records for test_user today
    now = datetime.utcnow()
    for i in range(limit):
        db_session.add(MistakeRecord(
            user_id=test_user.id,
            question_text=f"Question {i}",
            user_answer="A",
            correct_answer="B",
            error_category="MISCONCEPTION",
            why_incorrect="Error",
            correct_reasoning="Reasoning",
            pattern_state="ISOLATED",
            created_at=now
        ))
    db_session.commit()

    # Next one should raise 402
    with pytest.raises(HTTPException) as exc:
        check_plan_limit(test_user, "mistake_analyses_per_day", db_session)
    assert exc.value.status_code == 402
    assert f"Daily mistake analysis limit ({limit}) reached" in exc.value.detail


def test_subscription_limits_practice_generations(db_session, test_user):
    limit = PLAN_LIMITS["free"]["ai_practice_generations_per_day"]
    assert limit == 15

    # Insert limit practice generations for test_user today
    now = datetime.utcnow()
    for i in range(limit):
        db_session.add(Activity(
            user_id=test_user.id,
            action="Mistake Targeted Practice",
            details=f"Generated practice {i}",
            timestamp=now
        ))
    db_session.commit()

    # Next one should raise 402
    with pytest.raises(HTTPException) as exc:
        check_plan_limit(test_user, "ai_practice_generations_per_day", db_session)
    assert exc.value.status_code == 402
    assert f"Daily targeted practice generation limit ({limit}) reached" in exc.value.detail


def test_subscription_unlimited_premium_and_admin(db_session):
    premium_user = User(name="Prem", email="prem@example.com", plan="premium")
    admin_user = User(name="Admin", email="admin@example.com", plan="free", is_admin=True)

    # Neither should raise
    check_plan_limit(premium_user, "mistake_analyses_per_day", db_session)
    check_plan_limit(premium_user, "ai_practice_generations_per_day", db_session)
    check_plan_limit(admin_user, "mistake_analyses_per_day", db_session)
    check_plan_limit(admin_user, "ai_practice_generations_per_day", db_session)


# =============================================================================
# 10. REST API ENDPOINT TESTS (TestClient)
# =============================================================================

@pytest.fixture
def client(db_session, test_user):
    from auth import get_db, get_current_user

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    def override_get_current_user():
        session = TestingSessionLocal()
        u = session.query(User).filter(User.id == test_user.id).first()
        return u

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    c = TestClient(app)
    yield c
    app.dependency_overrides.clear()


def test_api_mistake_endpoints_lifecycle(client, db_session, test_user, study_session):
    # 1. POST /mistakes/analyze
    analyze_payload = {
        "question_text": "What is the unit of force in SI system?",
        "options": ["Joule", "Newton", "Watt", "Pascal"],
        "user_answer": 0,
        "correct_answer": 1,
        "topic": "Classical Mechanics",
        "session_id": study_session.id,
        "persist": True
    }
    r = client.post("/mistakes/analyze", json=analyze_payload)
    assert r.status_code == 200
    data = r.json()
    assert data["id"] is not None
    mistake_id = data["id"]
    assert data["topic"] == "Classical Mechanics"

    # 2. GET /mistakes
    r = client.get("/mistakes")
    assert r.status_code == 200
    mistakes = r.json()
    assert len(mistakes) >= 1
    assert any(m["id"] == mistake_id for m in mistakes)

    # 3. GET /mistakes/{id}
    r = client.get(f"/mistakes/{mistake_id}")
    assert r.status_code == 200
    assert r.json()["id"] == mistake_id

    # 4. POST /mistakes/{id}/practice
    r = client.post(f"/mistakes/{mistake_id}/practice", json={"num_questions": 2})
    assert r.status_code == 200
    pdata = r.json()
    assert len(pdata["questions"]) == 2

    # 5. POST /mistakes/{id}/practice/submit
    mistake_rec = db_session.query(MistakeRecord).filter(MistakeRecord.id == mistake_id).first()
    cached_qs = mistake_rec.options or []
    submit_payload = {
        "answers": [
            {"question_order": idx + 1, "user_answer": int(q.get("answer", 0))}
            for idx, q in enumerate(cached_qs)
        ]
    }
    r = client.post(f"/mistakes/{mistake_id}/practice/submit", json=submit_payload)
    assert r.status_code == 200
    res_data = r.json()
    assert res_data["passed"] is True
    assert res_data["score"] == len(cached_qs)

    # 6. POST /mistakes/{id}/plan
    r = client.post(f"/mistakes/{mistake_id}/plan")
    assert r.status_code == 200
    assert "task_id" in r.json()

    # 7. POST /mistakes/{id}/remind
    future_time = (datetime.utcnow() + timedelta(days=1)).isoformat()
    r = client.post(f"/mistakes/{mistake_id}/remind?scheduled_at={future_time}")
    assert r.status_code == 200
    assert "reminder_id" in r.json()

    # 8. POST /mistakes/{id}/resolve
    r = client.post(f"/mistakes/{mistake_id}/resolve")
    assert r.status_code == 200
    assert r.json()["is_resolved"] is True

    # 9. DELETE /mistakes/{id}
    r = client.delete(f"/mistakes/{mistake_id}")
    assert r.status_code == 200
    assert r.json()["status"] == "deleted"

    # 10. GET /mistakes/{id} should return 404
    r = client.get(f"/mistakes/{mistake_id}")
    assert r.status_code == 404


def test_sync_past_and_seed_sample_endpoints(client, db_session, test_user, study_session):
    # 1. Test seed-sample endpoint
    r = client.post("/mistakes/seed-sample")
    assert r.status_code == 200
    sample_data = r.json()
    assert sample_data["topic"] == "Operating Systems (Deadlocks & Concurrency)"
    assert sample_data["error_category"] == "CONCEPTUAL_MISUNDERSTANDING"
    assert sample_data["is_resolved"] is False
    assert len(sample_data["citations"]) > 0

    # 2. Test sync-from-history endpoint
    # First, insert a QuizResult with 1 wrong question
    quiz_res = QuizResult(
        score=1,
        total_questions=2,
        percentage=50,
        user_id=test_user.id,
        session_id=study_session.id,
        details=[
            {
                "question": "What is 2 + 2?",
                "user_answer": "4",
                "correct_answer": "4",
                "is_correct": True
            },
            {
                "question": "What is the time complexity of binary search?",
                "user_answer": "O(N)",
                "correct_answer": "O(log N)",
                "is_correct": False,
                "options": ["O(1)", "O(log N)", "O(N)", "O(N log N)"],
                "explanation": "Binary search divides the search space in half at each step, yielding logarithmic time."
            }
        ]
    )
    db_session.add(quiz_res)
    db_session.commit()

    # Call sync
    r_sync = client.post("/mistakes/sync-from-history")
    assert r_sync.status_code == 200
    sync_json = r_sync.json()
    assert sync_json["status"] == "success"
    assert sync_json["synced_count"] >= 1

    # Verify that the mistake is now in /mistakes
    r_list = client.get("/mistakes")
    assert r_list.status_code == 200
    items = r_list.json()
    q_texts = [item["question_text"] for item in items]
    assert "What is the time complexity of binary search?" in q_texts

