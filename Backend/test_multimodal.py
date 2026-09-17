"""
Florix AI — Phase 4 Multimodal Knowledge Engine Verification Suite
Comprehensive automated test suite validating multimodal normalization, timestamp preservation,
hybrid retrieval, citation mapping, and multi-tenant security across all supported modalities.
Author: Ganesh (Lead Architect)
"""

import pytest
import re
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from main import app, get_db, SessionLocal, User, StudySession, DocumentChunk, chroma_collection
from auth import get_password_hash, create_access_token
from content.models import MediaType, ContentSegment, NormalizedContent
from content.normalizer import ContentNormalizer, compute_sha256
from content.transcription import (
    parse_timestamp_str,
    extract_timestamped_segments,
    MockTranscriptionProvider,
)
from rag.models import ContentType, EnrichedChunk, RetrievalCandidate, Citation, QueryIntent
from rag.chunker import build_semantic_chunks, chunk_normalized_content, _format_ts_span
from rag.context_builder import ContextBuilder
from rag.retriever import HybridRetriever
from rag.generator import GroundedGenerator
from intelligence.assessment import AssessmentEngine


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    yield db
    db.close()


@pytest.fixture(scope="module")
def setup_users(db_session):
    """Creates two isolated test users for multi-tenant verification."""
    u1 = db_session.query(User).filter(User.email == "phase4_user1@test.com").first()
    if not u1:
        u1 = User(
            email="phase4_user1@test.com",
            name="Phase4 User One",
            hashed_password=get_password_hash("Pass123!"),
            plan="pro",
            is_admin=True,
        )
        db_session.add(u1)
    else:
        u1.plan = "pro"
        u1.is_admin = True

    u2 = db_session.query(User).filter(User.email == "phase4_user2@test.com").first()
    if not u2:
        u2 = User(
            email="phase4_user2@test.com",
            name="Phase4 User Two",
            hashed_password=get_password_hash("Pass123!"),
            plan="pro",
        )
        db_session.add(u2)
    else:
        u2.plan = "pro"

    db_session.commit()
    db_session.refresh(u1)
    db_session.refresh(u2)

    t1 = create_access_token({"sub": u1.email})
    t2 = create_access_token({"sub": u2.email})

    return {"u1": u1, "u2": u2, "token1": t1, "token2": t2}


# ==============================================================================
# CATEGORY A: PDF Normalization & Segment Creation
# ==============================================================================
def test_category_a_pdf_normalization():
    pages = [
        (1, "Title: Deep Learning Architectures\n\nChapter 1 covers basic perceptions and multilayer nets."),
        (2, "Backpropagation calculates gradients through the chain rule.\n\nOptimization follows SGD."),
    ]
    normalized = ContentNormalizer.normalize_pdf(pages, title="Deep Learning PDF")

    assert normalized.media_type == MediaType.PDF
    assert normalized.title == "Deep Learning PDF"
    assert len(normalized.segments) >= 3
    assert normalized.metadata["total_pages"] == 2
    assert normalized.content_hash == compute_sha256(normalized.raw_text)

    # Verify page preservation
    p1_segs = [s for s in normalized.segments if s.page_number == 1]
    p2_segs = [s for s in normalized.segments if s.page_number == 2]
    assert len(p1_segs) >= 1
    assert len(p2_segs) >= 1


# ==============================================================================
# CATEGORY B: Text / Markdown Normalization
# ==============================================================================
def test_category_b_text_normalization():
    raw_markdown = (
        "# Algorithm Complexity\n\n"
        "Big-O notation describes the limiting behavior of a function.\n\n"
        "```python\ndef linear_search(arr, x):\n    for i in arr:\n        if i == x: return True\n    return False\n```\n\n"
        "This runs in O(N) time."
    )
    normalized = ContentNormalizer.normalize_text(raw_markdown, title="Complexity Notes")

    assert normalized.media_type == MediaType.TEXT
    assert len(normalized.segments) >= 3
    code_segs = [s for s in normalized.segments if s.content_type == ContentType.CODE]
    assert len(code_segs) >= 1
    assert "linear_search" in code_segs[0].text


# ==============================================================================
# CATEGORY C: YouTube Transcript Normalization with Timestamps
# ==============================================================================
def test_category_c_youtube_transcript_normalization():
    captions = [
        {"text": "Welcome to quantum computing fundamentals.", "start": 0.0, "duration": 8.5},
        {"text": "A qubit represents a linear superposition of two states.", "start": 8.5, "duration": 15.0},
        {"text": "Bloch sphere visualization aids understanding.", "start": 23.5, "duration": 12.0},
    ]
    normalized = ContentNormalizer.normalize_youtube(captions, title="Quantum Lecture", video_id="abc123xyz00")

    assert normalized.media_type == MediaType.YOUTUBE
    assert len(normalized.segments) == 3
    assert normalized.segments[0].timestamp_start == 0.0
    assert normalized.segments[0].timestamp_end == 8.5
    assert normalized.segments[1].timestamp_start == 8.5
    assert normalized.segments[1].timestamp_end == 23.5
    assert normalized.metadata["video_id"] == "abc123xyz00"
    assert normalized.metadata["total_duration_seconds"] == 35.5


# ==============================================================================
# CATEGORY D: Audio Transcript Normalization with Timestamps
# ==============================================================================
def test_category_d_audio_transcript_normalization():
    provider = MockTranscriptionProvider()
    segments = provider.transcribe("test_audio.mp3", "audio/mp3")

    normalized = ContentNormalizer.normalize_audio(segments, title="AI Audio Class")
    assert normalized.media_type == MediaType.AUDIO
    assert len(normalized.segments) == 3
    assert normalized.segments[0].speaker == "Instructor"
    assert normalized.segments[0].timestamp_start == 0.0
    assert normalized.segments[0].timestamp_end == 15.0


# ==============================================================================
# CATEGORY E: Video Transcript Normalization with Timestamps
# ==============================================================================
def test_category_e_video_transcript_normalization():
    raw_video_text = (
        "[00:00 - 00:30] Professor Smith: Welcome everyone to advanced organic chemistry.\n\n"
        "[00:30 - 01:15] Professor Smith: Today we review electrophilic aromatic substitution mechanisms.\n\n"
        "[01:15 - 02:00] Student: Can you clarify the role of the Lewis acid catalyst?"
    )
    segments = extract_timestamped_segments(raw_video_text)
    normalized = ContentNormalizer.normalize_video(segments, title="Organic Chem Video", raw_text=raw_video_text)

    assert normalized.media_type == MediaType.VIDEO
    assert len(normalized.segments) == 3
    assert normalized.segments[0].timestamp_start == 0.0
    assert normalized.segments[0].timestamp_end == 30.0
    assert normalized.segments[0].speaker == "Professor Smith"
    assert normalized.segments[2].timestamp_start == 75.0
    assert normalized.segments[2].timestamp_end == 120.0
    assert normalized.segments[2].speaker == "Student"


# ==============================================================================
# CATEGORY F: Web Scrape Normalization
# ==============================================================================
def test_category_f_web_normalization():
    web_text = (
        "Thermodynamics in Chemical Engineering\n\n"
        "The first law establishes conservation of energy.\n\n"
        "The second law introduces the concept of entropy and non-reversible processes."
    )
    normalized = ContentNormalizer.normalize_web(web_text, title="Thermodynamics Guide", url="https://edu.example.com/thermo")

    assert normalized.media_type == MediaType.WEB
    assert len(normalized.segments) >= 2
    assert normalized.metadata["url"] == "https://edu.example.com/thermo"


# ==============================================================================
# CATEGORY G: Timestamp Preserving Semantic Chunking
# ==============================================================================
def test_category_g_timestamp_preserving_chunking():
    captions = [
        {"text": "Introduction to convolutional neural networks.", "start": 10.0, "duration": 20.0},
        {"text": "Feature maps extract spatial hierarchies using kernels.", "start": 30.0, "duration": 30.0},
    ]
    normalized = ContentNormalizer.normalize_youtube(captions, title="CNN Tutorial")
    chunks = build_semantic_chunks(normalized, chunk_size=800)

    assert len(chunks) == 1
    chk = chunks[0]
    assert chk.metadata["timestamp_start"] == 10.0
    assert chk.metadata["timestamp_end"] == 60.0
    assert chk.metadata["timestamp_str"] == "00:10 - 01:00"
    assert chk.metadata["source_type"] == "youtube"


# ==============================================================================
# CATEGORY H: Chunker Boundary & Overlap Timestamp Propagation
# ==============================================================================
def test_category_h_chunker_boundary_and_overlap():
    segments = [
        ContentSegment(segment_id=1, text="Segment 1 " * 40, timestamp_start=0.0, timestamp_end=60.0),
        ContentSegment(segment_id=2, text="Segment 2 " * 40, timestamp_start=60.0, timestamp_end=120.0),
        ContentSegment(segment_id=3, text="Segment 3 " * 40, timestamp_start=120.0, timestamp_end=180.0),
    ]
    normalized = ContentNormalizer.normalize_audio(segments, title="Long Audio Lecture")
    chunks = build_semantic_chunks(normalized, chunk_size=400, overlap=50)

    assert len(chunks) >= 3
    # Check that sequential chunks have increasing or continuous timestamp bounds
    assert chunks[0].metadata["timestamp_start"] == 0.0
    assert chunks[-1].metadata["timestamp_end"] == 180.0
    for c in chunks:
        assert c.metadata["timestamp_start"] is not None
        assert c.metadata["timestamp_end"] is not None
        assert c.metadata["timestamp_start"] <= c.metadata["timestamp_end"]


# ==============================================================================
# CATEGORY I & J: SQLite DocumentChunk Storage with Timestamp Metadata
# ==============================================================================
def test_category_i_and_j_sqlite_chunk_storage(db_session, setup_users):
    u = setup_users["u1"]
    session = StudySession(
        filename="Audio Lecture 101",
        summary="Summary of Audio Lecture",
        content="Lecture content with timestamps",
        user_id=u.id,
        source_type="audio"
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    chunk = DocumentChunk(
        chunk_index=0,
        text_content="Neural net backprop explanation at 02:15",
        embedding=[0.1] * 10,
        session_id=session.id,
        page_number=1,
        section_heading="[02:15 - 03:00] Instructor",
        content_type="text",
        chunk_metadata={
            "timestamp_start": 135.0,
            "timestamp_end": 180.0,
            "timestamp_str": "02:15 - 03:00",
            "source_type": "audio",
            "speaker": "Instructor"
        }
    )
    db_session.add(chunk)
    db_session.commit()
    db_session.refresh(chunk)

    # Query back and verify JSON chunk_metadata
    saved = db_session.query(DocumentChunk).filter(DocumentChunk.id == chunk.id).first()
    assert saved is not None
    assert saved.chunk_metadata["timestamp_start"] == 135.0
    assert saved.chunk_metadata["timestamp_end"] == 180.0
    assert saved.chunk_metadata["source_type"] == "audio"


# ==============================================================================
# CATEGORY K: ChromaDB Metadata Verification
# ==============================================================================
def test_category_k_chromadb_metadata():
    if chroma_collection is None:
        pytest.skip("ChromaDB not available in current test environment")

    test_cid = "test_chroma_ts_chunk_1"
    meta = {
        "session_id": 9999,
        "user_id": 9999,
        "chunk_index": 0,
        "page_number": 1,
        "section_heading": "[01:00 - 01:30]",
        "content_type": "text",
        "timestamp_start": 60.0,
        "timestamp_end": 90.0,
        "timestamp_str": "01:00 - 01:30",
        "source_type": "video"
    }

    chroma_collection.upsert(
        ids=[test_cid],
        embeddings=[[0.1] * 3072],
        metadatas=[meta],
        documents=["Video chunk text on gradient descent"]
    )

    res = chroma_collection.get(ids=[test_cid], include=["metadatas", "documents"])
    assert res["ids"][0] == test_cid
    retrieved_meta = res["metadatas"][0]
    assert retrieved_meta["timestamp_start"] == 60.0
    assert retrieved_meta["timestamp_end"] == 90.0
    assert retrieved_meta["source_type"] == "video"

    # Clean up test entry
    chroma_collection.delete(ids=[test_cid])


# ==============================================================================
# CATEGORY L: Hybrid Retriever Candidate Timestamp Preservation
# ==============================================================================
def test_category_l_retriever_timestamp_propagation(db_session, setup_users):
    u = setup_users["u1"]
    session = StudySession(
        filename="Discrete Mathematics Audio",
        summary="Summary of Discrete Math",
        content="Graph theory and Euler paths",
        user_id=u.id,
        source_type="audio"
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    chunk = DocumentChunk(
        chunk_index=0,
        text_content="An Euler path visits every edge of a graph exactly once.",
        embedding=[0.1] * 10,
        session_id=session.id,
        page_number=1,
        section_heading="[04:20 - 05:10]",
        content_type="text",
        chunk_metadata={
            "timestamp_start": 260.0,
            "timestamp_end": 310.0,
            "timestamp_str": "04:20 - 05:10",
            "source_type": "audio",
            "speaker": "Prof. Euler"
        }
    )
    db_session.add(chunk)
    db_session.commit()

    retriever = HybridRetriever(chroma_collection=None, gemini_client=None)
    candidates = retriever.retrieve(
        query="Euler path definition",
        user_id=u.id,
        session_id=session.id,
        db=db_session,
        top_k=3,
        session_model=StudySession,
        chunk_model=DocumentChunk
    )

    assert len(candidates) >= 1
    cand = candidates[0]
    assert cand.source_type == "audio"
    assert cand.metadata.get("timestamp_start") == 260.0
    assert cand.metadata.get("timestamp_end") == 310.0


# ==============================================================================
# CATEGORY M: ContextBuilder Timestamp Header Formatting
# ==============================================================================
def test_category_m_context_builder_media_formatting():
    candidate = RetrievalCandidate(
        chunk_id="c_media_1",
        session_id=101,
        user_id=1,
        text="A finite automaton consists of a finite set of states and transitions.",
        page_number=1,
        section_heading="State Machines",
        content_type=ContentType.TEXT,
        source_type="video",
        document_title="Automata Lecture Video",
        metadata={
            "timestamp_start": 125.0,
            "timestamp_end": 185.0,
            "timestamp_str": "02:05 - 03:05",
            "source_type": "video"
        }
    )

    context_str, citations = ContextBuilder.build_context([candidate])

    # Check header format
    assert '[SOURCE 1: Video "Automata Lecture Video", Timestamp [02:05 - 03:05]' in context_str
    assert len(citations) == 1
    cit = citations[0]
    assert cit.source_type == "video"
    assert cit.timestamp_start == 125.0
    assert cit.timestamp_end == 185.0
    assert cit.media_timestamp_str == "02:05 - 03:05"


# ==============================================================================
# CATEGORY N: Citation Mapping with [MM:SS - MM:SS]
# ==============================================================================
def test_category_n_citation_mapping():
    c = Citation(
        source_index=1,
        document_title="Distributed Systems Audio",
        session_id=202,
        page_number=1,
        section_heading="Consensus",
        snippet="Paxos ensures consensus across asynchronous networks.",
        timestamp_start=340.0,
        timestamp_end=410.0,
        source_type="audio",
        media_timestamp_str="05:40 - 06:50"
    )

    d = c.to_dict()
    assert d["source_index"] == 1
    assert d["document_title"] == "Distributed Systems Audio"
    assert d["timestamp_start"] == 340.0
    assert d["timestamp_end"] == 410.0
    assert d["media_timestamp_str"] == "05:40 - 06:50"
    assert d["source_type"] == "audio"


# ==============================================================================
# CATEGORY O: Grounded LLM Response with Multimodal Citations
# ==============================================================================
def test_category_o_grounded_generator_multimodal():
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "According to the lecture [1], Paxos guarantees consensus under asynchronous network conditions."
    mock_client.models.generate_content.return_value = mock_response

    generator = GroundedGenerator(gemini_client=mock_client, model_name="gemini-1.5-flash")
    citations = [
        Citation(
            source_index=1,
            document_title="Distributed Systems Audio",
            session_id=1,
            page_number=1,
            section_heading="Consensus",
            snippet="Paxos guarantees consensus.",
            timestamp_start=300.0,
            timestamp_end=360.0,
            source_type="audio",
            media_timestamp_str="05:00 - 06:00"
        )
    ]

    res = generator.generate(
        query="What does Paxos guarantee?",
        context="[SOURCE 1: Audio] Paxos guarantees consensus.",
        citations=citations
    )

    assert res.is_grounded is True
    assert len(res.citations) == 1
    assert res.citations[0].media_timestamp_str == "05:00 - 06:00"


# ==============================================================================
# CATEGORY P: Grounded Quiz Generation with Multimodal Evidence
# ==============================================================================
def test_category_p_grounded_quiz_generation():
    fake_chunks = [
        {
            "chunk_index": 0,
            "text_content": "Acceleration is defined as the time rate of change of velocity.",
            "page_number": 1,
            "section_heading": "[01:10 - 01:50]",
            "timestamp_str": "01:10 - 01:50",
            "source_type": "video"
        }
    ]

    mock_quiz_json = """[
      {
        "question": "What is acceleration?",
        "options": ["Rate of change of velocity", "Rate of change of mass", "Product of force and distance", "Scalar quantity of speed"],
        "answer": 0,
        "explanation": "Acceleration is the time rate of change of velocity as explained at timestamp 01:10.",
        "difficulty": "easy",
        "page_number": 1
      }
    ]"""

    def mock_gen(ctx, prompt):
        return mock_quiz_json

    quiz = AssessmentEngine.generate_quiz(
        chunks=fake_chunks,
        num_questions=1,
        difficulty="easy",
        generate_fallback_fn=mock_gen
    )
    assert len(quiz) == 1
    assert quiz[0]["question"] == "What is acceleration?"
    assert quiz[0]["answer"] == 0
    assert "01:10" in quiz[0]["explanation"]


# ==============================================================================
# CATEGORY Q: Grounded Flashcard Generation with Multimodal Evidence
# ==============================================================================
def test_category_q_grounded_flashcard_generation():
    fake_chunks = [
        {
            "chunk_index": 0,
            "text_content": "Mitosis results in two genetically identical diploid cells.",
            "page_number": 1,
            "section_heading": "[03:15 - 04:00]",
            "timestamp_str": "03:15 - 04:00",
            "source_type": "audio"
        }
    ]

    mock_fc_json = """[
      {
        "front": "What is the primary result of mitosis?",
        "back": "Two genetically identical diploid daughter cells.",
        "topic": "Cell Biology",
        "difficulty": "beginner",
        "page_number": 1
      }
    ]"""

    def mock_gen(ctx, prompt):
        return mock_fc_json

    cards = AssessmentEngine.generate_flashcards(
        chunks=fake_chunks,
        num_cards=1,
        generate_fallback_fn=mock_gen
    )
    assert len(cards) == 1
    assert "identical" in cards[0]["back"]


# ==============================================================================
# CATEGORY R: Multi-tenant User Isolation on Multimodal Sessions
# ==============================================================================
def test_category_r_multimodal_multi_tenant_isolation(client, setup_users, db_session):
    u1 = setup_users["u1"]
    u2 = setup_users["u2"]

    # User 1 creates private audio study session
    s1 = StudySession(
        filename="User1 Private Lecture",
        summary="Confidential content",
        content="User 1 private trade secrets",
        user_id=u1.id,
        source_type="audio"
    )
    db_session.add(s1)
    db_session.commit()
    db_session.refresh(s1)

    # User 2 attempts to view User 1's session -> Must be 404
    resp = client.get(
        f"/study/{s1.id}",
        headers={"Authorization": f"Bearer {setup_users['token2']}"}
    )
    assert resp.status_code == 404

    # User 2 attempts to delete User 1's session -> Must be 404
    resp_del = client.delete(
        f"/delete-session/{s1.id}",
        headers={"Authorization": f"Bearer {setup_users['token2']}"}
    )
    assert resp_del.status_code == 404


# ==============================================================================
# CATEGORY S: SHA-256 Deduplication on Multimodal Inputs
# ==============================================================================
def test_category_s_sha256_deduplication():
    t1 = "Sample lecture transcript text."
    t2 = "Sample lecture transcript text."
    t3 = "Different lecture transcript text."

    hash1 = compute_sha256(t1)
    hash2 = compute_sha256(t2)
    hash3 = compute_sha256(t3)

    assert hash1 == hash2
    assert hash1 != hash3
    assert len(hash1) == 64


# ==============================================================================
# CATEGORY T: Malformed Transcript & Timestamp Parsing Edge Cases
# ==============================================================================
def test_category_t_malformed_transcript_parsing():
    # Empty string
    segs_empty = extract_timestamped_segments("")
    assert segs_empty == []

    # Invalid timestamp string
    ts_val = parse_timestamp_str("not_a_time")
    assert ts_val == 0.0

    # Text without explicit timestamps -> synthetic timeline generated
    plain = "Paragraph 1 about chemistry.\n\nParagraph 2 about thermodynamics."
    segs_plain = extract_timestamped_segments(plain)
    assert len(segs_plain) == 2
    assert segs_plain[0].timestamp_start == 0.0
    assert segs_plain[0].timestamp_end > 0.0
    assert segs_plain[1].timestamp_start == segs_plain[0].timestamp_end


# ==============================================================================
# CATEGORY U: Missing Captions / YouTube Fallback Handling
# ==============================================================================
def test_category_u_missing_youtube_captions_handling(client, setup_users):
    # Testing /process-link with an invalid or inaccessible YouTube URL
    resp = client.post(
        "/process-link",
        headers={"Authorization": f"Bearer {setup_users['token1']}"},
        json={"url": "https://www.youtube.com/watch?v=invalid_id_9999"}
    )
    # Endpoint should reject gracefully with 422
    assert resp.status_code == 422


# ==============================================================================
# CATEGORY V: Full System Regression Verification
# ==============================================================================
def test_category_v_regression_verification():
    # Verify backward-compatible build_semantic_chunks behavior on raw text
    text_chunks = build_semantic_chunks("Basic legacy string document.", chunk_size=800)
    assert len(text_chunks) == 1
    assert text_chunks[0].page_number == 1
    assert text_chunks[0].text == "Basic legacy string document."

    # Verify backward-compatible build_semantic_chunks on page tuples
    page_chunks = build_semantic_chunks([(1, "Page 1 content"), (2, "Page 2 content")])
    assert len(page_chunks) >= 2
    assert page_chunks[0].page_number == 1
    assert page_chunks[1].page_number == 2


def import_json_dumps(obj):
    import json
    return json.dumps(obj)
