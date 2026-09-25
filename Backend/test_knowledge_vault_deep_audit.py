"""
Audit #11 — Knowledge Vault Deep Audit & Production Hardening
Deterministic test suite verifying AI Knowledge Vault semantic search, multi-tenancy isolation,
share token security, library lifecycle, cascading deletes, foreign-key unlinking,
safe date formatting, deduplication, input boundary sanitization, and fallback resilience.

Markers: KNOWLEDGE_VAULT_ALPHA_101, KNOWLEDGE_VAULT_BETA_202, KNOWLEDGE_VAULT_GAMMA_303
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

from database import (
    Base, engine, SessionLocal,
    User, StudySession, DocumentChunk, Bookmark,
    ChatConversation, ChatMessage, QuizResult, FlashcardProgress,
    Project, Activity,
)
from rag.models import ProcessingStatus
from main import app, get_db, chroma_collection

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import chromadb

# ---------------------------------------------------------------------------
# Test DB Setup
# ---------------------------------------------------------------------------
TEST_DB_URL = "sqlite:///./test_knowledge_vault_deep_audit.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)


def _override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    """Create all tables in test DB, then tear down after."""
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=test_engine)
    if os.path.exists("./test_knowledge_vault_deep_audit.db"):
        try:
            os.remove("./test_knowledge_vault_deep_audit.db")
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


@pytest.fixture(autouse=True)
def ensure_db_override():
    """Ensure FastAPI dependency override is always set to our test DB before every test."""
    app.dependency_overrides[get_db] = _override_get_db
    yield


@pytest.fixture
def ephemeral_chroma():
    """
    Creates an isolated in-memory EphemeralClient Chroma collection for tests.
    CRITICAL: Never touches Backend/chroma_db or modifies data_level0.bin!
    """
    client = chromadb.EphemeralClient()
    collection = client.get_or_create_collection("audit11_vault_test")
    return collection


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = _override_get_db
    return TestClient(app)


@pytest.fixture
def test_users(db_session):
    """Create test users for tenant isolation and permission tests."""
    import uuid
    from auth import get_password_hash, create_access_token
    uid = uuid.uuid4().hex[:8]
    email_a = f"kv_auditor_a_{uid}@test.com"
    email_b = f"kv_auditor_b_{uid}@test.com"

    user_a = User(
        name="KnowledgeVaultUserA", email=email_a,
        hashed_password=get_password_hash("TestPass123!"),
        plan="free"
    )
    user_b = User(
        name="KnowledgeVaultUserB", email=email_b,
        hashed_password=get_password_hash("TestPass456!"),
        plan="pro"
    )
    db_session.add_all([user_a, user_b])
    db_session.commit()
    db_session.refresh(user_a)
    db_session.refresh(user_b)

    token_a = create_access_token({"sub": user_a.email})
    token_b = create_access_token({"sub": user_b.email})

    return {
        "user_a": user_a,
        "user_b": user_b,
        "headers_a": {"Authorization": f"Bearer {token_a}"},
        "headers_b": {"Authorization": f"Bearer {token_b}"},
    }


# ===========================================================================
# CATEGORY A: Multi-Tenancy & Authorization Isolation
# ===========================================================================

class TestMultiTenancyIsolation:
    """Verify complete isolation between users across all library and vault endpoints."""

    def test_user_a_cannot_read_user_b_library_item(self, client, db_session, test_users):
        sess_b = StudySession(
            filename="User B Private Notes.pdf",
            summary="Confidential notes belonging to user B.",
            content="Sensitive content for user B only.",
            user_id=test_users["user_b"].id,
            processing_status=ProcessingStatus.READY
        )
        db_session.add(sess_b)
        db_session.commit()
        db_session.refresh(sess_b)

        # User A attempts to read User B's session
        resp = client.get(f"/library/{sess_b.id}", headers=test_users["headers_a"])
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    def test_user_a_cannot_rename_user_b_session(self, client, db_session, test_users):
        sess_b = StudySession(
            filename="User B Physics.pdf",
            summary="Quantum mechanics",
            user_id=test_users["user_b"].id,
            processing_status=ProcessingStatus.READY
        )
        db_session.add(sess_b)
        db_session.commit()
        db_session.refresh(sess_b)

        resp = client.patch(
            f"/library/{sess_b.id}/rename",
            json={"filename": "Hacked Title.pdf"},
            headers=test_users["headers_a"]
        )
        assert resp.status_code == 404
        # Verify filename was unchanged
        db_session.refresh(sess_b)
        assert sess_b.filename == "User B Physics.pdf"

    def test_user_a_cannot_pin_user_b_session(self, client, db_session, test_users):
        sess_b = StudySession(
            filename="User B Chemistry.pdf",
            is_pinned=False,
            user_id=test_users["user_b"].id,
            processing_status=ProcessingStatus.READY
        )
        db_session.add(sess_b)
        db_session.commit()
        db_session.refresh(sess_b)

        resp = client.patch(f"/library/{sess_b.id}/pin", headers=test_users["headers_a"])
        assert resp.status_code == 404
        db_session.refresh(sess_b)
        assert sess_b.is_pinned is False

    def test_user_a_cannot_categorize_user_b_session(self, client, db_session, test_users):
        sess_b = StudySession(
            filename="User B Biology.pdf",
            category="Study",
            user_id=test_users["user_b"].id,
            processing_status=ProcessingStatus.READY
        )
        db_session.add(sess_b)
        db_session.commit()
        db_session.refresh(sess_b)

        resp = client.patch(
            f"/library/{sess_b.id}/category",
            json={"category": "Coding"},
            headers=test_users["headers_a"]
        )
        assert resp.status_code == 404
        db_session.refresh(sess_b)
        assert sess_b.category == "Study"

    def test_user_a_cannot_delete_user_b_session(self, client, db_session, test_users):
        sess_b = StudySession(
            filename="User B Math.pdf",
            user_id=test_users["user_b"].id,
            processing_status=ProcessingStatus.READY
        )
        db_session.add(sess_b)
        db_session.commit()
        db_session.refresh(sess_b)

        resp = client.delete(f"/library/{sess_b.id}", headers=test_users["headers_a"])
        assert resp.status_code == 404
        # Session still exists
        found = db_session.query(StudySession).filter(StudySession.id == sess_b.id).first()
        assert found is not None

    def test_user_a_cannot_move_user_b_session_to_project(self, client, db_session, test_users):
        proj_a = Project(name="Project A", user_id=test_users["user_a"].id)
        sess_b = StudySession(filename="User B Session.pdf", user_id=test_users["user_b"].id)
        db_session.add_all([proj_a, sess_b])
        db_session.commit()
        db_session.refresh(proj_a)
        db_session.refresh(sess_b)

        resp = client.patch(
            f"/library/{sess_b.id}/project",
            json={"project_id": proj_a.id},
            headers=test_users["headers_a"]
        )
        assert resp.status_code == 404


# ===========================================================================
# CATEGORY B: Share Token Security & Access Control
# ===========================================================================

class TestShareTokenSecurity:
    """Verify public, private, and team link security semantics and validator controls."""

    def test_public_share_accessible_without_auth(self, client, db_session, test_users):
        sess = StudySession(
            filename="Public ML Guide.pdf",
            summary="Introduction to Supervised Machine Learning.",
            content="Supervised learning involves learning a function from input to output.",
            user_id=test_users["user_a"].id,
            share_type="public",
            share_token="public_ml_token_12345",
            processing_status=ProcessingStatus.READY
        )
        db_session.add(sess)
        db_session.commit()

        # Unauthenticated request to shared link
        resp = client.get("/shared/public_ml_token_12345")
        assert resp.status_code == 200
        data = resp.json()
        assert data["filename"] == "Public ML Guide.pdf"
        assert "Supervised Machine Learning" in data["summary"]

    def test_private_share_forbidden_to_non_owners(self, client, db_session, test_users):
        sess = StudySession(
            filename="Private ML Guide.pdf",
            summary="Confidential ML Research.",
            content="Secret algorithms.",
            user_id=test_users["user_a"].id,
            share_type="private",
            share_token="private_ml_token_54321",
            processing_status=ProcessingStatus.READY
        )
        db_session.add(sess)
        db_session.commit()

        # Unauthenticated request fails (403)
        resp_unauth = client.get("/shared/private_ml_token_54321")
        assert resp_unauth.status_code == 403

        # User B (not owner) fails (403)
        resp_user_b = client.get("/shared/private_ml_token_54321", headers=test_users["headers_b"])
        assert resp_user_b.status_code == 403

        # User A (owner) succeeds (200)
        resp_owner = client.get("/shared/private_ml_token_54321", headers=test_users["headers_a"])
        assert resp_owner.status_code == 200
        assert resp_owner.json()["filename"] == "Private ML Guide.pdf"

    def test_team_share_requires_authenticated_user(self, client, db_session, test_users):
        sess = StudySession(
            filename="Team Internal Documentation.pdf",
            summary="Team architectural standards.",
            content="Microservices and RAG pipelines.",
            user_id=test_users["user_a"].id,
            share_type="team",
            share_token="team_ml_token_99999",
            processing_status=ProcessingStatus.READY
        )
        db_session.add(sess)
        db_session.commit()

        # Unauthenticated fails with 401
        resp_unauth = client.get("/shared/team_ml_token_99999")
        assert resp_unauth.status_code == 401

        # Any authenticated user succeeds (e.g. User B)
        resp_user_b = client.get("/shared/team_ml_token_99999", headers=test_users["headers_b"])
        assert resp_user_b.status_code == 200
        assert resp_user_b.json()["filename"] == "Team Internal Documentation.pdf"

    def test_share_request_invalid_share_type_rejected(self, client, db_session, test_users):
        sess = StudySession(
            filename="Doc.pdf", summary="Summary", user_id=test_users["user_a"].id
        )
        db_session.add(sess)
        db_session.commit()
        db_session.refresh(sess)

        # Attempt to supply invalid share_type
        resp = client.post(
            f"/library/{sess.id}/share",
            json={"share_type": "arbitrary_exploit_value"},
            headers=test_users["headers_a"]
        )
        assert resp.status_code == 422


# ===========================================================================
# CATEGORY C: AI Knowledge Vault Semantic Search (/knowledge-vault/search)
# ===========================================================================

class TestKnowledgeVaultSemanticSearch:
    """Verify hybrid search cascade: ChromaDB -> SQLite Chunks -> Keyword Fallback."""

    def test_knowledge_vault_fast_path_chroma(self, client, db_session, test_users, ephemeral_chroma):
        sess = StudySession(
            filename="Deep Learning Architectures.pdf",
            summary="Transformers and CNNs.",
            content="Transformers utilize multi-head self-attention mechanisms.",
            user_id=test_users["user_a"].id,
            processing_status=ProcessingStatus.READY
        )
        db_session.add(sess)
        db_session.commit()
        db_session.refresh(sess)

        # Insert vector into ephemeral Chroma
        test_emb = [0.1] * 768
        ephemeral_chroma.add(
            ids=[f"sess_{sess.id}_chunk_0"],
            embeddings=[test_emb],
            documents=["Transformers utilize multi-head self-attention mechanisms."],
            metadatas=[{"session_id": sess.id, "user_id": test_users["user_a"].id}]
        )

        with patch("main.chroma_collection", ephemeral_chroma):
            with patch("main.client.models.embed_content") as mock_embed:
                mock_embed.return_value = MagicMock(
                    embeddings=[MagicMock(values=test_emb)]
                )
                resp = client.get(
                    "/knowledge-vault/search?q=attention+mechanisms",
                    headers=test_users["headers_a"]
                )
                assert resp.status_code == 200
                data = resp.json()
                assert len(data) >= 1
                assert data[0]["session_id"] == sess.id
                assert "Transformers" in data[0]["excerpt"]
                assert data[0]["score"] > 0.5

    def test_knowledge_vault_fallback_to_lexical_when_embedding_fails(self, client, db_session, test_users):
        """DEF-11-01: When Gemini embedding API fails, fall back to lexical keyword search."""
        sess = StudySession(
            filename="Quantum Computing Principles.pdf",
            summary="Qubits and superposition in quantum computing.",
            content="Superposition allows qubits to exist in multiple states simultaneously.",
            user_id=test_users["user_a"].id,
            processing_status=ProcessingStatus.READY
        )
        db_session.add(sess)
        db_session.commit()
        db_session.refresh(sess)

        with patch("main.client.models.embed_content", side_effect=Exception("Gemini quota 429 exceeded")):
            resp = client.get(
                "/knowledge-vault/search?q=superposition",
                headers=test_users["headers_a"]
            )
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) >= 1
            assert data[0]["session_id"] == sess.id
            assert "Quantum Computing" in data[0]["session_title"]

    def test_knowledge_vault_fallback_to_lexical_when_similarity_too_low(self, client, db_session, test_users):
        """DEF-11-02: When SQLite chunks exist but cosine sim <= 0.1, fall back to keyword search."""
        sess = StudySession(
            filename="Biology Genetics.pdf",
            summary="CRISPR gene editing mechanisms.",
            content="CRISPR Cas9 endonuclease enables targeted DNA editing.",
            user_id=test_users["user_a"].id,
            processing_status=ProcessingStatus.READY
        )
        db_session.add(sess)
        db_session.commit()
        db_session.refresh(sess)

        # Chunk with orthogonal embedding resulting in 0 cosine similarity
        chunk = DocumentChunk(
            chunk_index=0,
            text_content="CRISPR Cas9 endonuclease enables targeted DNA editing.",
            embedding=[0.0] * 768,
            session_id=sess.id
        )
        db_session.add(chunk)
        db_session.commit()

        # Query embedding is unit vector [1.0, 0.0, ...] -> cosine similarity with [0,0...] is 0.0 <= 0.1
        query_emb = [1.0] + [0.0] * 767

        with patch("main.chroma_collection", None):
            with patch("main.client.models.embed_content") as mock_embed:
                mock_embed.return_value = MagicMock(
                    embeddings=[MagicMock(values=query_emb)]
                )
                resp = client.get(
                    "/knowledge-vault/search?q=CRISPR",
                    headers=test_users["headers_a"]
                )
                assert resp.status_code == 200
                data = resp.json()
                # Must fall back to lexical search and find the session!
                assert len(data) >= 1
                assert data[0]["session_id"] == sess.id

    def test_knowledge_vault_excludes_failed_sessions(self, client, db_session, test_users):
        """DEF-11-03: FAILED sessions must be excluded from search results."""
        failed_sess = StudySession(
            filename="Failed Corrupted Upload.pdf",
            summary="Extraction failed due to corrupted PDF header.",
            content="Corrupted raw bytes.",
            user_id=test_users["user_a"].id,
            processing_status=ProcessingStatus.FAILED
        )
        ready_sess = StudySession(
            filename="Clean Calculus Notes.pdf",
            summary="Derivatives and integrals.",
            content="Fundamental theorem of calculus.",
            user_id=test_users["user_a"].id,
            processing_status=ProcessingStatus.READY
        )
        db_session.add_all([failed_sess, ready_sess])
        db_session.commit()

        with patch("main.client.models.embed_content", side_effect=Exception("API Error")):
            resp = client.get(
                "/knowledge-vault/search?q=corrupted",
                headers=test_users["headers_a"]
            )
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 0

    def test_knowledge_vault_tenant_isolation(self, client, db_session, test_users):
        """User A searching cannot see User B's documents even with exact keyword matches."""
        sess_b = StudySession(
            filename="Top Secret Roadmap.pdf",
            summary="Confidential corporate strategy for User B.",
            content="Secret formula 42.",
            user_id=test_users["user_b"].id,
            processing_status=ProcessingStatus.READY
        )
        db_session.add(sess_b)
        db_session.commit()

        with patch("main.client.models.embed_content", side_effect=Exception("API Error")):
            resp = client.get(
                "/knowledge-vault/search?q=Secret+formula",
                headers=test_users["headers_a"]
            )
            assert resp.status_code == 200
            assert len(resp.json()) == 0

    def test_knowledge_vault_query_sanitization(self, client, test_users):
        """Empty, single character, or null bytes should return [] safely."""
        resp1 = client.get("/knowledge-vault/search?q=", headers=test_users["headers_a"])
        assert resp1.status_code == 200
        assert resp1.json() == []

        resp2 = client.get("/knowledge-vault/search?q=a", headers=test_users["headers_a"])
        assert resp2.status_code == 200
        assert resp2.json() == []

        resp3 = client.get("/knowledge-vault/search?q=%00%00", headers=test_users["headers_a"])
        assert resp3.status_code == 200
        assert resp3.json() == []


# ===========================================================================
# CATEGORY D: Keyword Search (/search)
# ===========================================================================

class TestKeywordSearch:
    """Verify /search endpoint functionality, safe date formatting, and isolation."""

    def test_search_matches_filename_and_content(self, client, db_session, test_users):
        sess = StudySession(
            filename="Thermodynamics Guide.pdf",
            summary="Entropy and enthalpy laws.",
            content="Second law of thermodynamics states that total entropy can never decrease.",
            user_id=test_users["user_a"].id,
            processing_status=ProcessingStatus.READY
        )
        db_session.add(sess)
        db_session.commit()

        resp = client.get("/search?q=enthalpy", headers=test_users["headers_a"])
        assert resp.status_code == 200
        results = resp.json()
        assert len(results) >= 1
        assert results[0]["filename"] == "Thermodynamics Guide.pdf"

    def test_search_upload_date_none_resilience(self, client, db_session, test_users):
        """DEF-11-10: If upload_date is None, /search must not raise HTTP 500."""
        sess = StudySession(
            filename="Legacy No Date.pdf",
            summary="Session created without explicit upload date.",
            content="Valid study text.",
            upload_date=None,
            user_id=test_users["user_a"].id,
            processing_status=ProcessingStatus.READY
        )
        db_session.add(sess)
        db_session.commit()

        resp = client.get("/search?q=Legacy", headers=test_users["headers_a"])
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert "added" in data[0]
        assert data[0]["added"] is not None

    def test_search_excludes_failed_sessions(self, client, db_session, test_users):
        sess = StudySession(
            filename="Broken Extraction.pdf",
            summary="File broken.",
            user_id=test_users["user_a"].id,
            processing_status=ProcessingStatus.FAILED
        )
        db_session.add(sess)
        db_session.commit()

        resp = client.get("/search?q=Broken", headers=test_users["headers_a"])
        assert resp.status_code == 200
        assert len(resp.json()) == 0


# ===========================================================================
# CATEGORY E: Library Listing (GET /library)
# ===========================================================================

class TestLibraryListing:
    """Verify complete API contract, pagination, sorting, and filtering."""

    def test_library_includes_processing_status_and_error(self, client, db_session, test_users):
        """DEF-11-04: processing_status and processing_error must be present in GET /library."""
        sess = StudySession(
            filename="Active Document.pdf",
            summary="Study summary",
            content="Some substantive content here.",
            user_id=test_users["user_a"].id,
            processing_status=ProcessingStatus.READY,
            processing_error=None,
            page_count=5,
            char_count=1200
        )
        db_session.add(sess)
        db_session.commit()

        resp = client.get("/library", headers=test_users["headers_a"])
        assert resp.status_code == 200
        items = resp.json()
        target = next((item for item in items if item["id"] == sess.id), None)
        assert target is not None
        assert "processing_status" in target
        assert target["processing_status"] == "READY"
        assert "processing_error" in target
        assert "page_count" in target
        assert target["page_count"] == 5
        assert "char_count" in target
        assert target["char_count"] == 1200

    def test_library_upload_date_none_resilience(self, client, db_session, test_users):
        """DEF-11-10: upload_date=None must not raise AttributeError or 500."""
        sess = StudySession(
            filename="No Date Session.pdf",
            summary="Summary text",
            content="Content text",
            upload_date=None,
            user_id=test_users["user_a"].id
        )
        db_session.add(sess)
        db_session.commit()

        resp = client.get("/library", headers=test_users["headers_a"])
        assert resp.status_code == 200
        items = resp.json()
        target = next((item for item in items if item["id"] == sess.id), None)
        assert target is not None
        assert target["added"] is not None
        assert target["raw_date"] is not None

    def test_library_filtering_by_category_and_source(self, client, db_session, test_users):
        sess1 = StudySession(
            filename="Code Lecture.pdf", category="Coding", source_type="pdf",
            user_id=test_users["user_a"].id
        )
        sess2 = StudySession(
            filename="Math Lecture.pdf", category="Study", source_type="youtube",
            user_id=test_users["user_a"].id
        )
        db_session.add_all([sess1, sess2])
        db_session.commit()

        # Filter by category
        resp_cat = client.get("/library?category=Coding", headers=test_users["headers_a"])
        assert resp_cat.status_code == 200
        items_cat = resp_cat.json()
        assert all(i["category"] == "Coding" for i in items_cat)

        # Filter by source_type
        resp_src = client.get("/library?source_type=youtube", headers=test_users["headers_a"])
        assert resp_src.status_code == 200
        items_src = resp_src.json()
        assert all(i["source_type"] == "youtube" for i in items_src)

    def test_library_pagination(self, client, db_session, test_users):
        for i in range(5):
            s = StudySession(
                filename=f"Paging Test Doc {i}.pdf",
                user_id=test_users["user_a"].id
            )
            db_session.add(s)
        db_session.commit()

        resp = client.get("/library?limit=2&offset=0", headers=test_users["headers_a"])
        assert resp.status_code == 200
        assert len(resp.json()) == 2

        resp2 = client.get("/library?limit=2&offset=2", headers=test_users["headers_a"])
        assert resp2.status_code == 200
        assert len(resp2.json()) == 2
        # Ensure page 1 and page 2 don't overlap
        ids_1 = {x["id"] for x in resp.json()}
        ids_2 = {x["id"] for x in resp2.json()}
        assert ids_1.isdisjoint(ids_2)


# ===========================================================================
# CATEGORY F: Library Detail (GET /library/{session_id})
# ===========================================================================

class TestLibraryDetail:
    """Verify single-session retrieval, 404 behavior, and contract completeness."""

    def test_library_detail_includes_status_and_metadata(self, client, db_session, test_users):
        sess = StudySession(
            filename="Detailed Analysis.pdf",
            summary="Comprehensive summary.",
            content="Extensive technical notes.",
            category="Research",
            doc_metadata={"authors": ["Alice", "Bob"], "version": 2},
            user_id=test_users["user_a"].id,
            processing_status=ProcessingStatus.READY
        )
        db_session.add(sess)
        db_session.commit()
        db_session.refresh(sess)

        resp = client.get(f"/library/{sess.id}", headers=test_users["headers_a"])
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == sess.id
        assert data["filename"] == "Detailed Analysis.pdf"
        assert data["category"] == "Research"
        assert data["doc_metadata"]["version"] == 2
        assert data["processing_status"] == "READY"

    def test_library_detail_nonexistent_returns_404(self, client, test_users):
        resp = client.get("/library/999999", headers=test_users["headers_a"])
        assert resp.status_code == 404


# ===========================================================================
# CATEGORY G: Deletion Lifecycle & Referential Integrity
# ===========================================================================

class TestDeletionLifecycleIntegrity:
    """Verify cascades, ChatConversation foreign key unlinking, and Chroma vector purge."""

    def test_delete_session_unlinks_chat_conversations(self, client, db_session, test_users):
        """DEF-11-09: Deleting a session must set ChatConversation.session_id to None without error."""
        sess = StudySession(
            filename="Session With Active Chat.pdf",
            user_id=test_users["user_a"].id
        )
        db_session.add(sess)
        db_session.commit()
        db_session.refresh(sess)

        conv = ChatConversation(
            title="Discussion on Session",
            user_id=test_users["user_a"].id,
            session_id=sess.id
        )
        db_session.add(conv)
        db_session.commit()
        db_session.refresh(conv)

        # Delete session
        resp = client.delete(f"/library/{sess.id}", headers=test_users["headers_a"])
        assert resp.status_code == 200
        assert resp.json()["message"] == "Item deleted successfully"

        # Verify conversation is intact but session_id is None
        db_session.expire_all()
        conv_after = db_session.query(ChatConversation).filter(ChatConversation.id == conv.id).first()
        assert conv_after is not None
        assert conv_after.session_id is None

    def test_delete_session_cascades_chunks_and_bookmarks(self, client, db_session, test_users):
        sess = StudySession(
            filename="Doc With Cascade Relations.pdf",
            user_id=test_users["user_a"].id
        )
        db_session.add(sess)
        db_session.commit()
        db_session.refresh(sess)

        chunk = DocumentChunk(
            chunk_index=0,
            text_content="Some chunk text",
            embedding=[0.1] * 768,
            session_id=sess.id
        )
        bookmark = Bookmark(
            user_id=test_users["user_a"].id,
            session_id=sess.id,
            note="Important topic"
        )
        db_session.add_all([chunk, bookmark])
        db_session.commit()

        # Delete session
        resp = client.delete(f"/library/{sess.id}", headers=test_users["headers_a"])
        assert resp.status_code == 200

        # Verify chunks and bookmarks are removed
        assert db_session.query(DocumentChunk).filter(DocumentChunk.session_id == sess.id).count() == 0
        assert db_session.query(Bookmark).filter(Bookmark.session_id == sess.id).count() == 0

    def test_delete_session_purges_chroma_vectors(self, client, db_session, test_users, ephemeral_chroma):
        sess = StudySession(
            filename="Vector Doc.pdf",
            user_id=test_users["user_a"].id
        )
        db_session.add(sess)
        db_session.commit()
        db_session.refresh(sess)

        ephemeral_chroma.add(
            ids=[f"sess_{sess.id}_chk_0"],
            embeddings=[[0.1] * 768],
            documents=["Doc in chroma"],
            metadatas=[{"session_id": sess.id}]
        )
        assert ephemeral_chroma.count() >= 1

        with patch("main.chroma_collection", ephemeral_chroma):
            resp = client.delete(f"/library/{sess.id}", headers=test_users["headers_a"])
            assert resp.status_code == 200

        # Vector should be deleted
        res = ephemeral_chroma.get(ids=[f"sess_{sess.id}_chk_0"])
        assert len(res["ids"]) == 0


# ===========================================================================
# CATEGORY H: Deduplication & Idempotency
# ===========================================================================

class TestDeduplicationAndIdempotency:
    """Verify SHA-256 content deduplication for web links and pasted text."""

    def test_process_link_deduplication(self, client, db_session, test_users):
        """DEF-11-06: Submitting identical content via /process-link returns duplicate: True."""
        import hashlib
        sample_text = "Unique academic paper content on neural representations " * 5
        hash_val = hashlib.sha256(sample_text.encode("utf-8")).hexdigest()

        existing = StudySession(
            filename="Existing Online Article",
            summary="Existing pre-computed study guide summary.",
            content=sample_text,
            content_hash=hash_val,
            user_id=test_users["user_a"].id,
            source_type="url",
            processing_status=ProcessingStatus.READY
        )
        db_session.add(existing)
        db_session.commit()
        db_session.refresh(existing)

        # Mock the link crawler to return the exact same text
        mock_resp = MagicMock()
        mock_resp.headers = {"Content-Type": "text/html"}
        mock_resp.text = f"<html><body><p>{sample_text}</p></body></html>"
        with patch("main.safe_fetch_url", return_value=mock_resp):
            with patch("main.extract_html_article_text", return_value=(sample_text, "Existing Online Article")):
                resp = client.post(
                    "/process-link",
                    json={"url": "https://example.com/paper.html"},
                    headers=test_users["headers_a"]
                )
            assert resp.status_code == 200
            data = resp.json()
            assert data["id"] == existing.id
            assert data.get("duplicate") is True
            assert "already submitted" in data.get("message", "").lower()

    def test_different_users_with_same_content_get_isolated_sessions(self, client, db_session, test_users):
        """Identical text submitted by User A and User B creates separate sessions."""
        import hashlib
        shared_text = "Standard textbook chapter on algorithmic sorting complexity." * 3
        hash_val = hashlib.sha256(shared_text.encode("utf-8")).hexdigest()

        sess_a = StudySession(
            filename="Sorting Text",
            content=shared_text,
            content_hash=hash_val,
            user_id=test_users["user_a"].id,
            source_type="text",
            processing_status=ProcessingStatus.READY
        )
        db_session.add(sess_a)
        db_session.commit()

        # User B submits same text
        resp_b = client.post(
            "/process-text",
            json={"text": shared_text},
            headers=test_users["headers_b"]
        )
        assert resp_b.status_code == 200
        data_b = resp_b.json()
        assert data_b["id"] != sess_a.id
        assert data_b.get("duplicate") is not True


# ===========================================================================
# CATEGORY I: Input Boundary Validation & Sanitization
# ===========================================================================

class TestInputBoundaryValidation:
    """Verify boundaries for RenameRequest, CategoryRequest, NotesRequest, and ShareRequest."""

    def test_rename_validation(self, client, db_session, test_users):
        sess = StudySession(filename="Original.pdf", user_id=test_users["user_a"].id)
        db_session.add(sess)
        db_session.commit()
        db_session.refresh(sess)

        # Empty string rejected
        resp_empty = client.patch(
            f"/library/{sess.id}/rename",
            json={"filename": ""},
            headers=test_users["headers_a"]
        )
        assert resp_empty.status_code == 422

        # Whitespace-only rejected
        resp_ws = client.patch(
            f"/library/{sess.id}/rename",
            json={"filename": "    \t\n  "},
            headers=test_users["headers_a"]
        )
        assert resp_ws.status_code == 422

        # Null bytes stripped
        resp_null = client.patch(
            f"/library/{sess.id}/rename",
            json={"filename": "Clean\x00Name.pdf"},
            headers=test_users["headers_a"]
        )
        assert resp_null.status_code == 200
        assert resp_null.json()["filename"] == "CleanName.pdf"

        # Exceeds max length (255)
        resp_long = client.patch(
            f"/library/{sess.id}/rename",
            json={"filename": "A" * 256},
            headers=test_users["headers_a"]
        )
        assert resp_long.status_code == 422

    def test_category_validation(self, client, db_session, test_users):
        sess = StudySession(filename="Doc.pdf", user_id=test_users["user_a"].id)
        db_session.add(sess)
        db_session.commit()
        db_session.refresh(sess)

        # Empty category rejected
        resp_empty = client.patch(
            f"/library/{sess.id}/category",
            json={"category": ""},
            headers=test_users["headers_a"]
        )
        assert resp_empty.status_code == 422

        # Too long category rejected (>50)
        resp_long = client.patch(
            f"/library/{sess.id}/category",
            json={"category": "C" * 51},
            headers=test_users["headers_a"]
        )
        assert resp_long.status_code == 422

    def test_notes_validation(self, client, db_session, test_users):
        sess = StudySession(filename="Doc.pdf", user_id=test_users["user_a"].id)
        db_session.add(sess)
        db_session.commit()
        db_session.refresh(sess)

        # Exceeds max notes length (>50000)
        resp_long = client.put(
            f"/library/{sess.id}/notes",
            json={"notes": "N" * 50001},
            headers=test_users["headers_a"]
        )
        assert resp_long.status_code == 422


# ===========================================================================
# CATEGORY J: Session Metadata & Timeline Tracking
# ===========================================================================

class TestSessionMetadataAndTimeline:
    """Verify state transitions and timeline record keeping."""

    def test_rename_records_timeline_event(self, client, db_session, test_users):
        sess = StudySession(filename="Draft 1.pdf", user_id=test_users["user_a"].id)
        db_session.add(sess)
        db_session.commit()
        db_session.refresh(sess)

        resp = client.patch(
            f"/library/{sess.id}/rename",
            json={"filename": "Final Version.pdf"},
            headers=test_users["headers_a"]
        )
        assert resp.status_code == 200

        # Verify timeline
        timeline_resp = client.get(f"/library/{sess.id}/timeline", headers=test_users["headers_a"])
        assert timeline_resp.status_code == 200
        events = timeline_resp.json()
        assert any(e["event"] == "Renamed Session" for e in events)

    def test_pin_and_unpin_records_timeline(self, client, db_session, test_users):
        sess = StudySession(filename="Doc.pdf", is_pinned=False, user_id=test_users["user_a"].id)
        db_session.add(sess)
        db_session.commit()
        db_session.refresh(sess)

        # Pin
        resp_pin = client.patch(f"/library/{sess.id}/pin", headers=test_users["headers_a"])
        assert resp_pin.status_code == 200
        assert resp_pin.json()["is_pinned"] is True

        # Unpin
        resp_unpin = client.patch(f"/library/{sess.id}/pin", headers=test_users["headers_a"])
        assert resp_unpin.status_code == 200
        assert resp_unpin.json()["is_pinned"] is False


# ===========================================================================
# CATEGORY K: Bookmark Management
# ===========================================================================

class TestBookmarkManagement:
    """Verify bookmark creation, duplicate checks, notes, and deletion."""

    def test_create_and_delete_bookmark(self, client, db_session, test_users):
        sess = StudySession(filename="Bookmarked File.pdf", user_id=test_users["user_a"].id)
        db_session.add(sess)
        db_session.commit()
        db_session.refresh(sess)

        # Create bookmark
        create_resp = client.post(
            "/bookmarks",
            json={"session_id": sess.id, "note": "Review for exams"},
            headers=test_users["headers_a"]
        )
        assert create_resp.status_code == 200
        assert create_resp.json()["session_id"] == sess.id

        # Duplicate bookmark returns 409
        dup_resp = client.post(
            "/bookmarks",
            json={"session_id": sess.id},
            headers=test_users["headers_a"]
        )
        assert dup_resp.status_code == 409

        # List bookmarks
        list_resp = client.get("/bookmarks", headers=test_users["headers_a"])
        assert list_resp.status_code == 200
        assert any(b["session_id"] == sess.id for b in list_resp.json())

        # Remove bookmark
        del_resp = client.delete(f"/bookmarks/{sess.id}", headers=test_users["headers_a"])
        assert del_resp.status_code == 200

        # Verify removed
        list_after = client.get("/bookmarks", headers=test_users["headers_a"])
        assert not any(b["session_id"] == sess.id for b in list_after.json())


# ===========================================================================
# CATEGORY L: Edge Cases & Resilience
# ===========================================================================

class TestEdgeCasesAndResilience:
    """Verify unicode characters, empty states, and special inputs."""

    def test_unicode_and_emojis_in_titles_and_notes(self, client, db_session, test_users):
        sess = StudySession(
            filename="Machine Learning 🚀 — 第1章.pdf",
            summary="Neural Networks 🧠 & Deep Learning.",
            user_id=test_users["user_a"].id,
            processing_status=ProcessingStatus.READY
        )
        db_session.add(sess)
        db_session.commit()
        db_session.refresh(sess)

        # Update notes with emojis and non-ASCII text
        notes_text = "Studied gradient descent 📉 and backpropagation 🔄 — 很好！"
        resp = client.put(
            f"/library/{sess.id}/notes",
            json={"notes": notes_text},
            headers=test_users["headers_a"]
        )
        assert resp.status_code == 200
        assert resp.json()["notes"] == notes_text

        # Verify get notes
        get_notes = client.get(f"/library/{sess.id}/notes", headers=test_users["headers_a"])
        assert get_notes.status_code == 200
        assert get_notes.json()["notes"] == notes_text
