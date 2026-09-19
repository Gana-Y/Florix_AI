"""
Florix AI — Real External Web Link Ingestion & RAG Verification Script
Executes real outbound HTTP request, end-to-end ingestion, embedding, storage, and chat retrieval.
Author: Ganesh (Lead Architect)
"""

import sys
import json
import time
from fastapi.testclient import TestClient

from main import app, get_db, process_upload_in_background
from database import SessionLocal, User, StudySession, DocumentChunk
from auth import create_access_token


def run_live_web_verification():
    print("=" * 70)
    print("FLORIX AI — AUDIT #4 REAL EXTERNAL WEB INGESTION VERIFICATION")
    print("=" * 70)

    db = SessionLocal()
    client = TestClient(app)

    # 1. Setup Verification User
    user_email = "audit4_live_verifier@florix.test"
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        user = User(name="Audit4 Live Verifier", email=user_email, hashed_password="hash_audit4_live", plan="premium")
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.plan = "premium"
        db.commit()

    token = create_access_token(data={"sub": user.email})
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Real External URL
    target_url = "https://httpbin.org/html"
    print(f"[*] Target URL: {target_url}")

    # 3. POST /process-link (Triggers actual outbound network request)
    t0 = time.time()
    response = client.post("/process-link", json={"url": target_url}, headers=headers)
    elapsed = time.time() - t0

    print(f"[*] HTTP Status: {response.status_code} (took {elapsed:.2f}s)")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    session_id = data["id"]
    print(f"[*] Created Session ID: {session_id}")
    print(f"[*] Session Filename: {data['filename']}")

    # 4. Wait for / run background processing
    session = db.query(StudySession).filter(StudySession.id == session_id).first()
    assert session is not None, "StudySession not found in database!"

    print(f"[*] Initial processing status: {session.processing_status}")
    print(f"[*] Stored doc_metadata: {session.doc_metadata}")
    print(f"[*] Stored source_type: {session.source_type}")
    print(f"[*] Content length: {len(session.content)} characters")

    # TestClient may execute background tasks synchronously during POST; if not READY, process now
    if session.processing_status != "READY":
        process_upload_in_background(
            session_id=session.id,
            source_type="url",
            text_content=session.content
        )
        db.refresh(session)
    print(f"[*] Post-processing status: {session.processing_status}")
    assert session.processing_status == "READY", f"Expected READY, got {session.processing_status}"

    # 5. Check SQLite DocumentChunk
    chunks = db.query(DocumentChunk).filter(DocumentChunk.session_id == session_id).all()
    sqlite_chunk_count = len(chunks)
    print(f"[*] SQLite DocumentChunk Count: {sqlite_chunk_count}")
    assert sqlite_chunk_count > 0, "No chunks created in SQLite!"

    for chk in chunks:
        assert chk.page_number is None, f"Expected page_number=None, got {chk.page_number}"
        chk_meta = chk.chunk_metadata or {}
        assert chk_meta.get("source_url") == target_url, f"Expected source_url in chunk metadata, got {chk_meta}"

    # 6. Check ChromaDB Collection
    from main import chroma_collection
    chroma_count = 0
    if chroma_collection:
        chroma_res = chroma_collection.get(
            where={"session_id": int(session_id)},
            include=["metadatas", "documents"]
        )
        chroma_count = len(chroma_res["ids"])
        print(f"[*] ChromaDB Indexed Chunk Count: {chroma_count}")
        assert chroma_count == sqlite_chunk_count, f"Chroma chunk count ({chroma_count}) != SQLite ({sqlite_chunk_count})"
        for c_meta in chroma_res["metadatas"]:
            assert c_meta.get("source_url") == target_url, f"Chroma chunk missing source_url: {c_meta}"
            assert c_meta.get("source_type") == "url", f"Chroma chunk missing source_type='url': {c_meta}"

    # 7. POST /chat with deterministic query from the page
    query = "Who was Perth and what equipment had he retained on deck?"
    print(f"\n[*] Executing Grounded Chat Query: '{query}'")
    chat_resp = client.post(
        "/chat",
        json={"session_id": session_id, "message": query},
        headers=headers
    )
    print(f"[*] Chat Response Status: {chat_resp.status_code}")
    assert chat_resp.status_code == 200, f"Chat failed: {chat_resp.text}"
    chat_data = chat_resp.json()

    ai_reply = chat_data.get("reply") or chat_data.get("response") or ""
    citations = chat_data.get("citations", [])

    print(f"[*] AI Response:\n{ai_reply}\n")
    print(f"[*] Citations Count: {len(citations)}")
    for cit in citations:
        print(f"    - Citation: {json.dumps(cit, indent=2)}")

    # 8. Assert Grounding & Web Citation Integrity
    assert len(citations) > 0, "Expected at least 1 citation for grounded answer!"
    primary_citation = citations[0]
    assert primary_citation.get("source_type") == "url", f"Expected source_type='url', got {primary_citation.get('source_type')}"
    assert primary_citation.get("source_url") == target_url, f"Expected source_url='{target_url}', got {primary_citation.get('source_url')}"
    assert "page_number" not in primary_citation or primary_citation.get("page_number") is None, f"Fabricated page_number found: {primary_citation.get('page_number')}"

    # 9. Verify Deterministic Academic Keywords
    reply_lower = ai_reply.lower()
    assert any(k in reply_lower for k in ("perth", "blacksmith", "forge")), f"Answer did not reference grounded content: {ai_reply}"

    print("=" * 70)
    print("SUCCESS: REAL EXTERNAL WEB INGESTION & RAG VERIFICATION COMPLETED")
    print("=" * 70)
    db.close()


if __name__ == "__main__":
    run_live_web_verification()
