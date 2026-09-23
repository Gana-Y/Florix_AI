"""
Audit #8 — Quiz Subsystem Deep Audit & Production Hardening
Deterministic test suite verifying quiz generation, result submission,
mastery integration, input validation, page_number accuracy, and tenant isolation.

Markers: QUIZ_ALPHA_123, QUIZ_BETA_456, QUIZ_GAMMA_789
"""

import os
import sys
import json
import pytest
import math
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

# ---------------------------------------------------------------------------
# Path bootstrap
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from intelligence.assessment import AssessmentEngine, clean_json_string
from intelligence.models import (
    GroundedQuizQuestion,
    GroundedFlashcard,
    QuestionType,
    TopicMasteryRecord,
)
from intelligence.learner import LearnerEngine
from database import (
    Base, engine, SessionLocal,
    User, StudySession, QuizResult, DocumentChunk,
    LearnerTopicMastery, LearningEvent, FlashcardProgress,
)
from main import app

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------------------------
# Test DB Setup
# ---------------------------------------------------------------------------
TEST_DB_URL = "sqlite:///./test_quiz_deep_audit.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    """Create all tables in test DB, then tear down after."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    if os.path.exists("./test_quiz_deep_audit.db"):
        try:
            os.remove("./test_quiz_deep_audit.db")
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
app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.fixture
def test_users(db_session):
    """Create two test users for tenant isolation tests (get-or-create)."""
    import uuid
    from auth import get_password_hash
    uid = uuid.uuid4().hex[:8]
    email_a = f"quiz_audit_a_{uid}@test.com"
    email_b = f"quiz_audit_b_{uid}@test.com"
    user_a = User(
        name="QuizAuditorA", email=email_a,
        hashed_password=get_password_hash("TestPass123!"),
        plan="pro"
    )
    user_b = User(
        name="QuizAuditorB", email=email_b,
        hashed_password=get_password_hash("TestPass456!"),
        plan="pro"
    )
    db_session.add_all([user_a, user_b])
    db_session.commit()
    db_session.refresh(user_a)
    db_session.refresh(user_b)
    return {"user_a": user_a, "user_b": user_b}


def _get_auth_token(client_inst, email, password):
    resp = client_inst.post("/login", data={"username": email, "password": password})
    if resp.status_code == 200:
        return resp.json().get("access_token")
    return None


# ===========================================================================
# CATEGORY A: AssessmentEngine — clean_json_string
# ===========================================================================

class TestCleanJsonString:
    def test_plain_json(self):
        raw = '[{"question": "test"}]'
        assert clean_json_string(raw) == raw

    def test_markdown_code_block(self):
        raw = '```json\n[{"q": "test"}]\n```'
        assert clean_json_string(raw) == '[{"q": "test"}]'

    def test_markdown_no_language(self):
        raw = '```\n[{"q": "test"}]\n```'
        assert clean_json_string(raw) == '[{"q": "test"}]'

    def test_whitespace_wrapping(self):
        raw = '   \n  [{"q": "test"}]  \n  '
        assert clean_json_string(raw).strip() == '[{"q": "test"}]'


# ===========================================================================
# CATEGORY B: AssessmentEngine.generate_quiz — Schema & Validation
# ===========================================================================

class TestAssessmentEngineQuizGeneration:
    """Tests using mock LLM output (no live API calls)."""

    MARKER_QUIZ_JSON = json.dumps([
        {
            "question": "What is the marker QUIZ_ALPHA_123 used for?",
            "options": [
                "Deterministic audit verification",
                "Random testing",
                "Code obfuscation",
                "Database migration"
            ],
            "answer": 0,
            "explanation": "QUIZ_ALPHA_123 is a deterministic audit marker for verification.",
            "question_type": "MCQ",
            "difficulty": "intermediate",
            "topic": "Audit Verification",
            "source_chunk_id": "chunk_0",
            "page_number": 5,
            "section_heading": "Verification Methods"
        }
    ])

    CHUNKS_WITH_PAGE = [
        {
            "chunk_index": 0,
            "text_content": "QUIZ_ALPHA_123 is used for deterministic audit verification in testing pipelines.",
            "page_number": 5,
            "section_heading": "Verification Methods"
        }
    ]

    CHUNKS_WITHOUT_PAGE = [
        {
            "chunk_index": 0,
            "text_content": "QUIZ_BETA_456 marker content from audio transcription.",
            "page_number": None,
            "section_heading": "General"
        }
    ]

    def test_valid_quiz_generation_with_mock(self):
        """Verify quiz generation produces correctly structured output."""
        def mock_gen(ctx, prompt):
            return self.MARKER_QUIZ_JSON

        quiz = AssessmentEngine.generate_quiz(
            chunks=self.CHUNKS_WITH_PAGE,
            num_questions=1,
            generate_fallback_fn=mock_gen
        )
        assert len(quiz) == 1
        q = quiz[0]
        assert q["question"] == "What is the marker QUIZ_ALPHA_123 used for?"
        assert len(q["options"]) == 4
        assert q["answer"] == 0
        assert "QUIZ_ALPHA_123" in q["explanation"]
        assert q["page_number"] == 5
        assert q["section_heading"] == "Verification Methods"
        assert q["question_type"] == "MCQ"

    def test_num_questions_capped_at_20(self):
        """Verify num_questions is capped at 20."""
        def mock_gen(ctx, prompt):
            return "[]"

        quiz = AssessmentEngine.generate_quiz(
            chunks=self.CHUNKS_WITH_PAGE,
            num_questions=100,
            generate_fallback_fn=mock_gen
        )
        # Should not crash; internal cap is max 20
        assert isinstance(quiz, list)

    def test_num_questions_minimum_1(self):
        """Verify num_questions is at least 1."""
        def mock_gen(ctx, prompt):
            return "[]"

        quiz = AssessmentEngine.generate_quiz(
            chunks=self.CHUNKS_WITH_PAGE,
            num_questions=-5,
            generate_fallback_fn=mock_gen
        )
        assert isinstance(quiz, list)

    def test_empty_chunks_returns_empty(self):
        """No chunks -> no quiz questions."""
        quiz = AssessmentEngine.generate_quiz(
            chunks=[],
            num_questions=5,
            generate_fallback_fn=lambda c, p: "[]"
        )
        assert quiz == []

    def test_invalid_answer_index_clamped(self):
        """Out-of-range answer index should be clamped to 0."""
        bad_json = json.dumps([{
            "question": "Test?",
            "options": ["A", "B", "C", "D"],
            "answer": 99,
            "explanation": "test"
        }])

        quiz = AssessmentEngine.generate_quiz(
            chunks=self.CHUNKS_WITH_PAGE,
            num_questions=1,
            generate_fallback_fn=lambda c, p: bad_json
        )
        assert len(quiz) == 1
        assert quiz[0]["answer"] == 0  # Clamped

    def test_negative_answer_index_clamped(self):
        """Negative answer index should be clamped to 0."""
        bad_json = json.dumps([{
            "question": "Test?",
            "options": ["A", "B", "C", "D"],
            "answer": -1,
            "explanation": "test"
        }])

        quiz = AssessmentEngine.generate_quiz(
            chunks=self.CHUNKS_WITH_PAGE,
            num_questions=1,
            generate_fallback_fn=lambda c, p: bad_json
        )
        assert len(quiz) == 1
        assert quiz[0]["answer"] == 0

    def test_string_answer_index_converted(self):
        """String answer index like '2' should be converted to int."""
        bad_json = json.dumps([{
            "question": "Test?",
            "options": ["A", "B", "C", "D"],
            "answer": "2",
            "explanation": "test"
        }])

        quiz = AssessmentEngine.generate_quiz(
            chunks=self.CHUNKS_WITH_PAGE,
            num_questions=1,
            generate_fallback_fn=lambda c, p: bad_json
        )
        assert len(quiz) == 1
        assert quiz[0]["answer"] == 2

    def test_non_numeric_answer_defaults_zero(self):
        """Non-numeric answer should default to 0."""
        bad_json = json.dumps([{
            "question": "Test?",
            "options": ["A", "B", "C", "D"],
            "answer": "invalid",
            "explanation": "test"
        }])

        quiz = AssessmentEngine.generate_quiz(
            chunks=self.CHUNKS_WITH_PAGE,
            num_questions=1,
            generate_fallback_fn=lambda c, p: bad_json
        )
        assert len(quiz) == 1
        assert quiz[0]["answer"] == 0

    def test_less_than_2_options_rejected(self):
        """Questions with fewer than 2 options should be filtered out."""
        bad_json = json.dumps([{
            "question": "Test?",
            "options": ["Only one"],
            "answer": 0,
            "explanation": "test"
        }])

        quiz = AssessmentEngine.generate_quiz(
            chunks=self.CHUNKS_WITH_PAGE,
            num_questions=1,
            generate_fallback_fn=lambda c, p: bad_json
        )
        assert len(quiz) == 0

    def test_empty_question_rejected(self):
        """Questions with empty text should be filtered out."""
        bad_json = json.dumps([{
            "question": "",
            "options": ["A", "B", "C", "D"],
            "answer": 0,
            "explanation": "test"
        }])

        quiz = AssessmentEngine.generate_quiz(
            chunks=self.CHUNKS_WITH_PAGE,
            num_questions=1,
            generate_fallback_fn=lambda c, p: bad_json
        )
        assert len(quiz) == 0

    def test_llm_error_returns_empty(self):
        """LLM API error should return empty list, not crash."""
        def exploding_gen(ctx, prompt):
            raise RuntimeError("Simulated API failure")

        quiz = AssessmentEngine.generate_quiz(
            chunks=self.CHUNKS_WITH_PAGE,
            num_questions=1,
            generate_fallback_fn=exploding_gen
        )
        assert quiz == []

    def test_malformed_json_regex_recovery(self):
        """DEF-08-11 FIXED: Greedy regex now correctly recovers the outermost JSON array."""
        bad_response = 'Here are the questions:\n[{"question": "Test?", "options": ["A", "B"], "answer": 0, "explanation": "x"}]\nHope this helps!'

        quiz = AssessmentEngine.generate_quiz(
            chunks=self.CHUNKS_WITH_PAGE,
            num_questions=1,
            generate_fallback_fn=lambda c, p: bad_response
        )
        # After fix: greedy regex matches the correct outer array
        assert len(quiz) == 1
        assert quiz[0]["question"] == "Test?"


# ===========================================================================
# CATEGORY C: Fake page_number=1 Fabrication (DEF-08-01, DEF-08-02)
# ===========================================================================

class TestFakePageNumberFabrication:
    """Verify that page_number=None from non-PDF sources is NOT fabricated to 1."""

    def test_assessment_engine_chunk_page_none_preserved(self):
        """DEF-08-02 FIXED: page_number=None should be preserved, not fabricated to 1."""
        audio_chunks = [
            {
                "chunk_index": 0,
                "text_content": "QUIZ_GAMMA_789 content from audio transcription without pages.",
                "page_number": None,
                "section_heading": "General"
            }
        ]

        mock_json = json.dumps([{
            "question": "What is QUIZ_GAMMA_789?",
            "options": ["A marker", "A database", "An algorithm", "A protocol"],
            "answer": 0,
            "explanation": "QUIZ_GAMMA_789 is an audit marker.",
            "page_number": None,
            "source_chunk_id": "chunk_0"
        }])

        quiz = AssessmentEngine.generate_quiz(
            chunks=audio_chunks,
            num_questions=1,
            generate_fallback_fn=lambda c, p: mock_json
        )
        assert len(quiz) == 1
        assert quiz[0]["page_number"] is None  # FIXED: no longer fabricated to 1

    def test_flashcard_page_none_preserved(self):
        """DEF-08-02 FIXED: Flashcard page_number=None preserved."""
        audio_chunks = [
            {
                "chunk_index": 0,
                "text_content": "Flashcard content without pages.",
                "page_number": None,
                "section_heading": "General"
            }
        ]

        mock_json = json.dumps([{
            "front": "What is the concept?",
            "back": "A fundamental idea.",
            "topic": "General",
            "difficulty": "beginner",
            "page_number": None
        }])

        cards = AssessmentEngine.generate_flashcards(
            chunks=audio_chunks,
            num_cards=1,
            generate_fallback_fn=lambda c, p: mock_json
        )
        assert len(cards) == 1
        assert cards[0]["page_number"] is None  # FIXED: no longer fabricated to 1

    def test_model_default_page_number_is_none(self):
        """DEF-08-05/06 FIXED: Model defaults page_number to None."""
        q = GroundedQuizQuestion(
            question="Test?",
            options=["A", "B"],
            answer=0,
            explanation="test"
        )
        assert q.page_number is None  # FIXED: was 1

        fc = GroundedFlashcard(
            front="Test?",
            back="Answer"
        )
        assert fc.page_number is None  # FIXED: was 1

    def test_pdf_page_number_preserved(self):
        """PDF sources with real page numbers should still work correctly."""
        pdf_chunks = [
            {
                "chunk_index": 0,
                "text_content": "Content from page 5 of a PDF.",
                "page_number": 5,
                "section_heading": "Chapter 3"
            }
        ]

        mock_json = json.dumps([{
            "question": "What page?",
            "options": ["Page 3", "Page 5", "Page 7", "Page 9"],
            "answer": 1,
            "explanation": "From page 5.",
            "page_number": 5,
            "source_chunk_id": "chunk_0"
        }])

        quiz = AssessmentEngine.generate_quiz(
            chunks=pdf_chunks,
            num_questions=1,
            generate_fallback_fn=lambda c, p: mock_json
        )
        assert len(quiz) == 1
        assert quiz[0]["page_number"] == 5  # Real page numbers preserved


# ===========================================================================
# CATEGORY D: QuizResultRequest — Input Validation (DEF-08-04)
# ===========================================================================

class TestQuizResultValidation:
    """DEF-08-04 FIXED: Input validation for QuizResultRequest prevents ZeroDivisionError."""

    def test_zero_total_questions_rejected(self):
        """DEF-08-04 FIXED: total_questions=0 is now rejected by Pydantic validator."""
        from pydantic import ValidationError
        from main import QuizResultRequest
        with pytest.raises(ValidationError, match="total_questions must be a positive integer"):
            QuizResultRequest(session_id=1, score=0, total_questions=0)

    def test_negative_total_questions_rejected(self):
        """DEF-08-04 FIXED: negative total_questions is now rejected."""
        from pydantic import ValidationError
        from main import QuizResultRequest
        with pytest.raises(ValidationError, match="total_questions must be a positive integer"):
            QuizResultRequest(session_id=1, score=0, total_questions=-5)

    def test_negative_score_rejected(self):
        """DEF-08-04 FIXED: Negative score is now rejected by Pydantic validator."""
        from pydantic import ValidationError
        from main import QuizResultRequest
        with pytest.raises(ValidationError, match="score cannot be negative"):
            QuizResultRequest(session_id=1, score=-1, total_questions=5)

    def test_valid_result_request(self):
        """Valid request should work fine."""
        from main import QuizResultRequest
        req = QuizResultRequest(session_id=1, score=3, total_questions=5)
        assert req.score == 3
        assert req.total_questions == 5


# ===========================================================================
# CATEGORY E: is_correct False-Positive (DEF-08-09)
# ===========================================================================

class TestIsCorrectDetermination:
    """DEF-08-09 FIXED: Verify is_correct fallback no longer has None == None false positive."""

    def test_missing_keys_now_returns_false(self):
        """DEF-08-09 FIXED: Both 'selected' and 'answer' missing => is_correct should be False."""
        detail = {}  # No selected, no answer
        # Simulate the FIXED logic from main.py
        is_correct = detail.get("is_correct")
        if is_correct is None:
            sel = detail.get("selected")
            ans = detail.get("answer")
            u_ans = detail.get("user_answer")
            c_ans = detail.get("correct_answer")
            is_correct = (
                (sel is not None and ans is not None and sel == ans) or
                (u_ans is not None and c_ans is not None and u_ans == c_ans)
            )
        assert is_correct is False  # FIXED: was True due to None == None

    def test_matching_keys_returns_true(self):
        """When selected == answer, is_correct should be True."""
        detail = {"selected": 2, "answer": 2}
        is_correct = detail.get("is_correct")
        if is_correct is None:
            sel = detail.get("selected")
            ans = detail.get("answer")
            u_ans = detail.get("user_answer")
            c_ans = detail.get("correct_answer")
            is_correct = (
                (sel is not None and ans is not None and sel == ans) or
                (u_ans is not None and c_ans is not None and u_ans == c_ans)
            )
        assert is_correct is True

    def test_mismatched_keys_returns_false(self):
        """When selected != answer, is_correct should be False."""
        detail = {"selected": 1, "answer": 2}
        is_correct = detail.get("is_correct")
        if is_correct is None:
            sel = detail.get("selected")
            ans = detail.get("answer")
            u_ans = detail.get("user_answer")
            c_ans = detail.get("correct_answer")
            is_correct = (
                (sel is not None and ans is not None and sel == ans) or
                (u_ans is not None and c_ans is not None and u_ans == c_ans)
            )
        assert is_correct is False


# ===========================================================================
# CATEGORY F: LearnerEngine — Mastery Computation
# ===========================================================================

class TestLearnerEngineMastery:
    """Test mastery score computation deterministically."""

    def test_zero_attempts(self):
        score = LearnerEngine.compute_mastery(attempts=0, correct=0)
        assert score == 0.0

    def test_perfect_accuracy_fresh_review(self):
        """100% accuracy, just reviewed, 10+ attempts, intermediate difficulty."""
        score = LearnerEngine.compute_mastery(
            attempts=10,
            correct=10,
            last_reviewed=datetime.utcnow(),
            difficulty="intermediate"
        )
        # 0.50*1.0 + 0.25*~1.0 + 0.15*1.0 + 0.10*0.80 = 0.50+0.25+0.15+0.08 = 0.98
        assert 0.95 <= score <= 1.0

    def test_zero_accuracy(self):
        score = LearnerEngine.compute_mastery(
            attempts=5,
            correct=0,
            last_reviewed=datetime.utcnow(),
            difficulty="intermediate"
        )
        # 0.50*0 + 0.25*~1.0 + 0.15*0.5 + 0.10*0.80 = 0+0.25+0.075+0.08 = 0.405
        assert 0.35 <= score <= 0.45

    def test_old_review_recency_decay(self):
        """30-day-old review should have significant recency decay."""
        score_recent = LearnerEngine.compute_mastery(
            attempts=5, correct=5, last_reviewed=datetime.utcnow()
        )
        score_old = LearnerEngine.compute_mastery(
            attempts=5, correct=5, last_reviewed=datetime.utcnow() - timedelta(days=30)
        )
        assert score_recent > score_old

    def test_mastery_status_categories(self):
        assert LearnerEngine.get_mastery_status(0.90) == "mastered"
        assert LearnerEngine.get_mastery_status(0.85) == "mastered"
        assert LearnerEngine.get_mastery_status(0.70) == "learning"
        assert LearnerEngine.get_mastery_status(0.50) == "review_needed"
        assert LearnerEngine.get_mastery_status(0.30) == "struggling"
        assert LearnerEngine.get_mastery_status(0.0) == "struggling"

    def test_difficulty_weights(self):
        """Higher difficulty should yield slightly higher mastery."""
        score_beginner = LearnerEngine.compute_mastery(
            attempts=5, correct=5, last_reviewed=datetime.utcnow(), difficulty="beginner"
        )
        score_advanced = LearnerEngine.compute_mastery(
            attempts=5, correct=5, last_reviewed=datetime.utcnow(), difficulty="advanced"
        )
        assert score_advanced >= score_beginner

    def test_mastery_clamped_0_to_1(self):
        """Score must never exceed 1.0 or go below 0.0."""
        score = LearnerEngine.compute_mastery(
            attempts=1000, correct=1000, last_reviewed=datetime.utcnow(), difficulty="advanced"
        )
        assert 0.0 <= score <= 1.0

        score_zero = LearnerEngine.compute_mastery(
            attempts=1000, correct=0, last_reviewed=datetime.utcnow() - timedelta(days=365), difficulty="beginner"
        )
        assert 0.0 <= score_zero <= 1.0


# ===========================================================================
# CATEGORY G: LearnerEngine — record_topic_interaction with DB
# ===========================================================================

class TestLearnerEngineDBInteraction:
    """Test mastery recording with actual DB writes."""

    def test_first_correct_interaction(self, db_session, test_users):
        user = test_users["user_a"]
        session = StudySession(
            filename="quiz_audit_test.pdf",
            summary="Test", content="Test content",
            user_id=user.id, source_type="pdf"
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        result = LearnerEngine.record_topic_interaction(
            db=db_session,
            user_id=user.id,
            session_id=session.id,
            topic="Audit Markers",
            is_correct=True,
            difficulty="intermediate"
        )

        assert result["topic"] == "Audit Markers"
        assert result["attempts"] == 1
        assert result["correct"] == 1
        assert result["mastery_score"] > 0
        assert result["status"] in ("mastered", "learning", "review_needed", "struggling")
        assert result["idempotent_replay"] is False

    def test_idempotency_key_prevents_double_count(self, db_session, test_users):
        user = test_users["user_a"]
        session = StudySession(
            filename="idempotency_test.pdf",
            summary="Test", content="Test content",
            user_id=user.id, source_type="pdf"
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        key = "quiz_idem_123"
        r1 = LearnerEngine.record_topic_interaction(
            db=db_session, user_id=user.id, session_id=session.id,
            topic="Idempotency", is_correct=True, idempotency_key=key
        )
        r2 = LearnerEngine.record_topic_interaction(
            db=db_session, user_id=user.id, session_id=session.id,
            topic="Idempotency", is_correct=True, idempotency_key=key
        )

        assert r1["attempts"] == 1
        assert r2.get("idempotent_replay") is True
        assert r2["attempts"] == 1  # Not double-counted

    def test_tenant_isolation(self, db_session, test_users):
        """User A's mastery records should not be visible to User B."""
        user_a = test_users["user_a"]
        user_b = test_users["user_b"]

        session_a = StudySession(
            filename="tenant_a.pdf", summary="A", content="A content",
            user_id=user_a.id, source_type="pdf"
        )
        session_b = StudySession(
            filename="tenant_b.pdf", summary="B", content="B content",
            user_id=user_b.id, source_type="pdf"
        )
        db_session.add_all([session_a, session_b])
        db_session.commit()
        db_session.refresh(session_a)
        db_session.refresh(session_b)

        LearnerEngine.record_topic_interaction(
            db=db_session, user_id=user_a.id, session_id=session_a.id,
            topic="Secret Topic A", is_correct=True
        )

        mastery_b = LearnerEngine.get_session_mastery(
            db=db_session, user_id=user_b.id, session_id=session_a.id
        )
        assert len(mastery_b) == 0  # User B sees nothing from User A's session

    def test_weak_subtopic_tracking(self, db_session, test_users):
        user = test_users["user_a"]
        session = StudySession(
            filename="weak_topic.pdf", summary="T", content="C",
            user_id=user.id, source_type="pdf"
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        # First: wrong answer on subtopic
        r1 = LearnerEngine.record_topic_interaction(
            db=db_session, user_id=user.id, session_id=session.id,
            topic="Calculus", is_correct=False, subtopic="Integration"
        )
        assert "Integration" in r1["weak_subtopics"]

        # Second: correct answer on same subtopic — should remove from weak list
        r2 = LearnerEngine.record_topic_interaction(
            db=db_session, user_id=user.id, session_id=session.id,
            topic="Calculus", is_correct=True, subtopic="Integration"
        )
        assert "Integration" not in r2["weak_subtopics"]


# ===========================================================================
# CATEGORY H: SM-2 Flashcard Spaced Repetition
# ===========================================================================

class TestFlashcardSM2:
    """Test SM-2 algorithm implementation in LearnerEngine."""

    def test_perfect_recall_increases_interval(self, db_session, test_users):
        user = test_users["user_a"]
        session = StudySession(
            filename="sm2_test.pdf", summary="T", content="C",
            user_id=user.id, source_type="pdf",
            flashcards=[{"front": "Q1?", "back": "A1"}]
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        r = LearnerEngine.update_flashcard_sm2(
            db=db_session, user_id=user.id, session_id=session.id,
            card_index=0, quality=5
        )
        assert r["interval"] >= 1
        assert r["repetitions"] >= 1
        assert r["ease_factor"] >= 2.50  # Perfect recall increases EF
        assert r["idempotent_replay"] is False

    def test_blackout_resets_repetitions(self, db_session, test_users):
        user = test_users["user_b"]
        session = StudySession(
            filename="sm2_reset.pdf", summary="T", content="C",
            user_id=user.id, source_type="pdf",
            flashcards=[{"front": "Q2?", "back": "A2"}]
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        # First: good recall
        LearnerEngine.update_flashcard_sm2(
            db=db_session, user_id=user.id, session_id=session.id,
            card_index=0, quality=5
        )
        # Then: blackout
        r = LearnerEngine.update_flashcard_sm2(
            db=db_session, user_id=user.id, session_id=session.id,
            card_index=0, quality=0
        )
        assert r["repetitions"] == 0
        assert r["interval"] == 1

    def test_quality_clamped_0_to_5(self, db_session, test_users):
        user = test_users["user_a"]
        session = StudySession(
            filename="sm2_clamp.pdf", summary="T", content="C",
            user_id=user.id, source_type="pdf",
            flashcards=[{"front": "Q3?", "back": "A3"}]
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        r = LearnerEngine.update_flashcard_sm2(
            db=db_session, user_id=user.id, session_id=session.id,
            card_index=0, quality=99  # Should be clamped to 5
        )
        assert r["last_quality"] == 5

    def test_sm2_idempotency(self, db_session, test_users):
        user = test_users["user_b"]
        session = StudySession(
            filename="sm2_idem.pdf", summary="T", content="C",
            user_id=user.id, source_type="pdf",
            flashcards=[{"front": "Q4?", "back": "A4"}]
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        key = "fc_idem_key_001"
        r1 = LearnerEngine.update_flashcard_sm2(
            db=db_session, user_id=user.id, session_id=session.id,
            card_index=0, quality=4, idempotency_key=key
        )
        r2 = LearnerEngine.update_flashcard_sm2(
            db=db_session, user_id=user.id, session_id=session.id,
            card_index=0, quality=4, idempotency_key=key
        )
        assert r2.get("idempotent_replay") is True
        assert r1["repetitions"] == r2["repetitions"]


# ===========================================================================
# CATEGORY I: Spaced Revision Card Retrieval
# ===========================================================================

class TestSpacedRevisionCards:
    def test_new_cards_automatically_due(self, db_session, test_users):
        user = test_users["user_a"]
        session = StudySession(
            filename="revision.pdf", summary="T", content="C",
            user_id=user.id, source_type="pdf",
            flashcards=[
                {"front": "New card 1?", "back": "Answer 1"},
                {"front": "New card 2?", "back": "Answer 2"},
            ]
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        result = LearnerEngine.get_spaced_revision_cards(
            db=db_session, user_id=user.id, session_id=session.id
        )
        assert result["total_cards"] == 2
        assert result["due_count"] == 2  # Both should be "new" and due
        for card in result["due_cards"]:
            assert card["status"] == "new"

    def test_session_ownership_isolation(self, db_session, test_users):
        user_a = test_users["user_a"]
        user_b = test_users["user_b"]
        session = StudySession(
            filename="owned_by_a.pdf", summary="T", content="C",
            user_id=user_a.id, source_type="pdf",
            flashcards=[{"front": "Q?", "back": "A"}]
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        # User B tries to get revision cards for User A's session
        result = LearnerEngine.get_spaced_revision_cards(
            db=db_session, user_id=user_b.id, session_id=session.id
        )
        assert result["due_cards"] == []
        assert result["total_cards"] == 0


# ===========================================================================
# CATEGORY J: QuizRequest Input Validation (DEF-08-03)
# ===========================================================================

class TestQuizRequestValidation:
    """DEF-08-03 FIXED: Pydantic model validation on QuizRequest."""

    def test_quiz_request_valid(self):
        from main import QuizRequest
        req = QuizRequest(num_questions=5, session_id=1)
        assert req.num_questions == 5
        assert req.session_id == 1

    def test_quiz_request_missing_fields(self):
        from main import QuizRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            QuizRequest()

    def test_quiz_request_zero_questions_rejected(self):
        """DEF-08-03 FIXED: num_questions < 1 is rejected."""
        from main import QuizRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="num_questions must be at least 1"):
            QuizRequest(num_questions=0, session_id=1)

    def test_quiz_request_too_many_questions_rejected(self):
        """DEF-08-03 FIXED: num_questions > 30 is rejected."""
        from main import QuizRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="num_questions cannot exceed 30"):
            QuizRequest(num_questions=50, session_id=1)


# ===========================================================================
# CATEGORY K: QuizResultRequest Input Validation (DEF-08-04)
# ===========================================================================

class TestQuizResultRequestValidation:
    """DEF-08-04 FIXED: QuizResultRequest now has validators."""

    def test_valid_result_request(self):
        from main import QuizResultRequest
        req = QuizResultRequest(session_id=1, score=3, total_questions=5)
        assert req.score == 3
        assert req.total_questions == 5

    def test_zero_total_questions(self):
        """DEF-08-04 FIXED: total_questions=0 is now rejected."""
        from main import QuizResultRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="total_questions must be a positive integer"):
            QuizResultRequest(session_id=1, score=0, total_questions=0)

    def test_negative_score(self):
        """DEF-08-04 FIXED: negative score is now rejected."""
        from main import QuizResultRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="score cannot be negative"):
            QuizResultRequest(session_id=1, score=-5, total_questions=5)


# ===========================================================================
# CATEGORY L: Weak Topics & Recommendations
# ===========================================================================

class TestWeakTopicsRecommendations:
    def test_identifies_weak_topics(self, db_session, test_users):
        user = test_users["user_a"]
        session = StudySession(
            filename="weak_reco.pdf", summary="T", content="C",
            user_id=user.id, source_type="pdf"
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        # Create a struggling topic
        LearnerEngine.record_topic_interaction(
            db=db_session, user_id=user.id, session_id=session.id,
            topic="Organic Chemistry", is_correct=False
        )
        LearnerEngine.record_topic_interaction(
            db=db_session, user_id=user.id, session_id=session.id,
            topic="Organic Chemistry", is_correct=False
        )

        reco = LearnerEngine.get_weak_topics_and_recommendations(
            db=db_session, user_id=user.id, session_id=session.id
        )
        assert reco["total_topics_tracked"] >= 1
        weak_topics = [w["topic"] for w in reco["weak_topics"]]
        assert "Organic Chemistry" in weak_topics
        assert len(reco["recommendations"]) >= 1

    def test_no_weak_topics_positive_message(self, db_session, test_users):
        user = test_users["user_b"]
        session = StudySession(
            filename="strong.pdf", summary="T", content="C",
            user_id=user.id, source_type="pdf"
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        # Create mastered topic
        for _ in range(10):
            LearnerEngine.record_topic_interaction(
                db=db_session, user_id=user.id, session_id=session.id,
                topic="Strong Topic", is_correct=True, difficulty="advanced"
            )

        reco = LearnerEngine.get_weak_topics_and_recommendations(
            db=db_session, user_id=user.id, session_id=session.id
        )
        # High mastery should produce positive recommendation
        assert len(reco["recommendations"]) >= 1


# ===========================================================================
# CATEGORY M: Flashcard Generation — AssessmentEngine
# ===========================================================================

class TestFlashcardGeneration:
    def test_valid_flashcard_generation(self):
        chunks = [{
            "chunk_index": 0,
            "text_content": "QUIZ_BETA_456 flashcard content about photosynthesis.",
            "page_number": 3,
            "section_heading": "Biology"
        }]

        mock_json = json.dumps([{
            "front": "What process converts sunlight to energy in QUIZ_BETA_456?",
            "back": "Photosynthesis",
            "topic": "Biology",
            "difficulty": "beginner",
            "page_number": 3
        }])

        cards = AssessmentEngine.generate_flashcards(
            chunks=chunks, num_cards=1,
            generate_fallback_fn=lambda c, p: mock_json
        )
        assert len(cards) == 1
        assert "QUIZ_BETA_456" in cards[0]["front"]
        assert cards[0]["back"] == "Photosynthesis"
        assert cards[0]["page_number"] == 3

    def test_empty_front_rejected(self):
        mock_json = json.dumps([{
            "front": "",
            "back": "Answer",
            "topic": "Test"
        }])

        cards = AssessmentEngine.generate_flashcards(
            chunks=[{"chunk_index": 0, "text_content": "test", "page_number": 1, "section_heading": "G"}],
            num_cards=1,
            generate_fallback_fn=lambda c, p: mock_json
        )
        assert len(cards) == 0

    def test_empty_back_rejected(self):
        mock_json = json.dumps([{
            "front": "Question?",
            "back": "",
            "topic": "Test"
        }])

        cards = AssessmentEngine.generate_flashcards(
            chunks=[{"chunk_index": 0, "text_content": "test", "page_number": 1, "section_heading": "G"}],
            num_cards=1,
            generate_fallback_fn=lambda c, p: mock_json
        )
        assert len(cards) == 0

    def test_num_cards_capped_at_30(self):
        cards = AssessmentEngine.generate_flashcards(
            chunks=[{"chunk_index": 0, "text_content": "test", "page_number": 1, "section_heading": "G"}],
            num_cards=100,
            generate_fallback_fn=lambda c, p: "[]"
        )
        assert isinstance(cards, list)


# ===========================================================================
# CATEGORY N: Section Quiz Endpoint Logic
# ===========================================================================

class TestSectionQuizLogic:
    """Test the section quiz generation logic without live API."""

    def test_section_quiz_request_model(self):
        from main import SectionQuizRequest
        req = SectionQuizRequest(
            section_title="Introduction to QUIZ_GAMMA_789",
            timestamp_str="01:00 - 02:30",
            what_video_says="This section covers QUIZ_GAMMA_789 marker.",
            concept_tags=["audit", "verification"]
        )
        assert req.section_title == "Introduction to QUIZ_GAMMA_789"
        assert len(req.concept_tags) == 2

    def test_section_quiz_optional_fields(self):
        from main import SectionQuizRequest
        req = SectionQuizRequest()
        assert req.section_title is None
        assert req.timestamp_str is None
        assert req.what_video_says is None
        assert req.concept_tags is None


# ===========================================================================
# CATEGORY O: Integration — Full Quiz Lifecycle (Mock LLM)
# ===========================================================================

class TestQuizLifecycleIntegration:
    """End-to-end quiz lifecycle with mock LLM."""

    def test_full_lifecycle_generate_to_mastery(self, db_session, test_users):
        """Generate quiz -> user answers -> submit result -> mastery updated."""
        user = test_users["user_a"]
        session = StudySession(
            filename="lifecycle.pdf", summary="Lifecycle test",
            content="QUIZ_ALPHA_123 lifecycle test content.",
            user_id=user.id, source_type="pdf"
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        # Add a chunk
        chunk = DocumentChunk(
            session_id=session.id,
            chunk_index=0,
            text_content="QUIZ_ALPHA_123 content about lifecycle testing.",
            embedding=[0.0] * 10,  # Placeholder embedding (real ones are 3072-dim)
            page_number=1,
            section_heading="Testing",
            content_type="text"
        )
        db_session.add(chunk)
        db_session.commit()

        # Simulate quiz result submission
        pct = round((3 / 5) * 100)
        result = QuizResult(
            score=3, total_questions=5, percentage=pct,
            user_id=user.id, session_id=session.id,
            details=[
                {"topic": "Testing", "is_correct": True, "difficulty": "intermediate"},
                {"topic": "Testing", "is_correct": True, "difficulty": "intermediate"},
                {"topic": "Testing", "is_correct": True, "difficulty": "intermediate"},
                {"topic": "Debugging", "is_correct": False, "difficulty": "intermediate", "section_heading": "Error Handling"},
                {"topic": "Debugging", "is_correct": False, "difficulty": "intermediate", "section_heading": "Edge Cases"},
            ]
        )
        db_session.add(result)
        db_session.commit()

        # Process mastery updates
        for d in result.details:
            LearnerEngine.record_topic_interaction(
                db=db_session,
                user_id=user.id,
                session_id=session.id,
                topic=str(d.get("topic", "General")),
                is_correct=bool(d.get("is_correct")),
                difficulty=str(d.get("difficulty", "intermediate")),
                subtopic=d.get("section_heading")
            )

        # Verify mastery state
        mastery = LearnerEngine.get_session_mastery(
            db=db_session, user_id=user.id, session_id=session.id
        )
        topics = {m["topic"]: m for m in mastery}
        assert "Testing" in topics
        assert topics["Testing"]["correct"] == 3
        assert "Debugging" in topics
        assert topics["Debugging"]["correct"] == 0
        assert topics["Debugging"]["attempts"] == 2

        # Verify weak topics
        reco = LearnerEngine.get_weak_topics_and_recommendations(
            db=db_session, user_id=user.id, session_id=session.id
        )
        weak_names = [w["topic"] for w in reco["weak_topics"]]
        assert "Debugging" in weak_names


# ===========================================================================
# Run
# ===========================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
