"""
Florix AI — YouTube Learning Timeline & Interactive Knowledge Experience Tests
Verifies timeline section parsing, validation, fallback generation, API endpoints,
tenant isolation, explanation grounding, quiz generation, and progress tracking.
Author: Ganesh (Lead Architect)
"""

import json
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from main import app, get_db
from database import SessionLocal, Base, engine, User, StudySession, LearningEvent
from auth import create_access_token
from content.timeline import (
    format_seconds_to_timestamp,
    format_time_range,
    get_youtube_thumbnail_url,
    get_youtube_watch_url,
    validate_learning_sections,
    build_fallback_timeline_from_transcript,
    build_concepts_map,
    detect_learning_sections
)


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    yield db
    db.close()


@pytest.fixture(scope="module")
def test_users(db_session):
    u1 = db_session.query(User).filter(User.email == "yt1@test.com").first()
    if not u1:
        u1 = User(name="YT Tester 1", email="yt1@test.com", hashed_password="hashed_pw_yt1", plan="pro")
        db_session.add(u1)
    else:
        u1.plan = "pro"
    u2 = db_session.query(User).filter(User.email == "yt2@test.com").first()
    if not u2:
        u2 = User(name="YT Tester 2", email="yt2@test.com", hashed_password="hashed_pw_yt2", plan="pro")
        db_session.add(u2)
    else:
        u2.plan = "pro"
    db_session.commit()
    db_session.refresh(u1)
    db_session.refresh(u2)

    token1 = create_access_token(data={"sub": u1.email})
    token2 = create_access_token(data={"sub": u2.email})

    return {
        "user1": u1,
        "token1": token1,
        "user2": u2,
        "token2": token2
    }


# ── Unit Tests: Helpers & Validation ─────────────────────────────────────────

def test_timestamp_formatting():
    assert format_seconds_to_timestamp(0) == "00:00"
    assert format_seconds_to_timestamp(75) == "01:15"
    assert format_seconds_to_timestamp(197) == "03:17"
    assert format_seconds_to_timestamp(3665) == "01:01:05"

    assert format_time_range(197, 275) == "03:17 - 04:35"


def test_youtube_url_and_thumbnail_helpers():
    vid = "dQw4w9WgXcQ"
    thumb = get_youtube_thumbnail_url(vid)
    assert f"https://img.youtube.com/vi/{vid}/hqdefault.jpg" == thumb

    watch = get_youtube_watch_url(vid, 197.5)
    assert watch == f"https://www.youtube.com/watch?v={vid}&t=197s"


def test_section_validation_valid():
    valid_sections = [
        {
            "section_id": "sec_01",
            "title": "Introduction to Quantum Bits",
            "start_seconds": 0.0,
            "end_seconds": 84.0,
            "what_video_says": "The speaker introduces qubits.",
            "florix_explanation": "Think of qubits as quantum coins.",
            "concept_tags": ["Qubit", "Quantum"],
            "key_takeaways": ["Qubits differ from bits"]
        },
        {
            "section_id": "sec_02",
            "title": "Superposition Principle",
            "start_seconds": 84.0,
            "end_seconds": 195.0,
            "what_video_says": "Superposition is explained.",
            "florix_explanation": "States can be combined.",
            "concept_tags": ["Superposition"],
            "key_takeaways": ["Linear combination"]
        }
    ]
    is_valid, msg = validate_learning_sections(valid_sections, total_duration=300.0)
    assert is_valid is True
    assert msg == "Valid"


def test_section_validation_chronological_rejection():
    inverted_sections = [
        {
            "section_id": "sec_01",
            "title": "Second Topic First",
            "start_seconds": 120.0,
            "end_seconds": 200.0,
            "what_video_says": "Topic B",
            "florix_explanation": "Topic B",
            "concept_tags": ["B"],
            "key_takeaways": ["B"]
        },
        {
            "section_id": "sec_02",
            "title": "First Topic Second",
            "start_seconds": 50.0,  # EARLIER than 120!
            "end_seconds": 110.0,
            "what_video_says": "Topic A",
            "florix_explanation": "Topic A",
            "concept_tags": ["A"],
            "key_takeaways": ["A"]
        }
    ]
    is_valid, msg = validate_learning_sections(inverted_sections)
    assert is_valid is False
    assert "earlier than previous section" in msg


def test_section_validation_invalid_timestamps():
    bad_sections = [
        {
            "section_id": "sec_01",
            "title": "Bad Range",
            "start_seconds": 100.0,
            "end_seconds": 80.0,  # End < Start!
            "what_video_says": "...",
            "florix_explanation": "...",
            "concept_tags": []
        }
    ]
    is_valid, msg = validate_learning_sections(bad_sections)
    assert is_valid is False
    assert "<= start" in msg


def test_section_validation_empty_title_rejection():
    bad_sections = [
        {
            "section_id": "sec_01",
            "title": "   ",
            "start_seconds": 0.0,
            "end_seconds": 45.0,
            "what_video_says": "...",
            "florix_explanation": "..."
        }
    ]
    is_valid, msg = validate_learning_sections(bad_sections)
    assert is_valid is False
    assert "missing a valid title" in msg


# ── Unit Tests: Fallback Generation ──────────────────────────────────────────

def test_fallback_timeline_from_transcript():
    sample_transcript = """
[00:00 - 00:25] Welcome to this lecture on quantum computing architectures.
[00:25 - 01:15] Today we explore how quantum circuits manipulate superposition.
[01:15 - 02:40] Classical computers use silicon transistors storing bits.
[02:40 - 04:10] Quantum computers instead use superconducting transmon qubits.
[04:10 - 05:30] Entanglement allows correlation across multiple physical qubits.
"""
    timeline = build_fallback_timeline_from_transcript(sample_transcript, "Quantum Lecture", "abc12345678")
    assert timeline["video_id"] == "abc12345678"
    assert timeline["total_sections"] >= 2
    assert len(timeline["sections"]) >= 2
    for sec in timeline["sections"]:
        assert sec["timestamp_start"] >= 0
        assert sec["timestamp_end"] > sec["timestamp_start"]
        assert len(sec["title"]) > 0
        assert "watch_url" in sec
    assert "concepts_map" in timeline


def test_concepts_map_generation():
    sections = [
        {"section_id": "sec_01", "concept_tags": ["Qubit", "Superposition"]},
        {"section_id": "sec_02", "concept_tags": ["Superposition", "Entanglement"]},
        {"section_id": "sec_03", "concept_tags": ["Entanglement", "Quantum Teleportation"]},
    ]
    cmap = build_concepts_map(sections)
    assert "Qubit" in cmap
    assert "Superposition" in cmap
    assert cmap["Superposition"] == ["sec_01", "sec_02"]
    assert cmap["Entanglement"] == ["sec_02", "sec_03"]


# ── Integration Tests: Endpoints & User Isolation ────────────────────────────

def test_timeline_endpoint_unauthorized(client):
    res = client.get("/sessions/9999/learning-timeline")
    assert res.status_code == 401


def test_timeline_endpoint_user_isolation(client, db_session, test_users):
    # Create session owned by User 1
    s1 = StudySession(
        filename="YouTube: dQw4w9WgXcQ",
        ai_title="Rick Astley Quantum Mechanics",
        summary="A study guide on quantum pop.",
        content="[00:00 - 00:30] Introduction to never giving up.",
        source_type="youtube",
        user_id=test_users["user1"].id,
        doc_metadata={"video_id": "dQw4w9WgXcQ"}
    )
    db_session.add(s1)
    db_session.commit()
    db_session.refresh(s1)

    # User 2 attempts to fetch User 1's timeline -> 404 forbidden
    res = client.get(
        f"/sessions/{s1.id}/learning-timeline",
        headers={"Authorization": f"Bearer {test_users['token2']}"}
    )
    assert res.status_code == 404

    # User 1 fetches own timeline -> 200 OK
    res_owner = client.get(
        f"/sessions/{s1.id}/learning-timeline",
        headers={"Authorization": f"Bearer {test_users['token1']}"}
    )
    assert res_owner.status_code == 200
    data = res_owner.json()
    assert data["video_id"] == "dQw4w9WgXcQ"
    assert "sections" in data
    assert len(data["sections"]) > 0


def test_explain_and_quiz_section_endpoints(client, db_session, test_users):
    # Setup session with cached timeline
    cached_timeline = {
        "video_id": "dQw4w9WgXcQ",
        "video_title": "Quantum Mechanics",
        "duration_seconds": 120,
        "sections": [
            {
                "section_id": "sec_01",
                "title": "Quantum Entanglement",
                "timestamp_start": 0.0,
                "timestamp_end": 60.0,
                "timestamp_str": "00:00 - 01:00",
                "what_video_says": "Particles stay connected.",
                "florix_explanation": "Spooky action at a distance.",
                "concept_tags": ["Entanglement"],
                "key_takeaways": ["Non-local correlations"]
            }
        ]
    }
    s = StudySession(
        filename="YouTube: dQw4w9WgXcQ",
        ai_title="Quantum Mechanics",
        summary="Guide",
        content="[00:00 - 01:00] Particles stay connected.",
        source_type="youtube",
        user_id=test_users["user1"].id,
        doc_metadata={"video_id": "dQw4w9WgXcQ", "learning_timeline": cached_timeline}
    )
    db_session.add(s)
    db_session.commit()
    db_session.refresh(s)

    # 1. Section Explain
    explain_payload = {
        "section_title": "Quantum Entanglement",
        "timestamp_str": "00:00 - 01:00",
        "what_video_says": "Particles stay connected across space.",
        "concept_tags": ["Entanglement", "Bell States"]
    }
    exp_res = client.post(
        f"/sessions/{s.id}/learning-timeline/sections/sec_01/explain",
        headers={"Authorization": f"Bearer {test_users['token1']}"},
        json=explain_payload
    )
    assert exp_res.status_code == 200
    exp_data = exp_res.json()
    assert exp_data["section_id"] == "sec_01"
    assert "explanation" in exp_data
    assert exp_data["citation"]["timestamp_str"] == "00:00 - 01:00"

    # 2. Section Quiz
    quiz_payload = {
        "section_title": "Quantum Entanglement",
        "timestamp_str": "00:00 - 01:00",
        "what_video_says": "Particles stay connected across space.",
        "concept_tags": ["Entanglement"]
    }
    mock_quiz_json = json.dumps({
        "question": "What is quantum entanglement?",
        "options": ["A state of correlation", "A new element", "A software protocol", "A laser beam"],
        "correct_index": 0,
        "explanation": "Entanglement describes quantum correlation between particles."
    })
    with patch("main.generate_with_fallback", return_value=mock_quiz_json):
        quiz_res = client.post(
            f"/sessions/{s.id}/learning-timeline/sections/sec_01/quiz",
            headers={"Authorization": f"Bearer {test_users['token1']}"},
            json=quiz_payload
        )
        assert quiz_res.status_code == 200
        quiz_data = quiz_res.json()
        assert quiz_data["section_id"] == "sec_01"
        assert "quiz" in quiz_data
        assert "question" in quiz_data["quiz"]
        assert len(quiz_data["quiz"]["options"]) == 4

    # 3. Section Progress
    prog_payload = {
        "section_id": "sec_01",
        "status": "viewed"
    }
    prog_res = client.post(
        f"/sessions/{s.id}/learning-timeline/progress",
        headers={"Authorization": f"Bearer {test_users['token1']}"},
        json=prog_payload
    )
    assert prog_res.status_code == 200
    prog_data = prog_res.json()
    assert prog_data["status"] == "ok"
    assert prog_data["progress"]["sec_01"]["viewed"] is True
