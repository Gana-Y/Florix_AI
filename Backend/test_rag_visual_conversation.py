import os
import sys
import json
import pytest
from fastapi.testclient import TestClient

from main import app
from database import SessionLocal, User, StudySession, ChatConversation, ChatMessage, Project
from auth import create_access_token, get_password_hash


def test_rag_visual_flow_and_pronoun_resolution():
    client = TestClient(app)
    db = SessionLocal()
    try:
        # 1. Setup user
        user = db.query(User).filter(User.email == "visual_test_user@florix.test").first()
        if not user:
            user = User(
                email="visual_test_user@florix.test",
                name="Visual Test User",
                hashed_password=get_password_hash("Password123!"),
                plan="pro"
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        token = create_access_token(data={"sub": user.email})
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Setup project with a distracting background document
        project = db.query(Project).filter(Project.name == "Color Design Lab", Project.user_id == user.id).first()
        if not project:
            project = Project(
                name="Color Design Lab",
                user_id=user.id,
                icon="🎨",
                color="blue"
            )
            db.add(project)
            db.commit()
            db.refresh(project)

        # Distracting background image session in space
        session = db.query(StudySession).filter(StudySession.filename == "Digital Color Theory and Solid Fields", StudySession.user_id == user.id).first()
        if not session:
            session = StudySession(
                user_id=user.id,
                project_id=project.id,
                filename="Digital Color Theory and Solid Fields",
                source_type="image",
                content="Solid color field #4F6A82 representing muted blue-gray slate digital color analysis.",
                summary="A uniform, solid color field with the hex code #4F6A82. Muted deep blue-gray used for color palette testing."
            )
            db.add(session)
            db.commit()
            db.refresh(session)

        # 3. Create conversation in this space
        conv = ChatConversation(
            title="RAG Discussion",
            user_id=user.id,
            project_id=project.id
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

        # Turn 1: "What do you know about RAG?"
        res1 = client.post(
            f"/conversations/{conv.id}/message",
            json={"message": "What do you know about RAG?", "response_style": "balanced"},
            headers=headers
        )
        assert res1.status_code == 200, f"Turn 1 failed: {res1.text}"
        reply1 = res1.json()["reply"]
        print("\n--- TURN 1 REPLY ---")
        print(reply1[:300] + "...")
        assert "retrieval" in reply1.lower() or "rag" in reply1.lower(), "Reply 1 should explain RAG"

        # Turn 2: "could you give me the image of it?"
        res2 = client.post(
            f"/conversations/{conv.id}/message",
            json={"message": "could you give me the image of it?", "response_style": "balanced"},
            headers=headers
        )
        assert res2.status_code == 200, f"Turn 2 failed: {res2.text}"
        reply2 = res2.json()["reply"]
        print("\n--- TURN 2 REPLY ---")
        print(reply2)

        # Assertions for Turn 2:
        # a) No canned refusal disclaimer
        refusal_phrases = [
            "don't have the ability to directly render",
            "do not have the ability to directly render",
            "cannot render or output image files",
            "as an ai, i cannot generate images"
        ]
        for phrase in refusal_phrases:
            assert phrase not in reply2.lower(), f"Reply 2 should not have canned refusal: '{phrase}'"

        # b) Pronoun resolution: Should not be hijacked by the space document
        assert "digital color theory" not in reply2.lower(), "Reply 2 must not hallucinate the unrelated space document title"
        assert "solid fields" not in reply2.lower(), "Reply 2 must not discuss the unrelated space document content"
        assert "color palette" not in reply2.lower(), "Reply 2 must not discuss color palette instead of RAG"
        assert "rag" in reply2.lower() or "retrieval" in reply2.lower(), "Reply 2 must be focused on RAG"

        # c) Visual rendering presence: Must contain grounded Mermaid diagram and NO hallucinated diffusion links
        assert "```mermaid" in reply2, "Reply 2 must include a grounded Mermaid architecture diagram!"
        assert "pollinations.ai" not in reply2, "Reply 2 must not use ungrounded diffusion art links!"

        print("\n[PASSED] TEST PASSED: Turn 2 successfully resolved pronoun 'it' to RAG, avoided space distraction, avoided canned refusal, and delivered grounded Mermaid diagram without hallucinated art.")

    finally:
        db.close()


if __name__ == "__main__":
    test_rag_visual_flow_and_pronoun_resolution()
