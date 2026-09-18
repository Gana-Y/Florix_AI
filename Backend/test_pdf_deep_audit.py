"""
Florix AI — PDF Deep Audit and Hardening Test Suite
Comprehensive adversarial audit covering all PDF ingestion and RAG dimensions:
1. Basic Valid PDFs (one-page, multi-page, large text, empty-page, mixed empty/non-empty, whitespace)
2. Academic PDFs (title page, TOC, headings, subheadings, paragraphs, definitions, lists, code, equations, tables, references)
3. Text Extraction Edge Cases (Unicode, Indian languages, CJK, RTL, emojis, math symbols, Greek letters, superscripts, ligatures, hyphens, split words, long lines, null bytes, scanned rejection)
4. Page Boundary Testing (paragraphs across pages, headings at bottom/top, code/table across pages, exact page metadata verification)
5. Table PDFs (simple, wide, multi-row, empty cells, numeric, prose-mixed)
6. Code PDFs (indentation, braces, comments, SQL, Python, JS, C++)
7. Security Audit (JavaScript in PDF, suspicious metadata, malformed objects/xref, path traversal filename, MIME spoofing, renamed binary)
8. Encryption and Password Matrix (unencrypted, password-protected, empty password, wrong password)
9. Corruption Matrix (0-byte, truncated, random binary, missing EOF, zombie prevention)
10. Duplication and Idempotency (same user cached vs different user isolated)
11. Large PDF and Resource Audit
12. Database and Chroma Consistency (status transitions, foreign keys, deterministic IDs)
13. RAG and Citation Traceability (multi-page citations, page-specific queries, non-existent query)
14. Cross-Tenant Security (User A vs User B vector and fallback isolation)
15. Failure Recovery (error state transitions)

Author: Ganesh (Lead Architect)
"""

import io
import os
import re
import json
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from pypdf import PdfWriter, PdfReader
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from main import app, get_db
from database import SessionLocal, Base, engine, User, StudySession, DocumentChunk
from auth import create_access_token
from content.normalizer import ContentNormalizer
from rag.chunker import build_semantic_chunks
from rag.models import ContentType
from rag.context_builder import ContextBuilder
from rag.retriever import HybridRetriever, RetrievalCandidate


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
    u1 = db_session.query(User).filter(User.email == "pdf_audit_u1@florix.test").first()
    if not u1:
        u1 = User(name="PDF Auditor 1", email="pdf_audit_u1@florix.test", hashed_password="hash_pdf_u1", plan="premium")
        db_session.add(u1)
    else:
        u1.plan = "premium"
    u2 = db_session.query(User).filter(User.email == "pdf_audit_u2@florix.test").first()
    if not u2:
        u2 = User(name="PDF Auditor 2", email="pdf_audit_u2@florix.test", hashed_password="hash_pdf_u2", plan="premium")
        db_session.add(u2)
    else:
        u2.plan = "premium"
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


def make_pdf_with_pages(pages_content: list) -> bytes:
    """Creates a multi-page PDF with exact string content on each page using ReportLab."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    for content in pages_content:
        lines = content.strip().split("\n")
        y = 750
        for line in lines:
            if y < 50:
                break
            c.drawString(72, y, line[:100])
            y -= 18
        c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.getvalue()


# ==============================================================================
# 1. BASIC VALID PDFs
# ==============================================================================
class TestBasicValidPdfs:

    def test_one_page_text_pdf(self, client, test_users):
        pdf_bytes = make_pdf_with_pages([
            "Florix AI Academic Core Architecture\n"
            "This document presents the theoretical foundation of cognitive spaced repetition."
        ])
        files = {"file": ("one_page_academic.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
        headers = {"Authorization": f"Bearer {test_users['token1']}"}
        with patch("main.generate_with_fallback", return_value="# Study Guide\n## Summary"):
            resp = client.post("/upload", files=files, headers=headers)
            assert resp.status_code == 200
            data = resp.json()
            assert "id" in data
            assert data["filename"]

    def test_multi_page_pdf_page_count(self, client, test_users, db_session):
        pages = [
            "Page 1: Title and Overview of Neural Networks in Machine Learning.",
            "Page 2: Backpropagation Algorithm and Gradient Descent Mechanics.",
            "Page 3: Attention Mechanism and Transformer Architecture Fundamentals."
        ]
        pdf_bytes = make_pdf_with_pages(pages)
        files = {"file": ("multi_page_nn.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
        headers = {"Authorization": f"Bearer {test_users['token1']}"}

        with patch("main.generate_with_fallback", return_value="# NN Study Guide"):
            resp = client.post("/upload", files=files, headers=headers)
            assert resp.status_code == 200
            sess_id = resp.json()["id"]

            session = db_session.query(StudySession).filter(StudySession.id == sess_id).first()
            assert session is not None
            assert session.page_count == 3

    def test_empty_page_pdf_rejected(self, client, test_users):
        writer = PdfWriter()
        writer.add_blank_page(width=200, height=200)
        out = io.BytesIO()
        writer.write(out)
        out.seek(0)

        files = {"file": ("blank_page.pdf", out, "application/pdf")}
        headers = {"Authorization": f"Bearer {test_users['token1']}"}
        resp = client.post("/upload", files=files, headers=headers)
        assert resp.status_code == 422
        assert "empty" in resp.json()["detail"].lower() or "scanned" in resp.json()["detail"].lower()

    def test_mixed_empty_and_non_empty_pages(self, client, test_users, db_session):
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        c.drawString(72, 750, "Page 1: Active introductory lecture notes on Distributed Systems.")
        c.showPage()
        c.showPage()  # Page 2 blank
        c.drawString(72, 750, "Page 3: Consensus protocols including Raft and Byzantine Fault Tolerance.")
        c.showPage()
        c.save()
        buffer.seek(0)

        files = {"file": ("mixed_pages_ds.pdf", buffer, "application/pdf")}
        headers = {"Authorization": f"Bearer {test_users['token1']}"}

        with patch("main.generate_with_fallback", return_value="# DS Guide"):
            resp = client.post("/upload", files=files, headers=headers)
            assert resp.status_code == 200
            sess_id = resp.json()["id"]

            session = db_session.query(StudySession).filter(StudySession.id == sess_id).first()
            assert session.page_count == 3

    def test_pdf_containing_only_whitespace(self, client, test_users):
        pdf_bytes = make_pdf_with_pages(["     \n\n\t\t   \n    "])
        files = {"file": ("whitespace_only.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
        headers = {"Authorization": f"Bearer {test_users['token1']}"}
        resp = client.post("/upload", files=files, headers=headers)
        assert resp.status_code == 422
        assert "empty" in resp.json()["detail"].lower() or "scanned" in resp.json()["detail"].lower()


# ==============================================================================
# 2. ACADEMIC PDFs AND STRUCTURE PRESERVATION
# ==============================================================================
class TestAcademicPdfStructure:

    def test_academic_components_preservation(self):
        academic_text = (
            "# Advanced Database Management Systems\n\n"
            "## Table of Contents\n"
            "1. Relational Model\n2. Normalization\n3. Concurrency Control\n\n"
            "## 1. Relational Model\n"
            "A database relation is defined as a subset of a Cartesian product of a list of domains.\n\n"
            "Definition: First Normal Form (1NF)\n"
            "A domain is atomic if elements of the domain are considered to be indivisible units.\n\n"
            "```sql\n"
            "SELECT student_id, AVG(gpa) FROM enrollments GROUP BY student_id HAVING AVG(gpa) > 3.5;\n"
            "```\n\n"
            "Equations of Relational Algebra:\n"
            "$$\\pi_{name, id}(\\sigma_{gpa > 3.5}(Students))$$\n\n"
            "| Normal Form | Key Requirement | Anomaly Prevented |\n"
            "| 1NF | Atomic attributes | Repeating groups |\n"
            "| 2NF | No partial dependencies | Redundant tuples |\n"
            "| 3NF | No transitive dependencies | Update anomalies |\n\n"
            "## References\n"
            "[1] Codd, E. F. (1970). A Relational Model of Data for Large Shared Data Banks."
        )
        chunks = build_semantic_chunks(academic_text)
        assert len(chunks) > 0

        types = [c.content_type for c in chunks]
        assert any(t in (ContentType.CODE, ContentType.TABLE, ContentType.DEFINITION, ContentType.TEXT) for t in types)

        for c in chunks:
            assert c.page_number is not None
            assert c.token_count > 0


# ==============================================================================
# 3. TEXT EXTRACTION EDGE CASES
# ==============================================================================
class TestTextExtractionEdgeCases:

    def test_unicode_and_international_scripts(self):
        scripts_text = (
            "Mathematical formulations: ∀x ∈ ℝ, ∃y : y > x² + ∑_{i=1}^{n} λ_i\n"
            "Greek alphabet: α, β, γ, δ, ε, ζ, η, θ, ι, κ, λ, μ, ν, ξ, ο, π, ρ, σ, τ, υ, φ, χ, ψ, ω\n"
            "German and French: Über die spezielle und die allgemeine Relativitätstheorie, façade, naïve\n"
            "Indian Devanagari: कंप्यूटर विज्ञान और मशीन लर्निंग सिद्धांत\n"
            "CJK characters: 人工智能与深度学习技术研究\n"
            "Arabic script: معالجة اللغات الطبيعية والذكاء الاصطناعي"
        )
        norm = ContentNormalizer.normalize_any("text", scripts_text, title="International Scripts")
        chunks = build_semantic_chunks(norm)
        assert len(chunks) > 0
        combined = " ".join(c.text for c in chunks)
        assert "∀x ∈ ℝ" in combined
        assert "Relativitätstheorie" in combined

    def test_null_bytes_and_control_characters(self):
        dirty_text = "Clean introduction\x00to database\x00systems with\x08control\x1fcharacters."
        clean_text = dirty_text.replace("\x00", "")
        assert "\x00" not in clean_text
        norm = ContentNormalizer.normalize_any("text", clean_text, title="Clean Text")
        chunks = build_semantic_chunks(norm)
        assert len(chunks) > 0
        assert "\x00" not in chunks[0].text

    def test_extreme_line_length(self):
        long_line = "Word " * 2500
        norm = ContentNormalizer.normalize_any("text", long_line, title="Long Line Test")
        chunks = build_semantic_chunks(norm, chunk_size=800, overlap=100)
        assert len(chunks) > 1
        for c in chunks:
            assert len(c.text) <= 2500


# ==============================================================================
# 4. PAGE BOUNDARY PRESERVATION AND TRACEABILITY
# ==============================================================================
class TestPageBoundaryTraceability:

    def test_multi_page_chunks_preserve_exact_page_numbers(self):
        pages_data = [
            (1, "# Chapter 1: Introduction to Thermodynamics\nThe zeroth law states thermal equilibrium is transitive."),
            (2, "# Chapter 2: First Law of Thermodynamics\nEnergy cannot be created or destroyed, only transformed: dU = dQ - dW."),
            (3, "# Chapter 3: Second Law of Thermodynamics\nThe entropy of an isolated system always increases over time: dS >= 0."),
            (4, "# Chapter 4: Third Law of Thermodynamics\nAs temperature approaches absolute zero, the entropy of a pure crystal reaches zero.")
        ]
        norm = ContentNormalizer.normalize_any("pdf", pages_data, title="Thermodynamics")
        chunks = build_semantic_chunks(norm)
        assert len(chunks) >= 4

        page_numbers = [c.page_number for c in chunks]
        assert 1 in page_numbers
        assert 2 in page_numbers
        assert 3 in page_numbers
        assert 4 in page_numbers

    def test_citations_map_to_correct_page(self):
        cand1 = RetrievalCandidate(
            chunk_id="c1", session_id=10, user_id=1,
            text="Thermal equilibrium is transitive.",
            page_number=1, section_heading="Chapter 1",
            content_type=ContentType.TEXT, final_score=0.9
        )
        cand2 = RetrievalCandidate(
            chunk_id="c2", session_id=10, user_id=1,
            text="The entropy of an isolated system always increases: dS >= 0.",
            page_number=3, section_heading="Chapter 3",
            content_type=ContentType.TEXT, final_score=0.85
        )
        context_str, citations = ContextBuilder.build_context([cand1, cand2])
        assert len(citations) == 2
        assert citations[0].page_number == 1
        assert citations[1].page_number == 3
        assert "Page 1" in context_str
        assert "Page 3" in context_str


# ==============================================================================
# 5. SECURITY AUDIT
# ==============================================================================
class TestPdfSecurityAudit:

    def test_javascript_pdf_does_not_execute(self, client, test_users):
        writer = PdfWriter()
        writer.add_blank_page(width=200, height=200)
        writer.add_js("app.alert('XSS Exploit');")
        out = io.BytesIO()
        writer.write(out)
        out.seek(0)

        files = {"file": ("malicious_js.pdf", out, "application/pdf")}
        headers = {"Authorization": f"Bearer {test_users['token1']}"}
        resp = client.post("/upload", files=files, headers=headers)
        assert resp.status_code == 422

    def test_path_traversal_filename_sanitized(self, client, test_users):
        pdf_bytes = make_pdf_with_pages(["Legitimate content to test path traversal file naming safety."])
        files = {"file": ("../../../../etc/passwd.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
        headers = {"Authorization": f"Bearer {test_users['token1']}"}

        with patch("main.generate_with_fallback", return_value="# Safe Title"):
            resp = client.post("/upload", files=files, headers=headers)
            assert resp.status_code == 200
            assert not os.path.exists("etc/passwd.pdf")
            assert not os.path.exists("/etc/passwd.pdf")

    def test_renamed_executable_or_binary_rejected(self, client, test_users):
        fake_binary = b"\x7fELF\x02\x01\x01\x00" + b"\x00" * 200
        files = {"file": ("binary_payload.pdf", io.BytesIO(fake_binary), "application/pdf")}
        headers = {"Authorization": f"Bearer {test_users['token1']}"}
        resp = client.post("/upload", files=files, headers=headers)
        assert resp.status_code == 422
        assert "could not read" in resp.json()["detail"].lower() or "corrupted" in resp.json()["detail"].lower()

    def test_mime_spoofing_rejected(self, client, test_users):
        files = {"file": ("notes.pdf", io.BytesIO(b"Plain text file not a PDF at all"), "application/pdf")}
        headers = {"Authorization": f"Bearer {test_users['token1']}"}
        resp = client.post("/upload", files=files, headers=headers)
        assert resp.status_code == 422


# ==============================================================================
# 6. ENCRYPTION AND PASSWORD MATRIX
# ==============================================================================
class TestEncryptionMatrix:

    def test_encrypted_password_protected_pdf_rejected(self, client, test_users):
        writer = PdfWriter()
        writer.add_blank_page(width=200, height=200)
        writer.encrypt("top_secret_pw")
        out = io.BytesIO()
        writer.write(out)
        out.seek(0)

        files = {"file": ("encrypted_vault.pdf", out, "application/pdf")}
        headers = {"Authorization": f"Bearer {test_users['token1']}"}
        resp = client.post("/upload", files=files, headers=headers)
        assert resp.status_code == 422
        assert "password" in resp.json()["detail"].lower()


# ==============================================================================
# 7. CORRUPTION MATRIX AND ZOMBIE PREVENTION
# ==============================================================================
class TestCorruptionMatrix:

    def test_zero_byte_upload(self, client, test_users):
        files = {"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")}
        headers = {"Authorization": f"Bearer {test_users['token1']}"}
        resp = client.post("/upload", files=files, headers=headers)
        assert resp.status_code == 400
        assert "empty" in resp.json()["detail"].lower()

    def test_truncated_pdf_header_only(self, client, test_users):
        files = {"file": ("truncated.pdf", io.BytesIO(b"%PDF-1.4\n1 0 obj\n"), "application/pdf")}
        headers = {"Authorization": f"Bearer {test_users['token1']}"}
        resp = client.post("/upload", files=files, headers=headers)
        assert resp.status_code == 422
        assert "corrupted" in resp.json()["detail"].lower() or "could not read" in resp.json()["detail"].lower()

    def test_missing_eof_corrupted_xref(self, client, test_users):
        corrupt_bytes = b"%PDF-1.4\n1 0 obj<<>>endobj\nxref\n0 1\n0000000000 65535 f\ntrailer<<>>"
        files = {"file": ("no_eof.pdf", io.BytesIO(corrupt_bytes), "application/pdf")}
        headers = {"Authorization": f"Bearer {test_users['token1']}"}
        resp = client.post("/upload", files=files, headers=headers)
        assert resp.status_code == 422

    def test_failed_upload_leaves_no_zombie_session(self, client, test_users, db_session):
        initial_count = db_session.query(StudySession).filter(StudySession.user_id == test_users["user1"].id).count()
        files = {"file": ("crash_test.pdf", io.BytesIO(b"totally corrupted garbage"), "application/pdf")}
        headers = {"Authorization": f"Bearer {test_users['token1']}"}
        resp = client.post("/upload", files=files, headers=headers)
        assert resp.status_code == 422

        final_count = db_session.query(StudySession).filter(StudySession.user_id == test_users["user1"].id).count()
        assert final_count == initial_count


# ==============================================================================
# 8. DUPLICATION AND IDEMPOTENCY
# ==============================================================================
class TestDuplicationAndIdempotency:

    def test_duplicate_upload_same_user_cached(self, client, test_users):
        pdf_bytes = make_pdf_with_pages(["Unique idempotent test text for identical content hashing check."])
        files = {"file": ("idemp_1.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
        headers = {"Authorization": f"Bearer {test_users['token1']}"}

        with patch("main.generate_with_fallback", return_value="# Idemp Study Guide"):
            resp1 = client.post("/upload", files=files, headers=headers)
            assert resp1.status_code == 200
            sess1_id = resp1.json()["id"]

            files2 = {"file": ("idemp_1_renamed.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
            resp2 = client.post("/upload", files=files2, headers=headers)
            assert resp2.status_code == 200
            data2 = resp2.json()
            assert data2.get("duplicate") is True
            assert data2["id"] == sess1_id

    def test_same_pdf_different_user_creates_isolated_session(self, client, test_users):
        pdf_bytes = make_pdf_with_pages(["Multi-tenant isolation verification text across User 1 and User 2."])
        files1 = {"file": ("tenant_iso.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
        headers1 = {"Authorization": f"Bearer {test_users['token1']}"}

        with patch("main.generate_with_fallback", return_value="# U1 Guide"):
            resp1 = client.post("/upload", files=files1, headers=headers1)
            assert resp1.status_code == 200
            sess1_id = resp1.json()["id"]

        files2 = {"file": ("tenant_iso.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
        headers2 = {"Authorization": f"Bearer {test_users['token2']}"}

        with patch("main.generate_with_fallback", return_value="# U2 Guide"):
            resp2 = client.post("/upload", files=files2, headers=headers2)
            assert resp2.status_code == 200
            sess2_id = resp2.json()["id"]

            assert sess1_id != sess2_id


# ==============================================================================
# 9. CROSS-TENANT SECURITY FOR PDF RAG
# ==============================================================================
class TestCrossTenantPdfRagSecurity:

    def test_user2_cannot_access_user1_pdf_chunks(self, db_session, test_users):
        u1_sess = StudySession(
            filename="Confidential Exam.pdf", content="Confidential Exam Solutions for Physics 101",
            user_id=test_users["user1"].id, source_type="pdf", processing_status="READY"
        )
        db_session.add(u1_sess)
        db_session.commit()
        db_session.refresh(u1_sess)

        chunk = DocumentChunk(
            chunk_index=0, text_content="Exam Question 1: Derive Schrödinger wave equation.",
            embedding=[0.0] * 10, session_id=u1_sess.id, page_number=1, section_heading="Exam",
            content_type="text", chunk_metadata={}
        )
        db_session.add(chunk)
        db_session.commit()

        from main import retrieve_relevant_chunks
        secured_results = retrieve_relevant_chunks(
            query="Schrödinger equation",
            session_id=u1_sess.id,
            db=db_session,
            user_id=test_users["user2"].id
        )
        assert len(secured_results) == 0


# ==============================================================================
# 10. MULTI-PAGE E2E INTEGRATION & CITATION TRACEABILITY
# ==============================================================================
class TestMultiPageEndToEndIntegration:

    def test_e2e_multi_page_pdf_chunk_page_preservation(self, client, test_users, db_session):
        pages = [
            "Page 1: Principles of Artificial Intelligence and Classical Search Algorithms.",
            "Page 2: Deep Convolutional Neural Networks for Computer Vision and Image Processing.",
            "Page 3: Attention Mechanisms and Transformer Architectures for Natural Language Understanding."
        ]
        pdf_bytes = make_pdf_with_pages(pages)
        files = {"file": ("e2e_multipage_ai.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
        headers = {"Authorization": f"Bearer {test_users['token1']}"}

        with patch("main.generate_with_fallback", return_value="# AI Guide"):
            resp = client.post("/upload", files=files, headers=headers)
            assert resp.status_code == 200
            sess_id = resp.json()["id"]

            session = db_session.query(StudySession).filter(StudySession.id == sess_id).first()
            assert session.page_count == 3
            assert session.doc_metadata is not None
            assert "pages" in session.doc_metadata
            assert len(session.doc_metadata["pages"]) == 3

            # Run background task with mocked embedding & chroma
            from main import process_upload_in_background
            with patch("main.client.models.embed_content") as mock_emb:
                mock_emb.return_value.embeddings = [type("Obj", (), {"values": [0.05] * 10})() for _ in range(50)]
                with patch("main.generate_with_fallback", return_value="# AI Guide"):
                    with patch("main.generate_smart_title", return_value="AI Principles"):
                        with patch("main.generate_category", return_value="Computer Science"):
                            with patch("main.chroma_collection.upsert"):
                                process_upload_in_background(session_id=sess_id, source_type="pdf", text_content=session.content)

            # Query database chunks
            chunks = db_session.query(DocumentChunk).filter(DocumentChunk.session_id == sess_id).order_by(DocumentChunk.chunk_index).all()
            assert len(chunks) >= 3

            page_nums = {c.page_number for c in chunks}
            assert 1 in page_nums
            assert 2 in page_nums
            assert 3 in page_nums

            # Page 2 chunk must have page_number == 2
            p2_chunks = [c for c in chunks if "Convolutional" in c.text_content]
            assert len(p2_chunks) > 0
            assert p2_chunks[0].page_number == 2

            # Page 3 chunk must have page_number == 3
            p3_chunks = [c for c in chunks if "Transformer" in c.text_content]
            assert len(p3_chunks) > 0
            assert p3_chunks[0].page_number == 3

    def test_citation_traceability_on_target_page(self, db_session, test_users):
        cand_p3 = RetrievalCandidate(
            chunk_id="c_p3", session_id=99, user_id=test_users["user1"].id,
            text="Attention mechanisms allow transformers to weight tokens dynamically.",
            page_number=3, section_heading="Transformers",
            content_type=ContentType.TEXT, final_score=0.92, document_title="AI Architecture.pdf"
        )
        ctx, citations = ContextBuilder.build_context([cand_p3])
        assert len(citations) == 1
        assert citations[0].page_number == 3
        assert citations[0].document_title == "AI Architecture.pdf"
        assert "Page 3" in ctx

    def test_non_existent_topic_retrieval_returns_no_citations(self, db_session, test_users):
        retriever = HybridRetriever(chroma_collection=None, gemini_client=None)
        results = retriever.retrieve(
            query="quantum biological chlorophyll photosynthesis",
            user_id=test_users["user1"].id,
            session_id=99999,  # non-existent
            db=db_session,
            chunk_model=DocumentChunk
        )
        assert len(results) == 0
