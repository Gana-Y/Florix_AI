# pyrefly: ignore [missing-import]
from sqlalchemy import create_engine, Column, Integer, Float, String, Text, DateTime, ForeignKey, JSON, Boolean, Enum as SAEnum, UniqueConstraint
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.declarative import declarative_base
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import enum

# 🔗 CONNECTION STRING
# Using SQLite for easier local development and deployment without external dependencies
SQLALCHEMY_DATABASE_URL = "sqlite:///./florix.db"

# ⚙️ ENGINE SETUP
# connect_args={"check_same_thread": False} is needed for SQLite in FastAPI
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- 📊 DATABASE MODELS ---

class PlanEnum(str, enum.Enum):
    free = "free"
    pro = "pro"
    premium = "premium"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    plan = Column(String, default="free")  # free | pro | premium
    plan_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_admin = Column(Boolean, default=False)
    country = Column(String, default="Unknown")
    onboarding_info = Column(JSON, default=lambda: {})
    # 🔥 Study streak tracking
    study_streak = Column(Integer, default=0)
    last_study_date = Column(DateTime, nullable=True)

    # Relationships
    sessions = relationship("StudySession", back_populates="user", cascade="all, delete-orphan")
    activities = relationship("Activity", back_populates="user", cascade="all, delete-orphan")
    quiz_results = relationship("QuizResult", back_populates="student", cascade="all, delete-orphan")
    conversations = relationship("ChatConversation", back_populates="user", cascade="all, delete-orphan")
    bookmarks = relationship("Bookmark", back_populates="user", cascade="all, delete-orphan")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")
    flashcard_progress = relationship("FlashcardProgress", back_populates="user", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    feedbacks = relationship("Feedback", back_populates="user", cascade="all, delete-orphan")
    topic_mastery = relationship("LearnerTopicMastery", back_populates="user", cascade="all, delete-orphan")
    learning_events = relationship("LearningEvent", back_populates="user", cascade="all, delete-orphan")

class StudySession(Base):
    __tablename__ = "study_sessions"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    ai_title = Column(String, nullable=True)          # AI-generated smart title
    summary = Column(Text)
    content = Column(Text)
    upload_date = Column(DateTime, default=datetime.utcnow)
    source_type = Column(String, default="pdf")  # pdf | audio | youtube | url | text
    # 🔗 Share + duplicate detection
    content_hash = Column(String, nullable=True, index=True)
    share_token = Column(String, nullable=True, unique=True, index=True)
    share_type = Column(String, default="public")       # public | private | team
    # 🧠 Session intelligence
    category = Column(String, nullable=True)           # Study|Coding|Research|Business|Personal|Career|Interview
    is_pinned = Column(Boolean, default=False)
    intelligence_score = Column(Integer, default=0)
    insights = Column(JSON, default=lambda: {})        # AI-generated topics, weak areas, suggested next
    timeline = Column(JSON, default=lambda: [])        # [{event, timestamp, detail}]
    notes = Column(Text, nullable=True)                # User's personal notes for the session

    # JSON columns — use factory lambdas to avoid mutable default sharing
    quiz_data  = Column(JSON, default=lambda: [])
    flashcards = Column(JSON, default=lambda: [])
    scores     = Column(JSON, default=lambda: [])

    # Phase 2 — Academic RAG Engine enhancements
    processing_status = Column(String, default="READY", index=True)  # UPLOADED|EXTRACTING|CHUNKING|EMBEDDING|INDEXING|READY|FAILED
    processing_error = Column(Text, nullable=True)
    page_count = Column(Integer, default=1)
    char_count = Column(Integer, default=0)
    doc_metadata = Column(JSON, default=lambda: {})

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)

    user = relationship("User", back_populates="sessions")
    project = relationship("Project", back_populates="sessions")
    quizzes = relationship("QuizResult", back_populates="session", cascade="all, delete-orphan")
    bookmarks = relationship("Bookmark", back_populates="session", cascade="all, delete-orphan")
    chunks = relationship("DocumentChunk", back_populates="session", cascade="all, delete-orphan")
    flashcard_progress = relationship("FlashcardProgress", back_populates="session", cascade="all, delete-orphan")
    topic_mastery = relationship("LearnerTopicMastery", back_populates="session", cascade="all, delete-orphan")
    learning_events = relationship("LearningEvent", back_populates="session", cascade="all, delete-orphan")

class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    id = Column(Integer, primary_key=True, index=True)
    chunk_index = Column(Integer, nullable=False)
    text_content = Column(Text, nullable=False)
    embedding = Column(JSON, nullable=False)  # Stores the 3072-dimensional float list as JSON

    # Phase 2 — Academic RAG metadata
    page_number = Column(Integer, default=1, nullable=True)
    section_heading = Column(String, nullable=True)
    content_type = Column(String, default="text")  # text|code|table|equation|definition|heading|list
    chunk_metadata = Column(JSON, default=lambda: {})

    session_id = Column(Integer, ForeignKey("study_sessions.id", ondelete="CASCADE"), nullable=False)
    session = relationship("StudySession", back_populates="chunks")

class QuizResult(Base):
    __tablename__ = "quiz_results"
    id = Column(Integer, primary_key=True, index=True)
    score = Column(Integer, nullable=False)
    total_questions = Column(Integer, nullable=False)
    percentage = Column(Integer, nullable=False)
    details = Column(JSON, default=lambda: [])
    date_taken = Column(DateTime, default=datetime.utcnow)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("study_sessions.id"), nullable=False)

    student = relationship("User", back_populates="quiz_results")
    session = relationship("StudySession", back_populates="quizzes")

class ChatConversation(Base):
    __tablename__ = "chat_conversations"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, default="New Chat")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("study_sessions.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    is_pinned = Column(Boolean, default=False)

    user = relationship("User", back_populates="conversations")
    project = relationship("Project", back_populates="conversations")
    messages = relationship("ChatMessage", back_populates="conversation", cascade="all, delete-orphan", order_by="ChatMessage.created_at")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    role = Column(String, nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    conversation_id = Column(Integer, ForeignKey("chat_conversations.id"), nullable=False)

    conversation = relationship("ChatConversation", back_populates="messages")

class Activity(Base):
    __tablename__ = "activities"
    id = Column(Integer, primary_key=True, index=True)
    action = Column(String, nullable=False)
    details = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="activities")

class Bookmark(Base):
    """User bookmarks for study sessions."""
    __tablename__ = "bookmarks"
    id = Column(Integer, primary_key=True, index=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("study_sessions.id"), nullable=False)

    user = relationship("User", back_populates="bookmarks")
    session = relationship("StudySession", back_populates="bookmarks")

class PasswordResetToken(Base):
    """Short-lived tokens for password reset flow."""
    __tablename__ = "password_reset_tokens"
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="password_reset_tokens")


class PaymentSubmission(Base):
    """Logs manual payment verification requests from users."""
    __tablename__ = "payment_submissions"
    id = Column(Integer, primary_key=True, index=True)
    plan = Column(String, nullable=False)  # 'pro' or 'premium'
    amount = Column(Integer, nullable=False)
    payment_method = Column(String, nullable=False)  # 'GPay' | 'PhonePe' | 'Paytm' | 'UPI'
    transaction_id = Column(String, unique=True, index=True, nullable=False)  # UTR/Ref ID
    status = Column(String, default="pending")  # 'pending' | 'approved' | 'rejected'
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User")

class FlashcardProgress(Base):
    """Tracks SM-2 spaced repetition state per flashcard per user."""
    __tablename__ = "flashcard_progress"
    id = Column(Integer, primary_key=True, index=True)
    card_index = Column(Integer, nullable=False)   # index within session's flashcards array
    ease_factor = Column(Integer, default=250)      # SM-2 EF * 100 (250 = 2.5)
    interval = Column(Integer, default=1)           # days until next review
    repetitions = Column(Integer, default=0)        # times reviewed
    next_review = Column(DateTime, default=datetime.utcnow)
    last_quality = Column(Integer, default=3)       # 0-5 quality rating
    updated_at = Column(DateTime, default=datetime.utcnow)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("study_sessions.id"), nullable=False)

    user = relationship("User", back_populates="flashcard_progress")
    session = relationship("StudySession", back_populates="flashcard_progress")


class Feedback(Base):
    """User feedback submissions (Bug Reports, Feature Requests, Billing, General)."""
    __tablename__ = "feedbacks"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_name = Column(String, nullable=False)
    user_email = Column(String, index=True, nullable=False)
    feedback_type = Column(String, nullable=False)  # 'Bug Report' | 'Feature Request' | 'Auth and Billing' | 'General Feedback'
    description = Column(Text, nullable=False)
    status = Column(String, default="new")          # 'new' | 'reviewed' | 'resolved'
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="feedbacks")

class Project(Base):
    """Claude/ChatGPT style workspace project/folder organization."""
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    color = Column(String, default="indigo")  # indigo | purple | emerald | amber | rose | blue | cyan
    icon = Column(String, default="Folder")
    is_pinned = Column(Boolean, default=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="projects")
    sessions = relationship("StudySession", back_populates="project")
    conversations = relationship("ChatConversation", back_populates="project", cascade="all, delete-orphan")


class LearnerTopicMastery(Base):
    """Tracks learner topic mastery score and history for adaptive study."""
    __tablename__ = "learner_topic_mastery"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("study_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    topic = Column(String, nullable=False, index=True)
    mastery_score = Column(Float, default=0.0)  # 0.0 to 1.0
    attempts = Column(Integer, default=0)
    correct = Column(Integer, default=0)
    weak_subtopics = Column(JSON, default=lambda: [])
    last_reviewed = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="topic_mastery")
    session = relationship("StudySession", back_populates="topic_mastery")

    __table_args__ = (
        UniqueConstraint("user_id", "session_id", "topic", name="uq_learner_mastery_user_session_topic"),
    )


class LearningEvent(Base):
    """Audit log of learner interactions (e.g. EXPLAIN, QUIZ_ATTEMPT, FLASHCARD_REVIEW)."""
    __tablename__ = "learning_events"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("study_sessions.id", ondelete="CASCADE"), nullable=True, index=True)
    event_type = Column(String, nullable=False)  # 'EXPLAIN' | 'QUIZ_ATTEMPT' | 'FLASHCARD_REVIEW' | 'CONCEPT_PRACTICE'
    payload = Column(JSON, default=lambda: {})
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="learning_events")
    session = relationship("StudySession", back_populates="learning_events")


# TABLE CREATION TOOL
def init_db():
    print("[INIT] Updating Database Tables...")
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        from sqlalchemy import text
        try:
            conn.execute(text("ALTER TABLE study_sessions ADD COLUMN project_id INTEGER REFERENCES projects(id)"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE chat_conversations ADD COLUMN project_id INTEGER REFERENCES projects(id)"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE chat_conversations ADD COLUMN is_pinned BOOLEAN DEFAULT 0"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE quiz_results ADD COLUMN details TEXT"))
            conn.commit()
        except Exception:
            pass
        # Phase 2: Academic RAG columns for study_sessions
        rag_session_cols = [
            ("processing_status", "VARCHAR DEFAULT 'READY'"),
            ("processing_error", "TEXT"),
            ("page_count", "INTEGER DEFAULT 1"),
            ("char_count", "INTEGER DEFAULT 0"),
            ("doc_metadata", "JSON DEFAULT '{}'"),
        ]
        for col_name, col_type in rag_session_cols:
            try:
                conn.execute(text(f"ALTER TABLE study_sessions ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception:
                pass
        # Phase 2: Academic RAG columns for document_chunks
        rag_chunk_cols = [
            ("page_number", "INTEGER DEFAULT 1"),
            ("section_heading", "VARCHAR"),
            ("content_type", "VARCHAR DEFAULT 'text'"),
            ("chunk_metadata", "JSON DEFAULT '{}'"),
        ]
        for col_name, col_type in rag_chunk_cols:
            try:
                conn.execute(text(f"ALTER TABLE document_chunks ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception:
                pass
        # Phase 3: Enforce uniqueness on (user_id, session_id, topic)
        try:
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_learner_mastery_user_session_topic ON learner_topic_mastery (user_id, session_id, topic)"))
            conn.commit()
        except Exception:
            pass
    print("[INIT] Success! All tables are ready.")

if __name__ == "__main__":
    init_db()