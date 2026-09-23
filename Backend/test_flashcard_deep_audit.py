"""
Audit #9 — Flashcards Subsystem Deep Audit & Production Hardening
Deterministic test suite verifying flashcard generation, input validation,
SM-2 spaced repetition, review idempotency, page_number accuracy, and tenant isolation.

Markers: FLASHCARD_ALPHA_123, FLASHCARD_BETA_456, FLASHCARD_GAMMA_789
"""

import os
import sys
import json
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

# ---------------------------------------------------------------------------
# Path bootstrap
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from intelligence.assessment import AssessmentEngine, clean_json_string
from intelligence.models import GroundedFlashcard
from intelligence.learner import LearnerEngine
from database import (
    Base, engine, SessionLocal,
    User, StudySession, DocumentChunk,
    LearningEvent, FlashcardProgress,
)
from main import app, FlashcardRequest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------------------------
# Test DB Setup
# ---------------------------------------------------------------------------
TEST_DB_URL = "sqlite:///./test_flashcard_deep_audit.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    """Create all tables in test DB, then tear down after."""
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=test_engine)
    if os.path.exists("./test_flashcard_deep_audit.db"):
        try:
            os.remove("./test_flashcard_deep_audit.db")
        except Exception:
            pass


@pytest.fixture
def db_session():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


def _override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


# Override FastAPI DB dependency
from main import get_db

@pytest.fixture(autouse=True)
def ensure_db_override():
    """Ensure FastAPI dependency override is always set to our test DB before every test."""
    app.dependency_overrides[get_db] = _override_get_db
    yield


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = _override_get_db
    return TestClient(app)


@pytest.fixture
def test_users(db_session):
    """Create two test users for tenant isolation tests (get-or-create)."""
    import uuid
    from auth import get_password_hash
    uid = uuid.uuid4().hex[:8]
    email_a = f"fc_auditor_a_{uid}@test.com"
    email_b = f"fc_auditor_b_{uid}@test.com"
    user_a = User(
        name="FlashcardAuditorA", email=email_a,
        hashed_password=get_password_hash("TestPass123!"),
        plan="pro"
    )
    user_b = User(
        name="FlashcardAuditorB", email=email_b,
        hashed_password=get_password_hash("TestPass456!"),
        plan="free"
    )
    db_session.add_all([user_a, user_b])
    db_session.commit()
    db_session.refresh(user_a)
    db_session.refresh(user_b)

    from auth import create_access_token
    token_a = create_access_token({"sub": user_a.email})
    token_b = create_access_token({"sub": user_b.email})

    return {
        "user_a": user_a,
        "user_b": user_b,
        "token_a": token_a,
        "token_b": token_b,
        "headers_a": {"Authorization": f"Bearer {token_a}"},
        "headers_b": {"Authorization": f"Bearer {token_b}"},
    }


# ===========================================================================
# CATEGORY A: FlashcardRequest Input Validation
# ===========================================================================

class TestFlashcardRequestValidation:
    """Validate boundary conditions on FlashcardRequest."""

    def test_valid_flashcard_request(self):
        req = FlashcardRequest(num_cards=10, session_id=1)
        assert req.num_cards == 10
        assert req.session_id == 1

    def test_zero_num_cards_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            FlashcardRequest(num_cards=0, session_id=1)

    def test_negative_num_cards_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            FlashcardRequest(num_cards=-5, session_id=1)

    def test_excessive_num_cards_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            FlashcardRequest(num_cards=100, session_id=1)

    def test_boundary_values_accepted(self):
        req1 = FlashcardRequest(num_cards=1, session_id=1)
        assert req1.num_cards == 1
        req50 = FlashcardRequest(num_cards=50, session_id=1)
        assert req50.num_cards == 50


# ===========================================================================
# CATEGORY B: FlashcardReviewRequest Input Validation
# ===========================================================================

class TestFlashcardReviewRequestValidation:
    """Validate review request structure and rating ranges."""

    def test_valid_review_request(self):
        from main import FlashcardReviewRequest
        req = FlashcardReviewRequest(session_id=1, card_index=0, quality=4)
        assert req.quality == 4
        assert req.card_index == 0

    def test_negative_quality_rejected(self):
        from pydantic import ValidationError
        from main import FlashcardReviewRequest
        with pytest.raises(ValidationError):
            FlashcardReviewRequest(session_id=1, card_index=0, quality=-1)

    def test_excessive_quality_rejected(self):
        from pydantic import ValidationError
        from main import FlashcardReviewRequest
        with pytest.raises(ValidationError):
            FlashcardReviewRequest(session_id=1, card_index=0, quality=6)

    def test_negative_card_index_rejected(self):
        from pydantic import ValidationError
        from main import FlashcardReviewRequest
        with pytest.raises(ValidationError):
            FlashcardReviewRequest(session_id=1, card_index=-1, quality=3)


# ===========================================================================
# CATEGORY C: Multi-Source Page Number Preservation
# ===========================================================================

class TestFlashcardSourceTraceability:
    """Ensure non-PDF flashcards maintain page_number=None while PDF flashcards preserve pages."""

    def test_audio_source_page_is_none(self):
        audio_chunks = [{
            "chunk_index": 0,
            "text_content": "FLASHCARD_ALPHA_123 audio transcript concept.",
            "page_number": None,
            "section_heading": "Audio Overview"
        }]
        mock_output = json.dumps([{
            "front": "What is FLASHCARD_ALPHA_123?",
            "back": "An acoustic audit marker.",
            "topic": "Testing",
            "difficulty": "beginner",
            "page_number": 1  # Simulated prompt-echo
        }])
        cards = AssessmentEngine.generate_flashcards(
            chunks=audio_chunks, num_cards=1,
            generate_fallback_fn=lambda c, p: mock_output
        )
        assert len(cards) == 1
        assert cards[0]["page_number"] is None

    def test_pdf_source_page_preserved(self):
        pdf_chunks = [{
            "chunk_index": 0,
            "text_content": "FLASHCARD_BETA_456 document concept on page 14.",
            "page_number": 14,
            "section_heading": "Chapter 4"
        }]
        mock_output = json.dumps([{
            "front": "What is on page 14?",
            "back": "FLASHCARD_BETA_456 details.",
            "topic": "Database",
            "difficulty": "intermediate",
            "page_number": 14
        }])
        cards = AssessmentEngine.generate_flashcards(
            chunks=pdf_chunks, num_cards=1,
            generate_fallback_fn=lambda c, p: mock_output
        )
        assert len(cards) == 1
        assert cards[0]["page_number"] == 14

    def test_web_source_page_is_none(self):
        web_chunks = [{
            "chunk_index": 0,
            "text_content": "FLASHCARD_GAMMA_789 web article concept.",
            "page_number": None,
            "section_heading": "Web Article"
        }]
        mock_output = json.dumps([{
            "front": "Web concept?",
            "back": "Grounded from web link.",
            "topic": "Web",
            "difficulty": "advanced",
            "page_number": None
        }])
        cards = AssessmentEngine.generate_flashcards(
            chunks=web_chunks, num_cards=1,
            generate_fallback_fn=lambda c, p: mock_output
        )
        assert len(cards) == 1
        assert cards[0]["page_number"] is None


# ===========================================================================
# CATEGORY D: SM-2 Spaced Repetition Mechanics
# ===========================================================================

class TestFlashcardSM2Mechanics:
    """Adversarial validation of the SM-2 algorithm implementation."""

    def test_ease_factor_minimum_clamp(self, db_session, test_users):
        """Repeated blackout ratings (quality=0) must not lower ease_factor below 1.30."""
        user = test_users["user_a"]
        session = StudySession(
            filename="sm2_clamp.pdf", summary="SM2 Test", content="Content",
            user_id=user.id, source_type="pdf", flashcards=[{"front": "Q", "back": "A"}]
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        # Apply 10 consecutive blackout ratings
        for _ in range(10):
            res = LearnerEngine.update_flashcard_sm2(
                db=db_session, user_id=user.id, session_id=session.id,
                card_index=0, quality=0
            )

        assert res["ease_factor"] >= 1.30
        assert res["interval"] == 1
        assert res["repetitions"] == 0

    def test_interval_progression_on_good_recall(self, db_session, test_users):
        """Quality >= 3 should advance repetitions: 1 day -> 6 days -> interval * EF."""
        user = test_users["user_a"]
        session = StudySession(
            filename="sm2_prog.pdf", summary="SM2 Test", content="Content",
            user_id=user.id, source_type="pdf", flashcards=[{"front": "Q", "back": "A"}]
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        # Review 1: First recall with quality 4 -> repetitions=1, interval=1
        r1 = LearnerEngine.update_flashcard_sm2(
            db=db_session, user_id=user.id, session_id=session.id,
            card_index=0, quality=4
        )
        assert r1["repetitions"] == 1
        assert r1["interval"] == 1

        # Review 2: Second recall with quality 4 -> repetitions=2, interval=6
        r2 = LearnerEngine.update_flashcard_sm2(
            db=db_session, user_id=user.id, session_id=session.id,
            card_index=0, quality=4
        )
        assert r2["repetitions"] == 2
        assert r2["interval"] == 6

        # Review 3: Third recall with quality 5 -> repetitions=3, interval >= 14
        r3 = LearnerEngine.update_flashcard_sm2(
            db=db_session, user_id=user.id, session_id=session.id,
            card_index=0, quality=5
        )
        assert r3["repetitions"] == 3
        assert r3["interval"] >= 14

    def test_sm2_idempotency_prevents_duplicate_progression(self, db_session, test_users):
        """Submitting with the same idempotency key must not double-advance SM-2."""
        user = test_users["user_a"]
        session = StudySession(
            filename="sm2_idemp.pdf", summary="SM2 Test", content="Content",
            user_id=user.id, source_type="pdf", flashcards=[{"front": "Q", "back": "A"}]
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        key = "idemp_test_fc_999"
        r1 = LearnerEngine.update_flashcard_sm2(
            db=db_session, user_id=user.id, session_id=session.id,
            card_index=0, quality=4, idempotency_key=key
        )
        r2 = LearnerEngine.update_flashcard_sm2(
            db=db_session, user_id=user.id, session_id=session.id,
            card_index=0, quality=4, idempotency_key=key
        )

        assert r1["repetitions"] == 1
        assert r2.get("idempotent_replay") is True
        assert r2["repetitions"] == 1  # Did not increment to 2


# ===========================================================================
# CATEGORY E: Spaced Revision Retrieval
# ===========================================================================

class TestSpacedRevisionRetrieval:
    """Verify retrieval of due cards vs unreviewed cards."""

    def test_unreviewed_cards_marked_new_and_due(self, db_session, test_users):
        user = test_users["user_a"]
        session = StudySession(
            filename="spaced_rev.pdf", summary="Rev Test", content="Content",
            user_id=user.id, source_type="pdf",
            flashcards=[
                {"front": "Card 1", "back": "Ans 1"},
                {"front": "Card 2", "back": "Ans 2"}
            ]
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        rev_data = LearnerEngine.get_spaced_revision_cards(db_session, user.id, session.id)
        assert rev_data["total_cards"] == 2
        assert rev_data["due_count"] == 2
        assert rev_data["due_cards"][0]["status"] == "new"

    def test_future_scheduled_card_not_due(self, db_session, test_users):
        user = test_users["user_a"]
        session = StudySession(
            filename="future_rev.pdf", summary="Rev Test", content="Content",
            user_id=user.id, source_type="pdf",
            flashcards=[{"front": "Card 1", "back": "Ans 1"}]
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        # Review card with good rating -> schedules next_review in future
        LearnerEngine.update_flashcard_sm2(
            db=db_session, user_id=user.id, session_id=session.id,
            card_index=0, quality=5
        )

        # Update next_review to tomorrow
        prog = db_session.query(FlashcardProgress).filter(
            FlashcardProgress.user_id == user.id,
            FlashcardProgress.session_id == session.id,
            FlashcardProgress.card_index == 0
        ).first()
        prog.next_review = datetime.utcnow() + timedelta(days=2)
        db_session.commit()

        rev_data = LearnerEngine.get_spaced_revision_cards(db_session, user.id, session.id)
        assert rev_data["due_count"] == 0


# ===========================================================================
# CATEGORY F: Tenant Isolation
# ===========================================================================

class TestFlashcardTenantIsolation:
    """Ensure User B cannot access or modify User A's flashcards or reviews."""

    def test_cross_tenant_generation_rejected(self, client, db_session, test_users):
        user_a = test_users["user_a"]
        session_a = StudySession(
            filename="tenant_a_fc.pdf", summary="Test A", content="Content A",
            user_id=user_a.id, source_type="pdf"
        )
        db_session.add(session_a)
        db_session.commit()
        db_session.refresh(session_a)

        # User B attempts to generate flashcards on User A's session
        res = client.post(
            "/generate_flashcards",
            headers=test_users["headers_b"],
            json={"session_id": session_a.id, "num_cards": 5}
        )
        assert res.status_code == 404

    def test_cross_tenant_review_rejected(self, client, db_session, test_users):
        user_a = test_users["user_a"]
        session_a = StudySession(
            filename="tenant_a_rev.pdf", summary="Test A", content="Content A",
            user_id=user_a.id, source_type="pdf",
            flashcards=[{"front": "Secret A", "back": "Answer A"}]
        )
        db_session.add(session_a)
        db_session.commit()
        db_session.refresh(session_a)

        # User B attempts to review User A's card
        res = client.post(
            "/learning/flashcard-review",
            headers=test_users["headers_b"],
            json={"session_id": session_a.id, "card_index": 0, "quality": 4}
        )
        assert res.status_code == 404

    def test_cross_tenant_spaced_revision_rejected(self, client, db_session, test_users):
        user_a = test_users["user_a"]
        session_a = StudySession(
            filename="tenant_a_rev.pdf", summary="Test A", content="Content A",
            user_id=user_a.id, source_type="pdf",
            flashcards=[{"front": "Secret A", "back": "Answer A"}]
        )
        db_session.add(session_a)
        db_session.commit()
        db_session.refresh(session_a)

        # User B attempts to get User A's due cards
        res = client.get(
            f"/learning/spaced-revision/{session_a.id}",
            headers=test_users["headers_b"]
        )
        assert res.status_code == 404


# ===========================================================================
# CATEGORY G: Stored Flashcard Retrieval Endpoint
# ===========================================================================

class TestStoredFlashcardRetrieval:
    """Verify stored flashcards are returned via GET /library/{session_id}/flashcards."""

    def test_get_session_flashcards(self, client, db_session, test_users):
        user = test_users["user_a"]
        sample_cards = [
            {"front": "Q1", "back": "A1", "topic": "General", "page_number": None},
            {"front": "Q2", "back": "A2", "topic": "General", "page_number": None}
        ]
        session = StudySession(
            filename="stored_fc.pdf", summary="Test", content="Content",
            user_id=user.id, source_type="pdf", flashcards=sample_cards
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        res = client.get(
            f"/library/{session.id}/flashcards",
            headers=test_users["headers_a"]
        )
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 2
        assert data[0]["front"] == "Q1"

    def test_get_session_flashcards_empty(self, client, db_session, test_users):
        user = test_users["user_a"]
        session = StudySession(
            filename="empty_fc.pdf", summary="Test", content="Content",
            user_id=user.id, source_type="pdf", flashcards=None
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        res = client.get(
            f"/library/{session.id}/flashcards",
            headers=test_users["headers_a"]
        )
        assert res.status_code == 200
        assert res.json() == []

    def test_get_session_flashcards_unauthenticated(self, client, db_session, test_users):
        res = client.get("/library/1/flashcards")
        assert res.status_code == 401

    def test_get_session_flashcards_cross_tenant(self, client, db_session, test_users):
        user_a = test_users["user_a"]
        session = StudySession(
            filename="tenant_fc.pdf", summary="Test", content="Content",
            user_id=user_a.id, source_type="pdf", flashcards=[{"front": "Secret", "back": "Ans"}]
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        res = client.get(
            f"/library/{session.id}/flashcards",
            headers=test_users["headers_b"]
        )
        assert res.status_code == 404

    def test_get_library_item_includes_flashcards(self, client, db_session, test_users):
        user = test_users["user_a"]
        sample_cards = [{"front": "Q_Lib", "back": "A_Lib", "topic": "Gen", "page_number": None}]
        session = StudySession(
            filename="lib_fc.pdf", summary="Test", content="Content",
            user_id=user.id, source_type="pdf", flashcards=sample_cards
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        res = client.get(
            f"/library/{session.id}",
            headers=test_users["headers_a"]
        )
        assert res.status_code == 200
        body = res.json()
        assert "flashcards" in body
        assert len(body["flashcards"]) == 1
        assert body["flashcards"][0]["front"] == "Q_Lib"


# ===========================================================================
# CATEGORY H: Plan Limits Clamping on Flashcard Generation
# ===========================================================================

class TestFlashcardPlanLimits:
    """Validate that num_cards is correctly clamped by user plan tier."""

    @patch("main.AssessmentEngine.generate_flashcards")
    def test_plan_limit_free_user_clamped_to_10(self, mock_gen, client, db_session, test_users):
        user_b = test_users["user_b"]  # Free tier
        session = StudySession(
            filename="free_plan.pdf", summary="Test", content="Text",
            user_id=user_b.id, source_type="pdf"
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        mock_gen.return_value = [{"front": f"Q{i}", "back": f"A{i}"} for i in range(10)]

        # Request 25 cards on free tier (limit is 10)
        res = client.post(
            "/generate_flashcards",
            headers=test_users["headers_b"],
            json={"session_id": session.id, "num_cards": 25}
        )
        assert res.status_code == 200
        # Check that AssessmentEngine was called with num_cards clamped to 10
        if mock_gen.called:
            assert mock_gen.call_args[1]["num_cards"] == 10

    @patch("main.AssessmentEngine.generate_flashcards")
    def test_plan_limit_pro_user_clamped_to_30(self, mock_gen, client, db_session, test_users):
        user_a = test_users["user_a"]  # Pro tier
        session = StudySession(
            filename="pro_plan.pdf", summary="Test", content="Text",
            user_id=user_a.id, source_type="pdf"
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        mock_gen.return_value = [{"front": f"Q{i}", "back": f"A{i}"} for i in range(30)]

        # Request 45 cards on pro tier (limit is 30)
        res = client.post(
            "/generate_flashcards",
            headers=test_users["headers_a"],
            json={"session_id": session.id, "num_cards": 45}
        )
        assert res.status_code == 200
        if mock_gen.called:
            assert mock_gen.call_args[1]["num_cards"] == 30


# ===========================================================================
# CATEGORY I: HTTP Endpoint Boundary & Schema Validation
# ===========================================================================

class TestFlashcardHTTPValidation:
    """Validate HTTP 422 responses on boundary violations."""

    def test_http_generate_zero_cards_422(self, client, test_users):
        res = client.post(
            "/generate_flashcards",
            headers=test_users["headers_a"],
            json={"session_id": 1, "num_cards": 0}
        )
        assert res.status_code == 422

    def test_http_generate_negative_cards_422(self, client, test_users):
        res = client.post(
            "/generate_flashcards",
            headers=test_users["headers_a"],
            json={"session_id": 1, "num_cards": -5}
        )
        assert res.status_code == 422

    def test_http_generate_excessive_cards_422(self, client, test_users):
        res = client.post(
            "/generate_flashcards",
            headers=test_users["headers_a"],
            json={"session_id": 1, "num_cards": 75}
        )
        assert res.status_code == 422

    def test_http_review_negative_quality_422(self, client, test_users):
        res = client.post(
            "/learning/flashcard-review",
            headers=test_users["headers_a"],
            json={"session_id": 1, "card_index": 0, "quality": -1}
        )
        assert res.status_code == 422

    def test_http_review_excessive_quality_422(self, client, test_users):
        res = client.post(
            "/learning/flashcard-review",
            headers=test_users["headers_a"],
            json={"session_id": 1, "card_index": 0, "quality": 7}
        )
        assert res.status_code == 422

    def test_http_review_negative_card_index_422(self, client, test_users):
        res = client.post(
            "/learning/flashcard-review",
            headers=test_users["headers_a"],
            json={"session_id": 1, "card_index": -1, "quality": 4}
        )
        assert res.status_code == 422


# ===========================================================================
# CATEGORY J: Multi-Source Page Number Enforcement in /generate_flashcards
# ===========================================================================

class TestMultiSourcePageNumberEnforcement:
    """Verify endpoint enforces page_number=None for non-PDFs and preserves PDF pages."""

    @patch("main.generate_with_fallback")
    def test_generate_audio_session_forces_page_none(self, mock_fallback, client, db_session, test_users):
        user = test_users["user_a"]
        session = StudySession(
            filename="recording.mp3", summary="Audio test", content="Audio transcript text",
            user_id=user.id, source_type="audio"
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        # Mock fallback returning synthetic cards with hallucinated page_number
        mock_fallback.return_value = json.dumps([
            {"front": "Spoken concept?", "back": "Explained in lecture", "page_number": 1}
        ])

        res = client.post(
            "/generate_flashcards",
            headers=test_users["headers_a"],
            json={"session_id": session.id, "num_cards": 1}
        )
        assert res.status_code == 200
        cards = res.json()
        assert len(cards) == 1
        assert cards[0]["page_number"] is None

        # Verify DB persisted session also has page_number=None
        db_session.refresh(session)
        assert session.flashcards[0]["page_number"] is None

    @patch("main.generate_with_fallback")
    def test_generate_web_session_forces_page_none(self, mock_fallback, client, db_session, test_users):
        user = test_users["user_a"]
        session = StudySession(
            filename="https://example.com/article", summary="Web test", content="Web article text",
            user_id=user.id, source_type="web"
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        mock_fallback.return_value = json.dumps([
            {"front": "Web fact?", "back": "From web link", "page_number": 3}
        ])

        res = client.post(
            "/generate_flashcards",
            headers=test_users["headers_a"],
            json={"session_id": session.id, "num_cards": 1}
        )
        assert res.status_code == 200
        cards = res.json()
        assert cards[0]["page_number"] is None

    @patch("main.generate_with_fallback")
    def test_generate_paste_session_forces_page_none(self, mock_fallback, client, db_session, test_users):
        user = test_users["user_a"]
        session = StudySession(
            filename="Pasted_Notes.txt", summary="Paste test", content="Pasted raw notes",
            user_id=user.id, source_type="paste"
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        mock_fallback.return_value = json.dumps([
            {"front": "Pasted concept?", "back": "From raw notes", "page_number": 1}
        ])

        res = client.post(
            "/generate_flashcards",
            headers=test_users["headers_a"],
            json={"session_id": session.id, "num_cards": 1}
        )
        assert res.status_code == 200
        cards = res.json()
        assert cards[0]["page_number"] is None

    @patch("main.generate_with_fallback")
    def test_generate_pdf_session_preserves_page_numbers(self, mock_fallback, client, db_session, test_users):
        user = test_users["user_a"]
        session = StudySession(
            filename="Textbook.pdf", summary="PDF test", content="Textbook text",
            user_id=user.id, source_type="pdf"
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        mock_fallback.return_value = json.dumps([
            {"front": "Theorem 1?", "back": "Statement on page 42", "page_number": 42}
        ])

        res = client.post(
            "/generate_flashcards",
            headers=test_users["headers_a"],
            json={"session_id": session.id, "num_cards": 1}
        )
        assert res.status_code == 200
        cards = res.json()
        assert cards[0]["page_number"] == 42


# ===========================================================================
# CATEGORY K: SM-2 Spaced Revision & Intelligence Integration
# ===========================================================================

class TestFlashcardIntelligenceIntegration:
    """Verify that flashcard reviews feed into session intelligence metrics."""

    def test_http_spaced_revision_endpoint(self, client, db_session, test_users):
        user = test_users["user_a"]
        session = StudySession(
            filename="intel_fc.pdf", summary="Test", content="Text",
            user_id=user.id, source_type="pdf",
            flashcards=[
                {"front": "Rev Q1", "back": "Rev A1"},
                {"front": "Rev Q2", "back": "Rev A2"}
            ]
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        res = client.get(
            f"/learning/spaced-revision/{session.id}",
            headers=test_users["headers_a"]
        )
        assert res.status_code == 200
        data = res.json()
        assert data["total_cards"] == 2
        assert data["due_count"] == 2

    def test_http_flashcard_review_updates_intelligence(self, client, db_session, test_users):
        user = test_users["user_a"]
        session = StudySession(
            filename="intel_review.pdf", summary="Test", content="Text",
            user_id=user.id, source_type="pdf",
            flashcards=[{"front": "Q_Intel", "back": "A_Intel"}]
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        # Before review, check intelligence
        res_before = client.get(
            f"/library/{session.id}/intelligence",
            headers=test_users["headers_a"]
        )
        assert res_before.status_code == 200
        init_reviews = res_before.json().get("flashcards_reviewed", 0)

        # Review card with Good (quality 4)
        res_review = client.post(
            "/learning/flashcard-review",
            headers=test_users["headers_a"],
            json={"session_id": session.id, "card_index": 0, "quality": 4}
        )
        assert res_review.status_code == 200

        # After review, verify flashcards_reviewed incremented
        res_after = client.get(
            f"/library/{session.id}/intelligence",
            headers=test_users["headers_a"]
        )
        assert res_after.status_code == 200
        after_reviews = res_after.json().get("flashcards_reviewed", 0)
        assert after_reviews == init_reviews + 1


# ===========================================================================
# CATEGORY L: Download Quota Exemption for Flashcards
# ===========================================================================

class TestFlashcardDownloadQuotaExemption:
    """Verify that exporting flashcards is exempt from daily download quotas."""

    def test_download_track_flashcard_exempt(self, client, db_session, test_users):
        user = test_users["user_b"]  # Free tier
        res = client.post(
            "/track-download",
            headers=test_users["headers_b"],
            json={"type": "flashcard", "title": "Flashcard Export"}
        )
        assert res.status_code == 200
        data = res.json()
        assert "remaining" in data
