# pyrefly: ignore [missing-import]
from sqlalchemy import create_engine, Column, Integer, Float, String, Text, DateTime, ForeignKey, JSON, Boolean, Enum as SAEnum, UniqueConstraint
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.declarative import declarative_base
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import enum

import os
# 🔗 CONNECTION STRING
# Canonical path ensures database resolves correctly regardless of current working directory
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_DB_PATH = os.path.join(_BASE_DIR, "florix.db").replace("\\", "/")
_raw_db_url = os.getenv("DATABASE_URL")
if _raw_db_url and _raw_db_url.startswith("sqlite:///") and ("./florix.db" in _raw_db_url or _raw_db_url.endswith("/florix.db") or _raw_db_url == "sqlite:///florix.db"):
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{_DB_PATH}"
elif _raw_db_url:
    SQLALCHEMY_DATABASE_URL = _raw_db_url
else:
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{_DB_PATH}"

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
    visual_artifacts = relationship("VisualArtifact", back_populates="user", cascade="all, delete-orphan")
    reminders = relationship("Reminder", back_populates="user", cascade="all, delete-orphan")
    notification_preference = relationship("NotificationPreference", back_populates="user", uselist=False, cascade="all, delete-orphan")
    study_plans = relationship("StudyPlan", back_populates="user", cascade="all, delete-orphan")
    study_plan_tasks = relationship("StudyPlanTask", back_populates="user", cascade="all, delete-orphan")
    exams = relationship("Exam", back_populates="user", cascade="all, delete-orphan")
    exam_attempts = relationship("ExamAttempt", back_populates="user", cascade="all, delete-orphan")
    mistakes = relationship("MistakeRecord", back_populates="user", cascade="all, delete-orphan")
    viva_sessions = relationship("VivaSession", back_populates="user", cascade="all, delete-orphan")
    payment_submissions = relationship("PaymentSubmission", back_populates="user", cascade="all, delete-orphan")

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
    visual_artifacts = relationship("VisualArtifact", back_populates="session", cascade="all, delete-orphan")
    reminders = relationship("Reminder", back_populates="session", cascade="all, delete-orphan")
    study_plan_tasks = relationship("StudyPlanTask", back_populates="session")
    exams = relationship("Exam", back_populates="session")
    mistakes = relationship("MistakeRecord", back_populates="session")
    viva_sessions = relationship("VivaSession", back_populates="session")

class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    id = Column(Integer, primary_key=True, index=True)
    chunk_index = Column(Integer, nullable=False)
    text_content = Column(Text, nullable=False)
    embedding = Column(JSON, nullable=False)  # Stores the 3072-dimensional float list as JSON

    # Phase 2 — Academic RAG metadata
    page_number = Column(Integer, default=None, nullable=True)
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
    user = relationship("User", back_populates="payment_submissions")

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

    @property
    def event_data(self):
        return self.payload or {}


class VisualArtifact(Base):
    """Phase 5: Grounded visual learning artifacts (concept maps, flowcharts, timelines, mind maps, manual graphs)."""
    __tablename__ = "visual_artifacts"
    id = Column(String(60), primary_key=True, index=True)  # e.g. vis_1712345678901
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("study_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    visual_type = Column(String(50), default="concept_map")
    visual_data = Column(JSON, nullable=False, default=lambda: {})  # Validated nodes, edges, layout
    is_manual = Column(Boolean, default=False)
    is_modified = Column(Boolean, default=False)
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="visual_artifacts")
    session = relationship("StudySession", back_populates="visual_artifacts")


class Reminder(Base):
    """Revision Notification & Reminder Infrastructure.
    Supports both automatic SM-2 spaced revision reminders and user-created manual reminders.
    Tracks lifecycle: pending -> due -> notified -> opened -> completed | snoozed | dismissed.
    """
    __tablename__ = "reminders"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("study_sessions.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=True)
    reminder_type = Column(String(50), default="manual", index=True)  # 'manual' | 'sm2_revision'
    target_type = Column(String(50), default="session")   # 'session' | 'flashcard' | 'quiz' | 'visual' | 'topic'
    target_reference = Column(String(200), nullable=True) # e.g. card_index, topic name, visual_id
    scheduled_at = Column(DateTime, nullable=False, index=True)
    snoozed_until = Column(DateTime, nullable=True)
    status = Column(String(30), default="pending", index=True) # 'pending' | 'due' | 'notified' | 'opened' | 'completed' | 'snoozed' | 'dismissed'
    recurrence = Column(String(30), default="once") # 'once' | 'daily' | 'weekly'
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="reminders")
    session = relationship("StudySession", back_populates="reminders")


class NotificationPreference(Base):
    """User-level notification settings, quiet hours, and channel preferences."""
    __tablename__ = "notification_preferences"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    browser_notifications_enabled = Column(Boolean, default=True)
    sm2_auto_reminders = Column(Boolean, default=True)
    quiet_hours_enabled = Column(Boolean, default=False)
    quiet_hours_start = Column(String(10), default="22:00")  # HH:MM format
    quiet_hours_end = Column(String(10), default="08:00")    # HH:MM format
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="notification_preference")


class StudyPlan(Base):
    """Adaptive Study Planner: Orchestrates personalized study schedules.
    Orchestrates existing learner mastery, SM-2 flashcard reviews, quizzes, and visual artifacts.
    """
    __tablename__ = "study_plans"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    plan_mode = Column(String(30), default="daily", index=True)  # 'daily' | 'weekly' | 'exam' | 'goal'
    status = Column(String(30), default="active", index=True)    # 'active' | 'completed' | 'archived'
    target_date = Column(DateTime, nullable=True)               # e.g. exam date or goal deadline
    daily_available_minutes = Column(Integer, default=60)
    preferred_days = Column(JSON, default=lambda: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"])
    focus_session_ids = Column(JSON, default=lambda: [])        # [session_id, ...]
    focus_topics = Column(JSON, default=lambda: [])             # ["topic1", "topic2", ...]
    total_tasks = Column(Integer, default=0)
    completed_tasks = Column(Integer, default=0)
    metadata_json = Column(JSON, default=lambda: {})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="study_plans")
    tasks = relationship("StudyPlanTask", back_populates="plan", cascade="all, delete-orphan", order_by="StudyPlanTask.scheduled_date")


class StudyPlanTask(Base):
    """Actionable task generated or adapted within a StudyPlan.
    Links directly to existing learning activities (session, flashcard review, quiz, visual).
    """
    __tablename__ = "study_plan_tasks"
    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("study_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("study_sessions.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    task_type = Column(String(50), default="study_topic")  # 'study_topic' | 'review_flashcards' | 'take_quiz' | 'visual_review' | 'practice_weak_area'
    target_topic = Column(String(200), nullable=True)
    priority = Column(String(20), default="medium")        # 'critical' | 'high' | 'medium' | 'low'
    priority_score = Column(Float, default=50.0)           # 0.0 to 100.0 derived planning score
    estimated_minutes = Column(Integer, default=25)
    scheduled_date = Column(DateTime, nullable=False, index=True)
    status = Column(String(30), default="pending", index=True) # 'pending' | 'completed' | 'skipped' | 'rescheduled'
    is_user_created = Column(Boolean, default=False)
    recommendation_reason = Column(Text, nullable=True)    # Human-readable explanation
    reason_factors = Column(JSON, default=lambda: {})       # Structured breakdown
    completed_at = Column(DateTime, nullable=True)
    reminder_id = Column(Integer, ForeignKey("reminders.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    plan = relationship("StudyPlan", back_populates="tasks")
    user = relationship("User", back_populates="study_plan_tasks")
    session = relationship("StudySession", back_populates="study_plan_tasks")
    reminder = relationship("Reminder")


class Exam(Base):
    """Exam / Mock Exam Engine: Exam configuration and blueprint."""
    __tablename__ = "exams"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("study_sessions.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    exam_mode = Column(String(30), default="practice", index=True)  # 'practice' | 'mock' | 'topic' | 'full_syllabus'
    difficulty = Column(String(20), default="intermediate")        # 'beginner' | 'intermediate' | 'advanced'
    duration_minutes = Column(Integer, default=30)
    passing_percentage = Column(Integer, default=70)
    total_questions = Column(Integer, default=10)
    topics = Column(JSON, default=lambda: [])
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="exams")
    session = relationship("StudySession", back_populates="exams")
    questions = relationship("ExamQuestion", back_populates="exam", cascade="all, delete-orphan", order_by="ExamQuestion.question_order")
    attempts = relationship("ExamAttempt", back_populates="exam", cascade="all, delete-orphan", order_by="ExamAttempt.created_at.desc()")


class ExamQuestion(Base):
    """Authoritative question bank per exam blueprint."""
    __tablename__ = "exam_questions"
    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True)
    question_order = Column(Integer, nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(30), default="MCQ")  # 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER'
    options = Column(JSON, nullable=False, default=lambda: [])  # List of strings ["A", "B", "C", "D"]
    correct_answer = Column(Integer, nullable=False)           # 0-based index of correct option
    explanation = Column(Text, nullable=False)
    topic = Column(String(100), default="General")
    section_heading = Column(String(200), nullable=True)
    page_number = Column(Integer, nullable=True)
    source_chunk_id = Column(String(50), nullable=True)
    difficulty = Column(String(20), default="intermediate")

    exam = relationship("Exam", back_populates="questions")
    answers = relationship("ExamAnswer", back_populates="question", cascade="all, delete-orphan")


class ExamAttempt(Base):
    """Server-authoritative attempt session tracking and scoring."""
    __tablename__ = "exam_attempts"
    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(30), default="in_progress", index=True)  # 'in_progress' | 'submitted' | 'timed_out' | 'abandoned'
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True, index=True)
    completed_at = Column(DateTime, nullable=True)
    score = Column(Integer, default=0)
    total_questions = Column(Integer, nullable=False)
    percentage = Column(Integer, default=0)
    passed = Column(Boolean, default=False)
    time_taken_seconds = Column(Integer, default=0)
    topic_scores = Column(JSON, default=lambda: {})  # {"Topic": {"correct": 2, "total": 3, "percentage": 67}}
    created_at = Column(DateTime, default=datetime.utcnow)

    exam = relationship("Exam", back_populates="attempts")
    user = relationship("User", back_populates="exam_attempts")
    answers = relationship("ExamAnswer", back_populates="attempt", cascade="all, delete-orphan")


class ExamAnswer(Base):
    """Per-question response ledger per attempt."""
    __tablename__ = "exam_answers"
    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("exam_attempts.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("exam_questions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_answer = Column(Integer, nullable=True)  # Nullable 0-based option index
    is_marked_for_review = Column(Boolean, default=False)
    is_correct = Column(Boolean, default=False)
    time_spent_seconds = Column(Integer, default=0)
    answered_at = Column(DateTime, default=datetime.utcnow)

    attempt = relationship("ExamAttempt", back_populates="answers")
    question = relationship("ExamQuestion", back_populates="answers")

    __table_args__ = (
        UniqueConstraint("attempt_id", "question_id", name="uq_attempt_question"),
    )


class MistakeRecord(Base):
    """Mistake Intelligence / Metacognitive Debugger: Persistent record of analyzed learner errors."""
    __tablename__ = "mistake_records"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("study_sessions.id", ondelete="SET NULL"), nullable=True, index=True)
    source_type = Column(String(30), default="quiz", index=True)  # 'quiz' | 'exam' | 'manual'
    source_id = Column(Integer, nullable=True, index=True)        # quiz_result_id or exam_attempt_id
    question_text = Column(Text, nullable=False)
    user_answer = Column(Text, nullable=True)
    correct_answer = Column(Text, nullable=False)
    options = Column(JSON, default=lambda: [])
    topic = Column(String(100), default="General", index=True)
    subtopic = Column(String(200), nullable=True)
    difficulty = Column(String(30), default="intermediate")
    teaching_mode = Column(String(30), default="INTERMEDIATE")

    # Metacognitive Analysis
    error_category = Column(String(50), default="UNKNOWN", index=True)  # From controlled MistakeCategory taxonomy
    misconception = Column(Text, nullable=True)
    why_incorrect = Column(Text, nullable=False)
    correct_reasoning = Column(Text, nullable=False)
    prerequisite_concept = Column(Text, nullable=True)
    citations = Column(JSON, default=lambda: [])                         # Grounded source references

    # Longitudinal Pattern Tracking
    pattern_state = Column(String(30), default="ISOLATED", index=True)   # 'ISOLATED' | 'RECURRING' | 'PERSISTENT' | 'IMPROVING' | 'RESOLVED'
    is_resolved = Column(Boolean, default=False, index=True)
    resolved_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="mistakes")
    session = relationship("StudySession", back_populates="mistakes")


class VivaSession(Base):
    """Viva / Oral Examination Mode: Interactive academic viva & interview session."""
    __tablename__ = "viva_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("study_sessions.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    viva_mode = Column(String(50), default="TOPIC_VIVA", index=True)  # QUICK_VIVA | TOPIC_VIVA | DOCUMENT_VIVA | EXAM_PREPARATION_VIVA | WEAK_AREA_VIVA
    teaching_mode = Column(String(30), default="INTERMEDIATE")       # BEGINNER | INTERMEDIATE | ADVANCED | EXAM | INTERVIEW | REVISION
    topic = Column(String(100), default="General", index=True)
    difficulty = Column(String(30), default="intermediate")          # beginner | intermediate | advanced
    status = Column(String(30), default="CREATED", index=True)        # CREATED | IN_PROGRESS | PAUSED | COMPLETED | TIME_EXPIRED | CANCELLED
    total_questions = Column(Integer, default=5)
    current_question_index = Column(Integer, default=0)
    time_limit_minutes = Column(Integer, nullable=True)              # None for untimed
    started_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    overall_score = Column(Float, nullable=True)                     # 0.0 - 100.0
    overall_feedback = Column(Text, nullable=True)
    strong_areas = Column(JSON, default=lambda: [])
    weak_areas = Column(JSON, default=lambda: [])
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="viva_sessions")
    session = relationship("StudySession", back_populates="viva_sessions")
    questions = relationship("VivaQuestion", back_populates="viva_session", cascade="all, delete-orphan", order_by="VivaQuestion.question_order")
    turns = relationship("VivaTurn", back_populates="viva_session", cascade="all, delete-orphan", order_by="VivaTurn.id")


class VivaQuestion(Base):
    """Viva Question: Evidence-grounded primary or follow-up question in a viva session."""
    __tablename__ = "viva_questions"
    id = Column(Integer, primary_key=True, index=True)
    viva_session_id = Column(Integer, ForeignKey("viva_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    question_order = Column(Integer, nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(50), default="conceptual")         # conceptual | why_how | application | definition | comparison | scenario | follow_up
    expected_concepts = Column(JSON, default=lambda: [])             # Key concepts / keywords expected
    topic = Column(String(100), default="General")
    difficulty = Column(String(30), default="intermediate")
    source_chunk_id = Column(String(100), nullable=True)
    page_number = Column(Integer, nullable=True)
    citation_excerpt = Column(Text, nullable=True)
    is_follow_up = Column(Boolean, default=False)
    parent_question_id = Column(Integer, nullable=True)
    follow_up_count = Column(Integer, default=0)
    max_follow_ups = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    viva_session = relationship("VivaSession", back_populates="questions")
    turns = relationship("VivaTurn", back_populates="question", cascade="all, delete-orphan")


class VivaTurn(Base):
    """Viva Turn: A single learner oral/typed response and its grounded diagnostic evaluation."""
    __tablename__ = "viva_turns"
    id = Column(Integer, primary_key=True, index=True)
    viva_session_id = Column(Integer, ForeignKey("viva_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("viva_questions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_answer = Column(Text, nullable=False)
    input_mode = Column(String(20), default="typed")                 # typed | voice
    correctness_score = Column(Float, default=0.0)                   # 0.0 - 100.0
    completeness_score = Column(Float, default=0.0)                  # 0.0 - 100.0
    reasoning_score = Column(Float, default=0.0)                     # 0.0 - 100.0
    clarity_score = Column(Float, default=0.0)                       # 0.0 - 100.0
    overall_score = Column(Float, default=0.0)                       # 0.0 - 100.0
    is_grounded = Column(Boolean, default=True)
    evidence_found = Column(JSON, default=lambda: [])
    misconceptions = Column(JSON, default=lambda: [])
    missing_concepts = Column(JSON, default=lambda: [])
    strengths = Column(Text, nullable=True)
    improvement_feedback = Column(Text, nullable=True)
    follow_up_prompt = Column(Text, nullable=True)
    needs_follow_up = Column(Boolean, default=False)
    time_spent_seconds = Column(Integer, default=0)
    answered_at = Column(DateTime, default=datetime.utcnow)

    viva_session = relationship("VivaSession", back_populates="turns")
    question = relationship("VivaQuestion", back_populates="turns")


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
        # Phase 5: Index for visual_artifacts lookup
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_visual_artifacts_user_session ON visual_artifacts (user_id, session_id)"))
            conn.commit()
        except Exception:
            pass
        # Revision Notification & Reminder Infrastructure indexes
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_reminders_user_scheduled ON reminders (user_id, scheduled_at)"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_reminders_user_status ON reminders (user_id, status)"))
            conn.commit()
        except Exception:
            pass
        # Adaptive Study Planner indexes
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_study_plans_user_status ON study_plans (user_id, status)"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_study_plan_tasks_user_date ON study_plan_tasks (user_id, scheduled_date)"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_study_plan_tasks_plan_status ON study_plan_tasks (plan_id, status)"))
            conn.commit()
        except Exception:
            pass
        # Exam / Mock Exam Engine indexes
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_exams_user_mode ON exams (user_id, exam_mode)"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_exam_attempts_user_status ON exam_attempts (user_id, status)"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_exam_answers_attempt_q ON exam_answers (attempt_id, question_id)"))
            conn.commit()
        except Exception:
            pass
        # Mistake Intelligence / Metacognitive Debugger indexes
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_mistake_records_user_topic ON mistake_records (user_id, topic)"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_mistake_records_user_category ON mistake_records (user_id, error_category)"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_mistake_records_user_pattern ON mistake_records (user_id, pattern_state)"))
            conn.commit()
        except Exception:
            pass
        # Viva / Oral Examination Mode indexes
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_viva_sessions_user_status ON viva_sessions (user_id, status)"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_viva_questions_session_order ON viva_questions (viva_session_id, question_order)"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_viva_turns_session_q ON viva_turns (viva_session_id, question_id)"))
            conn.commit()
        except Exception:
            pass
    print("[INIT] Success! All tables are ready.")

if __name__ == "__main__":
    init_db()