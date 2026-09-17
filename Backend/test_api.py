"""
Florix AI — Pytest Test Suite
Tests critical API endpoints: auth, health, subscriptions, library, chat.
Run with: pytest test_api.py -v
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Use in-memory SQLite for tests
TEST_DB_URL = "sqlite:///./test_florix.db"
os.environ["GEMINI_API_KEY"] = "test_key_not_used_in_unit_tests"
os.environ["JWT_SECRET"] = "test_secret_for_unit_testing_only"

from database import Base
from auth import get_db
from main import app

engine_test = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine_test)
    yield
    Base.metadata.drop_all(bind=engine_test)
    engine_test.dispose()
    app.dependency_overrides.pop(get_db, None)
    try:
        if os.path.exists("test_florix.db"):
            os.remove("test_florix.db")
    except Exception:
        pass

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="module")
def auth_headers(client):
    """Register a test user and return auth headers."""
    client.post("/signup", json={"name": "Test User", "email": "test@florix.ai", "password": "SecurePass123!"})
    resp = client.post("/login", json={"email": "test@florix.ai", "password": "SecurePass123!"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ── Health Check ───────────────────────────────────────────────────────────────
class TestHealth:
    def test_health_returns_ok(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert "status" in data
        assert "version" in data
        assert "database" in data

    def test_health_has_timestamp(self, client):
        r = client.get("/health")
        assert "timestamp" in r.json()


# ── Authentication ─────────────────────────────────────────────────────────────
class TestAuth:
    def test_signup_success(self, client):
        r = client.post("/signup", json={"name": "Alice", "email": "alice@test.com", "password": "SecurePass123!"})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == "alice@test.com"
        assert data["user"]["plan"] == "free"

    def test_signup_duplicate_email(self, client):
        client.post("/signup", json={"name": "Bob", "email": "bob@test.com", "password": "SecurePass123!"})
        r = client.post("/signup", json={"name": "Bob Duplicate", "email": "bob@test.com", "password": "SecurePass123!"})
        assert r.status_code == 400
        assert "already registered" in r.json()["detail"]

    def test_signup_short_password(self, client):
        r = client.post("/signup", json={"name": "Carol", "email": "carol@test.com", "password": "short"})
        assert r.status_code == 400

    def test_login_success(self, client, auth_headers):
        r = client.post("/login", json={"email": "test@florix.ai", "password": "SecurePass123!"})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_login_wrong_password(self, client):
        r = client.post("/login", json={"email": "test@florix.ai", "password": "WrongPassword123!"})
        assert r.status_code == 401

    def test_get_me_authenticated(self, client, auth_headers):
        r = client.get("/me", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "test@florix.ai"
        assert "plan" in data

    def test_get_me_unauthenticated(self, client):
        r = client.get("/me")
        assert r.status_code == 401

    def test_update_name(self, client, auth_headers):
        r = client.patch("/me", json={"name": "Updated Name"}, headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["name"] == "Updated Name"

    def test_change_password_wrong_current(self, client, auth_headers):
        r = client.post("/me/change-password",
                        json={"current_password": "WrongPassword123!", "new_password": "NewSecurePass123!"},
                        headers=auth_headers)
        assert r.status_code == 400

    def test_forgot_password_returns_token(self, client):
        r = client.post("/forgot-password", json={"email": "test@florix.ai"})
        assert r.status_code == 200
        data = r.json()
        assert "demo_token" in data

    def test_forgot_password_nonexistent_email(self, client):
        # Should not reveal whether email exists
        r = client.post("/forgot-password", json={"email": "nobody@nowhere.com"})
        assert r.status_code == 200


# ── Subscription ───────────────────────────────────────────────────────────────
class TestSubscription:
    def test_get_subscription(self, client, auth_headers):
        r = client.get("/subscription", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["plan"] == "free"
        assert "limits" in data
        assert "usage" in data
        assert "plans" in data

    def test_upgrade_to_pro(self, client, auth_headers):
        r = client.post("/subscription/upgrade", json={"plan": "pro"}, headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["plan"] == "pro"

    def test_cancel_subscription(self, client, auth_headers):
        r = client.post("/subscription/cancel", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["plan"] == "free"

    def test_invalid_plan_upgrade(self, client, auth_headers):
        r = client.post("/subscription/upgrade", json={"plan": "enterprise"}, headers=auth_headers)
        assert r.status_code == 400


# ── Stats ──────────────────────────────────────────────────────────────────────
class TestStats:
    def test_get_stats(self, client, auth_headers):
        r = client.get("/stats", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "total_sessions" in data
        assert "total_quizzes" in data
        assert "avg_quiz_score" in data
        assert "quiz_trend" in data
        assert "plan" in data

    def test_get_history(self, client, auth_headers):
        r = client.get("/history", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ── Library & Search ───────────────────────────────────────────────────────────
class TestLibrary:
    def test_get_empty_library(self, client, auth_headers):
        r = client.get("/library", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_search_empty_query(self, client, auth_headers):
        r = client.get("/search?q=", headers=auth_headers)
        assert r.status_code == 200

    def test_search_with_query(self, client, auth_headers):
        r = client.get("/search?q=machine+learning", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ── Bookmarks ──────────────────────────────────────────────────────────────────
class TestBookmarks:
    def test_get_bookmarks_empty(self, client, auth_headers):
        r = client.get("/bookmarks", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_bookmark_nonexistent_session(self, client, auth_headers):
        r = client.post("/bookmarks", json={"session_id": 99999}, headers=auth_headers)
        assert r.status_code == 404


# ── Conversations ──────────────────────────────────────────────────────────────
class TestConversations:
    def test_list_conversations_empty(self, client, auth_headers):
        r = client.get("/conversations", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_conversation(self, client, auth_headers):
        r = client.post("/conversations", json={"title": "Test Conversation"}, headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["title"] == "Test Conversation"
        assert "id" in data

    def test_rename_conversation(self, client, auth_headers):
        create = client.post("/conversations", json={"title": "Old Title"}, headers=auth_headers)
        conv_id = create.json()["id"]
        r = client.patch(f"/conversations/{conv_id}", json={"title": "New Title"}, headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["title"] == "New Title"

    def test_delete_conversation(self, client, auth_headers):
        create = client.post("/conversations", json={"title": "To Delete"}, headers=auth_headers)
        conv_id = create.json()["id"]
        r = client.delete(f"/conversations/{conv_id}", headers=auth_headers)
        assert r.status_code == 200

    def test_get_messages_nonexistent(self, client, auth_headers):
        r = client.get("/conversations/99999/messages", headers=auth_headers)
        assert r.status_code == 404
