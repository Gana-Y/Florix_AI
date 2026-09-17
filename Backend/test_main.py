import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from auth import get_db
from database import Base, User
from main import app

# Use SQLite test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_main_db.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    app.dependency_overrides.pop(get_db, None)
    try:
        if os.path.exists("test_main_db.db"):
            os.remove("test_main_db.db")
    except Exception:
        pass

client = TestClient(app)

def test_signup():
    response = client.post(
        "/signup",
        json={"name": "Test User", "email": "test@example.com", "password": "Password123!"}
    )
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_login():
    response = client.post(
        "/login",
        json={"email": "test@example.com", "password": "Password123!"}
    )
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_unauthorized_access():
    response = client.get("/me")
    assert response.status_code == 401

def test_get_me():
    # Login first
    login_response = client.post(
        "/login",
        json={"email": "test@example.com", "password": "Password123!"}
    )
    token = login_response.json()["access_token"]
    
    # Access protected route
    response = client.get(
        "/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"
