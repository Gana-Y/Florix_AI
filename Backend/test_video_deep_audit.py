import io
import os
import re
import json
import time
import uuid
import hashlib
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from main import app, get_db, process_upload_in_background
from database import SessionLocal, Base, engine, User, StudySession, DocumentChunk
from auth import create_access_token
from content.models import ContentSegment, NormalizedContent, MediaType
from content.normalizer import ContentNormalizer
from content.transcription import extract_timestamped_segments, parse_timestamp_str
from rag.chunker import build_semantic_chunks, chunk_normalized_content, _format_ts_span
from rag.models import ContentType, Citation, RetrievalCandidate
from rag.context_builder import ContextBuilder
from rag.retriever import HybridRetriever


# ==============================================================================
# TEST FIXTURES AND HELPERS
# ==============================================================================

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
    u1 = db_session.query(User).filter(User.email == "video_audit_u1@florix.test").first()
    if not u1:
        u1 = User(name="Video Auditor 1", email="video_audit_u1@florix.test", hashed_password="hash_video_u1", plan="premium")
        db_session.add(u1)
    else:
        u1.plan = "premium"

    u2 = db_session.query(User).filter(User.email == "video_audit_u2@florix.test").first()
    if not u2:
        u2 = User(name="Video Auditor 2", email="video_audit_u2@florix.test", hashed_password="hash_video_u2", plan="premium")
        db_session.add(u2)
    else:
        u2.plan = "premium"

    db_session.commit()
    db_session.refresh(u1)
    db_session.refresh(u2)

    token1 = create_access_token(data={"sub": u1.email})
    token2 = create_access_token(data={"sub": u2.email})

    return {
        "u1": u1,
        "token1": token1,
        "headers1": {"Authorization": f"Bearer {token1}"},
        "u2": u2,
        "token2": token2,
        "headers2": {"Authorization": f"Bearer {token2}"},
    }


def create_dummy_video_bytes(size_bytes: int = 2048) -> bytes:
    header = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom"
    filler = b"\x00" * max(0, size_bytes - len(header))
    return header + filler


# ==============================================================================
# 1. VIDEO FORMAT MATRIX TESTS
# ==============================================================================

class TestVideoFormatMatrix:
    @pytest.mark.parametrize("ext,mime", [
        (".mp4", "video/mp4"),
        (".webm", "video/webm"),
        (".mov", "video/quicktime"),
        (".avi", "video/x-msvideo"),
        (".mkv", "video/x-matroska"),
    ])
    def test_allowed_video_formats_accepted(self, client, test_users, ext, mime):
        video_bytes = create_dummy_video_bytes(4096)
        files = {"file": (f"test_lecture{ext}", video_bytes, mime)}

        with patch("main.BackgroundTasks.add_task") as mock_bg:
            resp = client.post("/upload-video", files=files, headers=test_users["headers1"])
            assert resp.status_code == 200, f"Failed for valid extension {ext}: {resp.text}"
            data = resp.json()
            assert "id" in data
            assert data["filename"] == "Video: Test Lecture"

    @pytest.mark.parametrize("bad_ext", [
        ".exe", ".pdf", ".mp3", ".txt", ".jpg", ".docx", ".sh", ".bin", ".tar.gz"
    ])
    def test_disallowed_extensions_rejected(self, client, test_users, bad_ext):
        video_bytes = create_dummy_video_bytes(4096)
        files = {"file": (f"malicious{bad_ext}", video_bytes, "application/octet-stream")}
        resp = client.post("/upload-video", files=files, headers=test_users["headers1"])
        assert resp.status_code == 400
        assert "Supported formats" in resp.json()["detail"]

    def test_missing_extension_rejected(self, client, test_users):
        video_bytes = create_dummy_video_bytes(4096)
        files = {"file": ("video_without_extension", video_bytes, "video/mp4")}
        resp = client.post("/upload-video", files=files, headers=test_users["headers1"])
        assert resp.status_code == 400


# ==============================================================================
# 2. FILE SIZE BOUNDARIES & PLAN LIMITS
# ==============================================================================

class TestVideoSizeBoundaries:
    def test_zero_byte_video_rejected(self, client, test_users):
        files = {"file": ("empty.mp4", b"", "video/mp4")}
        resp = client.post("/upload-video", files=files, headers=test_users["headers1"])
        assert resp.status_code == 400
        assert "too small" in resp.json()["detail"].lower()

    def test_tiny_under_1kb_video_rejected(self, client, test_users):
        files = {"file": ("corrupt.mp4", b"tiny" * 50, "video/mp4")}
        resp = client.post("/upload-video", files=files, headers=test_users["headers1"])
        assert resp.status_code == 400
        assert "too small" in resp.json()["detail"].lower()

    def test_oversized_video_rejected_by_plan_limit(self, client, test_users, monkeypatch):
        monkeypatch.setenv("MAX_VIDEO_SIZE_MB", "1")
        big_content = create_dummy_video_bytes(2 * 1024 * 1024)
        files = {"file": ("huge.mp4", big_content, "video/mp4")}
        resp = client.post("/upload-video", files=files, headers=test_users["headers1"])
        assert resp.status_code == 413
        assert "too large" in resp.json()["detail"].lower()


# ==============================================================================
# 3. COLLISION SAFETY & CONCURRENCY
# ==============================================================================

class TestVideoCollisionSafety:
    def test_concurrent_same_filename_uploads_have_unique_paths(self, client, test_users):
        unique_token = uuid.uuid4().bytes
        video_bytes = create_dummy_video_bytes(3000) + unique_token
        captured_paths = []

        with patch("main.BackgroundTasks.add_task") as mock_bg:
            def capture_add_task(*args, **kwargs):
                file_path = kwargs.get("file_path")
                if file_path:
                    captured_paths.append(file_path)
            mock_bg.side_effect = capture_add_task

            f1 = {"file": ("lecture.mp4", video_bytes + b"1", "video/mp4")}
            f2 = {"file": ("lecture.mp4", video_bytes + b"2", "video/mp4")}

            r1 = client.post("/upload-video", files=f1, headers=test_users["headers1"])
            r2 = client.post("/upload-video", files=f2, headers=test_users["headers1"])

            assert r1.status_code == 200
            assert r2.status_code == 200
            assert len(captured_paths) == 2
            assert captured_paths[0] != captured_paths[1], f"Collision! Both used: {captured_paths[0]}"

        for p in captured_paths:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass

    def test_path_traversal_filename_sanitized(self, client, test_users):
        unique_token = uuid.uuid4().bytes
        video_bytes = create_dummy_video_bytes(2048) + unique_token
        captured_paths = []

        with patch("main.BackgroundTasks.add_task") as mock_bg:
            def capture_add_task(*args, **kwargs):
                if kwargs.get("file_path"):
                    captured_paths.append(kwargs["file_path"])
            mock_bg.side_effect = capture_add_task

            f = {"file": ("../../evil_path.mp4", video_bytes, "video/mp4")}
            r = client.post("/upload-video", files=f, headers=test_users["headers1"])
            assert r.status_code == 200
            assert len(captured_paths) == 1
            saved_path = captured_paths[0]
            assert saved_path.startswith("uploads/")
            assert ".." not in saved_path

        for p in captured_paths:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass


# ==============================================================================
# 4. IDEMPOTENCY & DEDUPLICATION
# ==============================================================================

class TestVideoDeduplication:
    def test_duplicate_upload_same_user_returns_cached_session(self, client, test_users):
        unique_bytes = create_dummy_video_bytes(4096) + uuid.uuid4().bytes

        with patch("main.BackgroundTasks.add_task") as mock_bg:
            f1 = {"file": ("idempotent_test.mp4", unique_bytes, "video/mp4")}
            r1 = client.post("/upload-video", files=f1, headers=test_users["headers1"])
            assert r1.status_code == 200
            d1 = r1.json()
            session_id_1 = d1["id"]

            f2 = {"file": ("idempotent_test.mp4", unique_bytes, "video/mp4")}
            r2 = client.post("/upload-video", files=f2, headers=test_users["headers1"])
            assert r2.status_code == 200
            d2 = r2.json()

            assert d2.get("duplicate") is True
            assert d2["id"] == session_id_1

    def test_same_video_different_users_isolated(self, client, test_users):
        unique_bytes = create_dummy_video_bytes(4096) + uuid.uuid4().bytes

        with patch("main.BackgroundTasks.add_task") as mock_bg:
            f1 = {"file": ("shared_lecture.mp4", unique_bytes, "video/mp4")}
            r1 = client.post("/upload-video", files=f1, headers=test_users["headers1"])
            assert r1.status_code == 200
            id_u1 = r1.json()["id"]

            f2 = {"file": ("shared_lecture.mp4", unique_bytes, "video/mp4")}
            r2 = client.post("/upload-video", files=f2, headers=test_users["headers2"])
            assert r2.status_code == 200
            id_u2 = r2.json()["id"]

            assert id_u1 != id_u2, "Security violation: Cross-tenant session leakage on duplicate file!"


# ==============================================================================
# 5. TEMPORARY RESOURCE CLEANUP (ZERO LEAKAGE)
# ==============================================================================

class TestVideoResourceCleanup:
    def test_temp_file_deleted_on_gemini_failure(self, db_session, test_users):
        os.makedirs("uploads", exist_ok=True)
        temp_file = f"uploads/test_leak_check_{uuid.uuid4().hex[:8]}.mp4"
        with open(temp_file, "wb") as f:
            f.write(create_dummy_video_bytes(2048))

        assert os.path.exists(temp_file), "Precondition failed: temp file not created"

        sess = StudySession(
            filename="Leak Check Video",
            user_id=test_users["u1"].id,
            source_type="video",
            summary="Processing...",
            content="Processing..."
        )
        db_session.add(sess)
        db_session.commit()
        db_session.refresh(sess)

        with patch("main.client.files.upload", side_effect=Exception("429 Resource Exhausted: Quota exceeded")):
            try:
                process_upload_in_background(
                    session_id=sess.id,
                    source_type="video",
                    file_path=temp_file,
                    mime_type="video/mp4"
                )
            except Exception:
                pass

        assert not os.path.exists(temp_file), f"Resource Leak! Temp file {temp_file} was not deleted after error."


# ==============================================================================
# 6. TRANSCRIPT & STUDY GUIDE PARTITIONING
# ==============================================================================

class TestTranscriptStudyGuideSeparation:
    def test_extract_timestamped_segments_ignores_study_guide_headers(self):
        llm_response = """[00:00 - 00:30] Instructor: Welcome to the lecture on Artificial Neural Networks.
[00:30 - 01:15] Instructor: Today we focus on backpropagation and gradient descent.
[01:15 - 02:00] Instructor: Let us derive the weight update equation using the chain rule.

# Video Title: Neural Networks Masterclass
## Transcription Highlights
- 00:00: Introduction
- 00:30: Core concepts
## Key Topics Covered
- Backpropagation
- Gradient Descent
## Summary
In this lecture, the instructor provides a mathematical foundation for neural network optimization.
## Key Takeaways
1. Gradients indicate the direction of steepest descent.
2. Learning rate controls step size.
"""
        segs = extract_timestamped_segments(llm_response)
        assert len(segs) == 3, f"Expected 3 segments, got {len(segs)}"

        seg3 = segs[2]
        assert "derive the weight update equation" in seg3.text
        assert "# Video Title" not in seg3.text, "Contamination: Study guide title absorbed into segment 3!"
        assert "## Summary" not in seg3.text, "Contamination: Summary header absorbed into segment 3!"
        assert "Key Takeaways" not in seg3.text, "Contamination: Key takeaways absorbed into segment 3!"

    def test_speaker_with_punctuation_and_hyphens(self):
        sample = "[01:15:30 - 01:20:00] Prof. Smith-Jones: Here we see the gradient vector field."
        segs = extract_timestamped_segments(sample)
        assert len(segs) == 1
        assert segs[0].speaker == "Prof. Smith-Jones"
        assert segs[0].timestamp_start == 4530.0
        assert segs[0].timestamp_end == 4800.0

    def test_partitioning_when_headings_precede_transcription_highlights(self):
        """
        Regression test for production defect:
        When Gemini outputs '# Video Title' and '## Transcription Highlights' before timestamps,
        the partitioning logic must not truncate session.content to an empty/preamble string.
        """
        llm_response = """Here is your educational analysis:
# Video Title: Advanced Quantum Computing Masterclass

## Transcription Highlights
[00:00 - 00:05] Prof. Dirac: We begin with quantum state superposition.
[00:05 - 00:10] Prof. Dirac: Next we examine entanglement between qubits.
[00:10 - 00:15] Prof. Dirac: Finally we analyze the decoherence threshold.

## Key Topics Covered
- Superposition
- Entanglement
- Decoherence

## Summary
Comprehensive lecture on quantum circuit design.
"""
        guide_match = re.search(r"(?:\n|^)(#[#\s].*)", llm_response, re.DOTALL)
        guide_part = guide_match.group(1).strip() if guide_match else llm_response.strip()

        segs = extract_timestamped_segments(llm_response)
        assert len(segs) == 3
        transcript_lines = []
        for s in segs:
            spk = f"{s.speaker}: " if s.speaker else ""
            span_str = _format_ts_span(s.timestamp_start, s.timestamp_end)
            transcript_lines.append(f"[{span_str}] {spk}{s.text}".strip())
        content_text = "\n".join(transcript_lines)
        summary_text = guide_part

        # Under the old defect, content_text was 'Here is your educational analysis:'
        # Under the fix, content_text contains all 3 timestamped lines:
        assert "superposition" in content_text
        assert "entanglement" in content_text
        assert "decoherence" in content_text
        assert "[00:00 - 00:05]" in content_text
        assert "# Video Title" not in content_text
        assert "Key Topics Covered" not in content_text
        assert "# Video Title" in summary_text
        assert "Key Topics Covered" in summary_text



# ==============================================================================
# 7. SPEECH CHUNKING BOUNDS & PUNCTUATION-LESS FALLBACK
# ==============================================================================

class TestSpeechChunkingBounds:
    def test_punctuation_less_speech_bounded_to_chunk_size(self):
        words = ["speech" + str(i) for i in range(400)]
        long_speech = " ".join(words)
        assert len(long_speech) > 2500

        seg = ContentSegment(
            segment_id=1,
            text=long_speech,
            timestamp_start=0.0,
            timestamp_end=120.0,
            speaker="Lecturer"
        )
        norm = NormalizedContent(
            title="Unpunctuated Video Lecture",
            media_type=MediaType.VIDEO,
            content_hash="test_hash_punc",
            raw_text=long_speech,
            segments=[seg]
        )

        chunks = chunk_normalized_content(norm, chunk_size=800, overlap=150)
        assert len(chunks) > 1, f"Expected multiple chunks, got {len(chunks)}"

        for idx, c in enumerate(chunks):
            assert len(c.text) <= 800, f"Chunk {idx} exceeded chunk_size: {len(c.text)} chars"
            assert c.metadata.get("timestamp_start") is not None
            assert c.metadata.get("timestamp_end") is not None
            assert c.metadata.get("timestamp_str") is not None

    def test_timestamp_interpolation_monotonicity(self):
        words = ["lecture" + str(i) for i in range(400)]
        long_speech = " ".join(words)

        seg = ContentSegment(
            segment_id=1,
            text=long_speech,
            timestamp_start=10.0,
            timestamp_end=110.0
        )
        norm = NormalizedContent(
            title="Timing Test",
            media_type=MediaType.VIDEO,
            content_hash="test_timing",
            raw_text=long_speech,
            segments=[seg]
        )

        chunks = chunk_normalized_content(norm, chunk_size=800, overlap=150)
        prev_end = 0.0
        for c in chunks:
            ts_start = c.metadata["timestamp_start"]
            ts_end = c.metadata["timestamp_end"]
            assert ts_start >= 10.0
            assert ts_end <= 110.0
            assert ts_start <= ts_end
            assert ts_start >= prev_end - 5.0
            prev_end = ts_end


# ==============================================================================
# 8. TIMESTAMP PRESERVATION & PARSING FORMATS
# ==============================================================================

class TestTimestampParsingFormats:
    @pytest.mark.parametrize("ts_str,expected_sec", [
        ("00:15", 15.0),
        ("01:30", 90.0),
        ("12:45", 765.0),
        ("01:00:00", 3600.0),
        ("01:15:30", 4530.0),
        ("02:30:15", 9015.0),
    ])
    def test_parse_timestamp_str(self, ts_str, expected_sec):
        assert parse_timestamp_str(ts_str) == expected_sec

    def test_json_transcript_parsing(self):
        json_transcript = """```json
[
  {"start": 0.0, "end": 20.0, "speaker": "Speaker 1", "text": "First segment of the lecture."},
  {"start": 20.0, "end": 45.0, "speaker": "Speaker 2", "text": "Second segment discussing complexity."}
]
```"""
        segs = extract_timestamped_segments(json_transcript)
        assert len(segs) == 2
        assert segs[0].timestamp_start == 0.0
        assert segs[0].timestamp_end == 20.0
        assert segs[1].speaker == "Speaker 2"

    def test_format_ts_span_hours(self):
        span_str = _format_ts_span(4500.0, 4800.0)
        assert span_str == "01:15:00 - 01:20:00"


# ==============================================================================
# 9. NORMALIZER & METADATA CONSISTENCY
# ==============================================================================

class TestVideoNormalizerConsistency:
    def test_normalize_video_sets_source_type_and_media_type(self):
        raw_text = "[00:00 - 00:30] Instructor: First video block.\n[00:30 - 01:00] Instructor: Second video block."
        normalized = ContentNormalizer.normalize_any(
            source_type="video",
            data=raw_text,
            title="DSA Video",
            metadata={"session_id": 999, "user_id": 1, "source_type": "video"}
        )

        assert normalized.media_type == MediaType.VIDEO
        assert len(normalized.segments) == 2
        for s in normalized.segments:
            assert s.metadata.get("source_type") == "video"

        chunks = build_semantic_chunks(normalized, chunk_size=800, overlap=150)
        assert len(chunks) >= 1
        for c in chunks:
            assert c.metadata.get("source_type") == "video"
            assert c.metadata.get("timestamp_str") is not None


# ==============================================================================
# 10. RAG GROUNDED CITATIONS & MULTI-TENANT ISOLATION
# ==============================================================================

class TestVideoRagAndMultiTenantIsolation:
    def test_context_builder_formats_video_citation_correctly(self):
        cand = RetrievalCandidate(
            chunk_id="chunk_video_1",
            session_id=101,
            user_id=1,
            text="Binary search operates in logarithmic time O(log N).",
            page_number=1,
            section_heading="[01:15 - 02:30] Instructor",
            content_type=ContentType.TEXT,
            dense_score=0.92,
            final_score=0.92,
            source_type="video",
            metadata={
                "source_type": "video",
                "timestamp_start": 75.0,
                "timestamp_end": 150.0,
                "timestamp_str": "01:15 - 02:30",
                "speaker": "Instructor"
            },
            document_title="Algorithms Lecture"
        )

        context_str, citations = ContextBuilder.build_context([cand])

        assert "[SOURCE 1: Video \"Algorithms Lecture\", Timestamp [01:15 - 02:30], Section \"[01:15 - 02:30] Instructor\"]" in context_str
        assert len(citations) == 1
        c = citations[0]
        assert c.source_type == "video"
        assert c.media_timestamp_str == "01:15 - 02:30"
        assert c.timestamp_start == 75.0
        assert c.timestamp_end == 150.0

        c_dict = c.to_dict()
        assert c_dict["media_timestamp_str"] == "01:15 - 02:30"
        frontend_label = f"Source [{c_dict['source_index']}] · ⏱ {c_dict['media_timestamp_str']}"
        assert frontend_label == "Source [1] · ⏱ 01:15 - 02:30"

    def test_multi_tenant_rag_isolation(self, db_session, test_users):
        sess_a = StudySession(
            filename="User A Private Video",
            user_id=test_users["u1"].id,
            source_type="video",
            summary="User A private guide",
            content="[00:00 - 00:30] Speaker: Secret user A video content."
        )
        db_session.add(sess_a)
        db_session.commit()
        db_session.refresh(sess_a)

        chunk_a = DocumentChunk(
            chunk_index=0,
            text_content="Secret user A video content on distributed systems.",
            embedding=[0.1] * 768,
            session_id=sess_a.id,
            page_number=1,
            section_heading="[00:00 - 00:30]",
            content_type="text",
            chunk_metadata={"source_type": "video", "timestamp_str": "00:00 - 00:30"}
        )
        db_session.add(chunk_a)
        db_session.commit()

        retriever = HybridRetriever(chroma_collection=None, gemini_client=None)
        candidates = retriever.retrieve(
            query="distributed systems",
            user_id=test_users["u2"].id,
            session_id=sess_a.id,
            db=db_session,
            session_model=StudySession,
            chunk_model=DocumentChunk
        )
        assert all(c.user_id == test_users["u2"].id for c in candidates)
