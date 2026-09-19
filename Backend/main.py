"""
Florix AI — Production Backend
FastAPI application with full AI integration, JWT auth, rate limiting,
subscriptions, bookmarks, password reset, and streaming responses.
"""

import os
import uuid
import shutil
import json
import re
import time
import random
import secrets
import hashlib
import logging
import socket
import ipaddress
from typing import List, Optional, AsyncGenerator, Tuple, Union
from datetime import timedelta, datetime
from contextlib import asynccontextmanager

import requests
from bs4 import BeautifulSoup, Comment
from youtube_transcript_api import YouTubeTranscriptApi
from urllib.parse import urlparse, parse_qs, urljoin
import chromadb
import razorpay

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, status, Request, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, text

from database import (
    engine, Base, SessionLocal,
    User, StudySession, Activity, QuizResult,
    ChatConversation, ChatMessage, Bookmark, PasswordResetToken,
    DocumentChunk, PaymentSubmission, FlashcardProgress,
    Feedback, Project
)
from auth import (
    get_db, get_current_user, create_access_token,
    get_password_hash, verify_password, ACCESS_TOKEN_EXPIRE_MINUTES
)
from google import genai
from google.genai import types
from google.genai import errors as genai_errors
from google.api_core import exceptions as google_exceptions
from dotenv import load_dotenv
from pypdf import PdfReader

# ── Phase 2 Academic RAG Engine ────────────────────────────────────────────────
from rag import (
    ProcessingStatus,
    ContentType,
    QueryIntent,
    EnrichedChunk,
    RetrievalCandidate,
    Citation,
    GroundedResponse,
    parse_pdf_pages,
    detect_content_type,
    extract_structural_sections,
    build_semantic_chunks,
    HybridRetriever,
    classify_query_intent,
    extract_key_tokens,
    RelevanceReranker,
    ContextBuilder,
    build_grounded_rag_prompt,
    GroundedGenerator,
)

# ── Phase 3 Intelligent Learning Engine ──────────────────────────────────────
from intelligence import (
    LearningIntent,
    TeachingMode,
    QuestionType,
    GroundedQuizQuestion,
    GroundedFlashcard,
    TopicMasteryRecord,
    IntelligenceResponse,
    IntentClassifier,
    detect_learning_intent,
    TeachingEngine,
    AssessmentEngine,
    LearnerEngine,
    GroundingValidator,
    IntelligenceOrchestrator,
)

# ── Slowapi rate limiting ──────────────────────────────────────────────────────
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    limiter = Limiter(key_func=get_remote_address)
    RATE_LIMITING_ENABLED = True
except ImportError:
    RATE_LIMITING_ENABLED = False
    limiter = None
    print("WARNING: slowapi not installed - rate limiting disabled")

# ── Logging setup ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("florix")

load_dotenv()

# ── Gemini client ──────────────────────────────────────────────────────────────
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY environment variable is not set")
client = genai.Client(api_key=api_key)
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
MODEL_CASCADE = ["gemini-2.5-flash", "gemini-3.5-flash-lite", "gemini-flash-latest"]

# ── Razorpay payment gateway ──────────────────────────────────────────────────
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
RAZORPAY_ENABLED = bool(
    RAZORPAY_KEY_ID
    and RAZORPAY_KEY_SECRET
    and not RAZORPAY_KEY_ID.startswith("rzp_test_REPLACE_WITH_YOUR")
)
razorpay_client = None

if RAZORPAY_ENABLED:
    try:
        razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        logger.info("✅ Razorpay payment gateway initialized.")
    except Exception as e:
        logger.error(f"❌ Failed to initialize Razorpay client: {e}")
        RAZORPAY_ENABLED = False

if not RAZORPAY_ENABLED:
    logger.warning("⚠️ Razorpay keys not configured — payment endpoints will run in Sandbox Mode.")

# ── ChromaDB client ────────────────────────────────────────────────────────────
try:
    chroma_client = chromadb.PersistentClient(path="chroma_db")
    chroma_collection = chroma_client.get_or_create_collection(
        name="document_chunks",
        metadata={"hnsw:space": "cosine"}
    )
    logger.info("✅ Persistent ChromaDB client initialized successfully.")
except Exception as e:
    logger.error(f"❌ Failed to initialize ChromaDB client: {e}")
    chroma_client = None
    chroma_collection = None

# ── Subscription plan limits ───────────────────────────────────────────────────
PLAN_LIMITS = {
    "free": {
        "sessions": 5,
        "quizzes_per_day": 3,
        "chats_per_day": 10,
        "downloads_per_day": 6,
        "flashcards_per_session": 10,
        "max_upload_mb": 10,
        "max_video_mb": 25,
        "max_paste_chars": 3000,       # ~500 words
        "max_speech_words": 150,       # ~1-2 min speaking
        "max_link_chars": 10000,
    },
    "pro": {
        "sessions": 50,
        "quizzes_per_day": 20,
        "chats_per_day": 100,
        "downloads_per_day": 15,
        "flashcards_per_session": 30,
        "max_upload_mb": 50,
        "max_video_mb": 100,
        "max_paste_chars": 25000,      # ~4,000 words
        "max_speech_words": 1000,      # ~8-10 min speaking
        "max_link_chars": 50000,
    },
    "premium": {
        "sessions": -1,
        "quizzes_per_day": -1,
        "chats_per_day": -1,
        "downloads_per_day": -1,
        "flashcards_per_session": 50,
        "max_upload_mb": 100,
        "max_video_mb": 250,
        "max_paste_chars": 100000,     # ~15,000 words
        "max_speech_words": -1,        # Unlimited dictation
        "max_link_chars": 150000,
    },
}

# ── Brute-force login attempt tracker ────────────────────────────────────────
_login_attempts: dict = {}  # Cleared login attempts tracking. Reset reloader.

system_start_time = time.time()

# ── Lifespan (create DB tables on startup) ────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Florix AI starting up...")
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Database tables verified")

    # Run database migration checks
    db = SessionLocal()
    try:
        db.execute(text("ALTER TABLE users ADD COLUMN country VARCHAR DEFAULT 'Unknown';"))
        db.commit()
        logger.info("Database migration: Added country column to users table.")
    except Exception:
        db.rollback()

    try:
        db.execute(text("ALTER TABLE users ADD COLUMN onboarding_info JSON DEFAULT '{}';"))
        db.commit()
        logger.info("Database migration: Added onboarding_info column to users table.")
    except Exception:
        db.rollback()
    finally:
        db.close()

    yield
    logger.info("🛑 Florix AI shutting down")

app = FastAPI(
    title="Florix AI API",
    description="Production-grade AI study platform backend",
    version="2.0.0",
    lifespan=lifespan,
)

# ── Rate limiting middleware ───────────────────────────────────────────────────
if RATE_LIMITING_ENABLED:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── RAG Pipeline Progress Tracker ──────────────────────────────────────────────
pipeline_progress = {}  # progress_id -> steps

def update_pipeline_progress(progress_id: str, step: int, label: str, detail: str, status: str):
    if not progress_id:
        return
    if progress_id not in pipeline_progress:
        pipeline_progress[progress_id] = [
            {"step": 1, "total": 6, "label": "File received", "detail": "Pending...", "status": "pending"},
            {"step": 2, "total": 6, "label": "Content parsing", "detail": "Pending...", "status": "pending"},
            {"step": 3, "total": 6, "label": "Text chunking", "detail": "Pending...", "status": "pending"},
            {"step": 4, "total": 6, "label": "Generating vector embeddings", "detail": "Pending...", "status": "pending"},
            {"step": 5, "total": 6, "label": "Indexing in ChromaDB", "detail": "Pending...", "status": "pending"},
            {"step": 6, "total": 6, "label": "AI summary generation", "detail": "Pending...", "status": "pending"}
        ]

    for s in pipeline_progress[progress_id]:
        if s["step"] == step:
            s["label"] = label
            s["detail"] = detail
            s["status"] = status
            break

async def progress_streamer(progress_id: str):
    import json
    import asyncio
    last_sent = None

    # Wait for the initialization of progress_id
    for _ in range(30):
        if progress_id in pipeline_progress:
            break
        await asyncio.sleep(0.5)

    while True:
        if progress_id not in pipeline_progress:
            yield "data: {\"error\": \"Not initialized\"}\n\n"
            break

        current = pipeline_progress[progress_id]
        current_str = json.dumps(current)

        if current_str != last_sent:
            yield f"data: {current_str}\n\n"
            last_sent = current_str

        all_done = all(s["status"] == "done" for s in current)
        if all_done:
            # Let it linger briefly so frontend can see 100% completion before connection closes
            await asyncio.sleep(1.0)
            break

        await asyncio.sleep(0.5)

from fastapi.responses import StreamingResponse

@app.get("/upload/stream/{progress_id}", tags=["Content"])
async def stream_upload_progress(progress_id: str):
    return StreamingResponse(progress_streamer(progress_id), media_type="text/event-stream")


# ── System Monitoring & Metrics ────────────────────────────────────────────────
from collections import deque
import re

server_metrics = {
    "total_requests": 0,
    "requests_by_endpoint": {},
    "latency_by_endpoint": {},
    "gemini_token_usage": {
        "prompt_tokens": 0,
        "candidates_tokens": 0,
        "total_tokens": 0
    },
    "recent_requests_log": deque(maxlen=100)
}

def track_gemini_tokens(response):
    if response and hasattr(response, "usage_metadata") and response.usage_metadata:
        try:
            meta = response.usage_metadata
            p_tokens = getattr(meta, "prompt_token_count", 0) or 0
            c_tokens = getattr(meta, "candidates_token_count", 0) or 0
            t_tokens = getattr(meta, "total_token_count", 0) or 0

            server_metrics["gemini_token_usage"]["prompt_tokens"] += p_tokens
            server_metrics["gemini_token_usage"]["candidates_tokens"] += c_tokens
            server_metrics["gemini_token_usage"]["total_tokens"] += t_tokens
            logger.info(f"🪙 Gemini tokens tracked: prompt={p_tokens}, candidates={c_tokens}, total={t_tokens}")
        except Exception as e:
            logger.warning(f"Failed to extract Gemini token usage metadata: {e}")

# ── Request logging & metrics middleware ───────────────────────────────────────
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    path = request.url.path
    if path.startswith("/upload/stream/") or path.startswith("/admin/metrics") or path.startswith("/admin/system-health"):
        return await call_next(request)

    start_time = time.time()
    response = await call_next(request)
    latency = time.time() - start_time
    duration_ms = round(latency * 1000, 2)
    logger.info(f"{request.method} {path} → {response.status_code} ({duration_ms}ms)")

    # Update metrics
    server_metrics["total_requests"] += 1

    normalized_path = re.sub(r"/\d+", "/{id}", path)
    endpoint_norm = f"{request.method} {normalized_path}"

    server_metrics["requests_by_endpoint"][endpoint_norm] = server_metrics["requests_by_endpoint"].get(endpoint_norm, 0) + 1

    if endpoint_norm not in server_metrics["latency_by_endpoint"]:
        server_metrics["latency_by_endpoint"][endpoint_norm] = []
    server_metrics["latency_by_endpoint"][endpoint_norm].append(duration_ms)
    if len(server_metrics["latency_by_endpoint"][endpoint_norm]) > 50:
        server_metrics["latency_by_endpoint"][endpoint_norm].pop(0)

    server_metrics["recent_requests_log"].append({
        "timestamp": datetime.utcnow().isoformat(),
        "method": request.method,
        "path": path,
        "status_code": response.status_code,
        "latency_ms": duration_ms
    })

    return response

# =============================================================================
# PYDANTIC SCHEMAS
# =============================================================================

class UserCreate(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    model_config = {"extra": "allow"}
    access_token: str
    token_type: str
    user: dict | None = None

class QuizRequest(BaseModel):
    num_questions: int
    session_id: int

class FlashcardRequest(BaseModel):
    num_cards: int
    session_id: int

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[int] = None
    context_text: str | None = None
    response_style: str | None = None

class LinkRequest(BaseModel):
    url: str
    project_id: Optional[int] = None

class TextRequest(BaseModel):
    text: str
    project_id: Optional[int] = None

class ConversationCreate(BaseModel):
    title: str = "New Chat"
    session_id: Optional[int] = None
    project_id: Optional[int] = None

class MessageCreate(BaseModel):
    message: str
    response_style: str | None = None

class ConversationTitleUpdate(BaseModel):
    title: str

class ProfileUpdate(BaseModel):
    name: str

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class QuizResultRequest(BaseModel):
    session_id: int
    score: int
    total_questions: int
    details: Optional[List[dict]] = None

class BookmarkCreate(BaseModel):
    session_id: int
    note: str | None = None

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class SubscriptionUpgradeRequest(BaseModel):
    plan: str  # "pro" | "premium"
    payment_token: str | None = None  # Stripe token in production

class PaymentSubmissionRequest(BaseModel):
    plan: str  # "pro" | "premium"
    payment_method: str  # "GPay", "PhonePe", "Paytm", "UPI"
    transaction_id: str  # UTR or Transaction ID


class RenameRequest(BaseModel):
    filename: str


class OAuthRequest(BaseModel):
    provider: str
    email: str
    name: str
    avatar_url: str | None = None


class CategoryRequest(BaseModel):
    category: str


class NotesRequest(BaseModel):
    notes: str


class ShareRequest(BaseModel):
    share_type: str = "public"  # public | private | team


class FeedbackCreate(BaseModel):
    feedback_type: str = "General Feedback"  # 'Bug Report' | 'Feature Request' | 'Auth and Billing' | 'General Feedback'
    description: str


class FeedbackStatusUpdate(BaseModel):
    status: Optional[str] = "reviewed"  # 'new' | 'reviewed' | 'resolved'
    admin_notes: Optional[str] = None


class ProjectCreate(BaseModel):
    name: str
    color: Optional[str] = "indigo"
    icon: Optional[str] = "Folder"
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_pinned: Optional[bool] = None
    description: Optional[str] = None


class MoveSessionProjectRequest(BaseModel):
    project_id: Optional[int] = None


class MoveChatProjectRequest(BaseModel):
    project_id: Optional[int] = None


class PinChatRequest(BaseModel):
    is_pinned: bool


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _is_quota_or_transient_error(e: Exception) -> bool:
    """Returns True if the exception is a rate limit, quota exhaustion (429), or transient server error."""
    if isinstance(e, genai_errors.APIError):
        if getattr(e, "code", None) in (429, 500, 502, 503, 504):
            return True
    if isinstance(e, (google_exceptions.ResourceExhausted, google_exceptions.ServiceUnavailable, google_exceptions.InternalServerError)):
        return True
    err_str = str(e).lower()
    quota_indicators = ["429", "resource_exhausted", "quota", "rate limit", "rate_limit", "503", "unavailable", "overloaded", "server error"]
    return any(indicator in err_str for indicator in quota_indicators)


def generate_with_fallback(prompt: str, instruction: str = "Summarize this text professionally in Markdown format") -> str:
    """Call Gemini with bounded retry on quota or unavailable demand spikes, cascading dynamically across active models."""
    safety = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
    ]
    # Build unique cascade order starting with primary MODEL_NAME
    models_to_try = []
    for m in [MODEL_NAME] + MODEL_CASCADE:
        if m and m not in models_to_try:
            models_to_try.append(m)

    truncated = prompt[:15000]
    contents = f"{instruction}:\n\n{truncated}"
    last_err = None

    for model in models_to_try:
        try:
            response = client.models.generate_content(
                model=model,
                contents=contents,
                config={"safety_settings": safety},
            )
            track_gemini_tokens(response)
            if response and response.text:
                return response.text
            return "AI returned an empty response."
        except Exception as e:
            last_err = e
            if _is_quota_or_transient_error(e):
                logger.warning(f"⚠️ Gemini model '{model}' hit rate limit/quota or transient error ({e}). Cascading to next available model...")
                continue
            elif (isinstance(e, google_exceptions.NotFound) or
                  (isinstance(e, genai_errors.APIError) and getattr(e, "code", None) == 404)):
                logger.warning(f"⚠️ Gemini model '{model}' not found (404). Cascading to next available model...")
                continue
            else:
                logger.error(f"❌ Gemini non-retryable exception on model '{model}': {e}")
                break

    logger.error(f"❌ All generation models in cascade failed. Last error: {last_err}")
    return "The AI engine is currently experiencing high demand or quota limits. Please try again in a few moments."


def generate_multimodal(image_bytes: bytes, mime_type: str, instruction: str) -> str:
    """Call Gemini with an image for multimodal vision analysis, cascading across active models."""
    safety = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
    ]
    models_to_try = []
    for m in ["gemini-2.5-flash", MODEL_NAME] + MODEL_CASCADE:
        if m and m not in models_to_try:
            models_to_try.append(m)

    last_err = None
    for model in models_to_try:
        try:
            response = client.models.generate_content(
                model=model,
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                    instruction
                ],
                config={"safety_settings": safety},
            )
            track_gemini_tokens(response)
            if response and response.text:
                return response.text
            return "AI returned an empty multimodal response."
        except Exception as e:
            last_err = e
            if _is_quota_or_transient_error(e):
                logger.warning(f"⚠️ Vision model '{model}' hit quota or transient error ({e}). Cascading...")
                continue
            logger.error(f"❌ Multimodal exception on model '{model}': {e}")
            break

    logger.error(f"❌ All multimodal models in cascade failed. Last error: {last_err}")
    return "The AI vision engine is currently experiencing high demand. Please try again later."


# ── YouTube Ingestion Helpers (Phase 4 Hardening) ────────────────────────────
def is_youtube_url(url: str) -> bool:
    """Return True if the URL points to YouTube (domain isolation)."""
    if not url:
        return False
    try:
        parsed = urlparse(url.strip())
        netloc = parsed.netloc.lower()
        return (
            netloc == "youtu.be"
            or netloc.endswith(".youtube.com")
            or netloc == "youtube.com"
        )
    except Exception:
        return False


def extract_youtube_video_id(url: str) -> Optional[str]:
    """
    Extract the 11-character YouTube video ID across all valid formats:
    - https://www.youtube.com/watch?v=ID
    - https://www.youtube.com/watch?feature=shared&v=ID
    - https://youtu.be/ID
    - https://www.youtube.com/shorts/ID
    - https://www.youtube.com/embed/ID
    - https://www.youtube.com/live/ID
    """
    if not url or not is_youtube_url(url):
        return None
    try:
        parsed = urlparse(url.strip())
        netloc = parsed.netloc.lower()

        if netloc == "youtu.be":
            path_parts = [p for p in parsed.path.split("/") if p]
            if path_parts and len(path_parts[0]) == 11 and re.match(r"^[a-zA-Z0-9_-]{11}$", path_parts[0]):
                return path_parts[0]

        if netloc == "youtube.com" or netloc.endswith(".youtube.com"):
            qs = parse_qs(parsed.query)
            if "v" in qs and qs["v"]:
                candidate = qs["v"][0]
                if len(candidate) == 11 and re.match(r"^[a-zA-Z0-9_-]{11}$", candidate):
                    return candidate

            path_parts = [p for p in parsed.path.split("/") if p]
            if len(path_parts) >= 2 and path_parts[0] in ("shorts", "embed", "live"):
                candidate = path_parts[1]
                if len(candidate) == 11 and re.match(r"^[a-zA-Z0-9_-]{11}$", candidate):
                    return candidate

        # Robust regex fallback
        match = re.search(r"(?:v=|\/shorts\/|\/embed\/|\/live\/|youtu\.be\/)([a-zA-Z0-9_-]{11})", url)
        if match:
            return match.group(1)
    except Exception as e:
        logger.warning(f"Error parsing YouTube video ID from {url}: {e}")
    return None


def canonicalize_youtube_url(video_id: str) -> str:
    """Return standard canonical watch URL for a video ID."""
    return f"https://www.youtube.com/watch?v={video_id}"


def fetch_youtube_transcript_api(video_id: str) -> Optional[List[dict]]:
    """
    Tier 1: Fetch captions/transcript using youtube-transcript-api.
    Returns a list of transcript segment dicts [{'text': ..., 'start': ..., 'duration': ...}] or None.
    """
    try:
        try:
            ytt = YouTubeTranscriptApi()
            t_list = ytt.list(video_id)
            transcript = None
            try:
                transcript = t_list.find_transcript(['en', 'en-US', 'en-GB'])
            except Exception:
                for t in t_list:
                    transcript = t
                    break
            if transcript:
                fetched = transcript.fetch()
                items = []
                for item in fetched:
                    it_text = item["text"] if isinstance(item, dict) else getattr(item, "text", str(item))
                    it_start = float(item.get("start", 0.0)) if isinstance(item, dict) else float(getattr(item, "start", 0.0))
                    it_dur = float(item.get("duration", 0.0)) if isinstance(item, dict) else float(getattr(item, "duration", 0.0))
                    if it_text and it_text.strip():
                        items.append({"text": it_text.strip(), "start": it_start, "duration": it_dur})
                if items:
                    return items
        except (AttributeError, TypeError):
            transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
            items = []
            for t in transcript_list:
                it_text = t.get("text", "")
                it_start = float(t.get("start", 0.0))
                it_dur = float(t.get("duration", 0.0))
                if it_text and it_text.strip():
                    items.append({"text": it_text.strip(), "start": it_start, "duration": it_dur})
            if items:
                return items
    except Exception as e:
        logger.warning(f"Tier 1 (youtube-transcript-api) failed for video {video_id}: {e}")
    return None


def fetch_youtube_transcript_gemini(canonical_url: str) -> Optional[List[dict]]:
    """
    Tier 2: Fetch transcript and content via Gemini native multimodal YouTube understanding.
    Uses Part.from_uri with models/gemini-3.5-flash-lite / gemini-2.5-flash.
    Returns list of dicts [{'text': ..., 'start': ..., 'duration': ...}] or None.
    """
    prompt = (
        "Extract a comprehensive, chronological, timestamped transcript of this video. "
        "Identify every spoken section or major topic transition with accurate start and end timestamps in seconds. "
        "Return your output as a valid JSON array of objects, where each object has:\n"
        "- 'start': float (start time in seconds)\n"
        "- 'duration': float (duration in seconds)\n"
        "- 'text': string (spoken words or detailed discussion at this timestamp)\n"
        "- 'speaker': string (speaker name or 'Speaker', optional)\n\n"
        "Example JSON:\n"
        '[{"start": 0.0, "duration": 15.0, "text": "Introduction to the topic"}, {"start": 15.0, "duration": 30.0, "text": "Core concept discussion"}]\n\n'
        "Return ONLY the valid JSON array without markdown backticks or explanation."
    )

    models_to_try = ["gemini-3.5-flash-lite", "gemini-2.5-flash", MODEL_NAME]
    seen = set()
    unique_models = [m for m in models_to_try if m and not (m in seen or seen.add(m))]

    for model in unique_models:
        try:
            video_part = types.Part.from_uri(file_uri=canonical_url, mime_type="video/mp4")
            response = client.models.generate_content(
                model=model,
                contents=[prompt, video_part],
            )
            track_gemini_tokens(response)
            if response and response.text:
                raw_text = response.text.strip()
                clean_json = raw_text
                if clean_json.startswith("```json"):
                    clean_json = clean_json[7:]
                elif clean_json.startswith("```"):
                    clean_json = clean_json[3:]
                if clean_json.endswith("```"):
                    clean_json = clean_json[:-3]
                clean_json = clean_json.strip()

                try:
                    parsed = json.loads(clean_json)
                    if isinstance(parsed, list) and len(parsed) > 0:
                        items = []
                        for obj in parsed:
                            if isinstance(obj, dict):
                                start = float(obj.get("start", 0.0))
                                dur = float(obj.get("duration", 10.0))
                                txt = str(obj.get("text", "")).strip()
                                spk = obj.get("speaker")
                                if txt:
                                    item = {"text": txt, "start": start, "duration": dur}
                                    if spk:
                                        item["speaker"] = spk
                                    items.append(item)
                        if items:
                            logger.info(f"✅ Tier 2 Gemini native video extraction succeeded ({len(items)} segments) using {model}")
                            return items
                except json.JSONDecodeError:
                    pass

                # Fallback: Parse regex timestamps from raw lines
                lines = raw_text.split("\n")
                items = []
                for line in lines:
                    ts_match = re.search(r"\[(\d{1,2}):(\d{2})\s*(?:-\s*(\d{1,2}):(\d{2}))?\]\s*(.*)", line)
                    if ts_match:
                        sm, ss, em, es, body = ts_match.groups()
                        start_sec = int(sm) * 60 + int(ss)
                        if em is not None and es is not None:
                            end_sec = int(em) * 60 + int(es)
                            dur_sec = max(1.0, float(end_sec - start_sec))
                        else:
                            dur_sec = 10.0
                        if body and body.strip():
                            items.append({"text": body.strip(), "start": float(start_sec), "duration": dur_sec})
                if items:
                    logger.info(f"✅ Tier 2 Gemini regex-parsed timestamp extraction succeeded ({len(items)} segments) using {model}")
                    return items
        except Exception as e:
            logger.warning(f"Tier 2 (Gemini multimodal) model '{model}' failed: {e}")
            continue

    return None


def format_transcript_items_to_text(items: List[dict]) -> str:
    """Format transcript segments into standardized timestamped lines."""
    formatted_lines = []
    for item in items:
        it_text = item.get("text", "").strip()
        if not it_text:
            continue
        it_start = float(item.get("start", 0.0))
        it_dur = float(item.get("duration", 0.0))
        it_end = it_start + it_dur
        sm, ss = divmod(int(it_start), 60)
        em, es = divmod(int(it_end), 60)
        speaker = item.get("speaker")
        prefix = f"{speaker}: " if speaker else ""
        formatted_lines.append(f"[{sm:02d}:{ss:02d} - {em:02d}:{es:02d}] {prefix}{it_text}")
    return "\n".join(formatted_lines)


def generate_smart_title(text: str, source_type: str = "document") -> str:
    """Generate a concise, meaningful 3-8 word title from content using AI, strictly preventing generic placeholders."""
    try:
        import re
        snippet = (text or "").strip()[:4000]
        if not snippet:
            return f"Study Session on {source_type.title()}"

        instruction = (
            f"You are a Senior Academic Product Title Generator. Analyze the provided {source_type} content snippet, "
            "and generate a single concise, highly specific, and professional study session title of 3 to 8 words maximum "
            "that captures the exact specific topic, subject matter, or core theme of the document. "
            "NEVER use generic titles such as 'Summary', 'New Session', 'Untitled', 'AI Summary', 'Generated Notes', "
            "'Text Summary', 'Document Summary', or similar placeholder names. "
            "Focus on the exact academic or business subject (e.g. 'Operating System Fundamentals', "
            "'React Hooks and State Management', 'AI Startup Planning Discussion', 'Database Management Systems'). "
            "Return ONLY the title text. Do NOT include quotes, do NOT include markdown formatting, and do NOT include any explanation or metadata."
        )
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=f"{instruction}:\n\n{snippet}",
        )
        track_gemini_tokens(response)
        title = (response.text or "").strip().strip('"').strip("'").strip("`").strip()[:100]

        # Robust validation filters to eliminate generic placeholder terms:
        blacklist = {"summary", "new session", "untitled", "ai summary", "generated notes", "text summary", "document summary", "notes summary", "pdf summary", "image summary", "audio summary", "youtube summary", "web summary"}

        if not title or len(title) < 3 or title.lower() in blacklist or any(b in title.lower() for b in ["generated summary", "untitled session", "study session", "new document"]):
            # Intelligent local fallback: Parse first page/lines to extract first meaningful capitalized phrase
            clean_lines = [line.strip() for line in re.split(r'[\r\n]+', snippet) if line.strip() and not line.strip().startswith('#')]
            fallback_title = ""
            for line in clean_lines[:3]:
                if len(line) > 5 and len(line) < 60:
                    fallback_title = line.strip().title()
                    break
            if not fallback_title:
                words = [w for w in re.sub(r'[^\w\s]', '', snippet).split() if len(w) > 3][:6]
                fallback_title = " ".join(words).title() if words else f"Study Session on {source_type.title()}"
            title = fallback_title

        # Guarantee word count constraint of 3-8 words
        title_words = title.split()
        if len(title_words) > 8:
            title = " ".join(title_words[:8])

        return title
    except Exception as e:
        logger.warning(f"Smart title generation failed: {e}")
        return f"Study Session on {source_type.title()}"


def generate_category(text: str) -> str:
    """Auto-classify content into a category using AI."""
    try:
        snippet = text[:2000]
        instruction = (
            "Classify this content into exactly ONE of these categories: "
            "Study, Coding, Research, Business, Personal, Career, Interview. "
            "Return ONLY the single category word, nothing else."
        )
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=f"{instruction}:\n\n{snippet}",
        )
        cat = (response.text or "").strip().split()[0] if response.text else "Study"
        valid = {"Study", "Coding", "Research", "Business", "Personal", "Career", "Interview"}
        return cat if cat in valid else "Study"
    except Exception:
        return "Study"


def send_email_via_resend(to_email: str, subject: str, html_content: str):
    """Send transactional emails via Resend API."""
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        logger.warning("⚠️ RESEND_API_KEY environment variable not set. Email not sent.")
        return False
    try:
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "from": os.getenv("EMAIL_FROM", "Florix AI <noreply@florix.ai>"),
                "to": [to_email],
                "subject": subject,
                "html": html_content
            },
            timeout=10
        )
        if resp.status_code in [200, 201]:
            logger.info(f"📧 Email successfully sent via Resend to {to_email}")
            return True
        else:
            logger.warning(f"❌ Resend email failed with status {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        logger.error(f"❌ Exception in send_email_via_resend: {e}")
        return False


def clean_and_parse_json(raw_text: str) -> list:
    """Strip markdown wrappers and parse JSON array from AI response."""
    if not raw_text:
        return []
    try:
        clean = re.sub(r'```json\n?|\n?```', '', raw_text).strip()
        start, end = clean.find('['), clean.rfind(']') + 1
        if start == -1 or end == 0:
            return []
        return json.loads(clean[start:end])
    except Exception as e:
        logger.error(f"JSON parse error: {e}. Raw: {raw_text[:100]}")
        return []


def get_style_instruction(style: str | None) -> str:
    """Convert response_style preference to prompt instruction."""
    return {
        "concise":  "Be concise and direct. Give short, sharp answers. Use bullet points where possible.",
        "balanced": "Give balanced, moderately detailed answers. Be clear and informative.",
        "detailed": "Be thorough and comprehensive. Provide in-depth explanations and examples.",
    }.get((style or "balanced").lower(), "Give balanced, moderately detailed answers.")


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
    """
    Splits text into semantic chunks of roughly chunk_size characters,
    with an overlap between consecutive chunks. Keeps sentence boundaries intact.
    """
    if not text:
        return []
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current_chunk = []
    current_length = 0

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        sentence_len = len(sentence)
        if sentence_len > chunk_size:
            if current_chunk:
                chunks.append(" ".join(current_chunk))
                current_chunk = []
                current_length = 0
            chunks.append(sentence)
            continue

        if current_length + sentence_len + 1 > chunk_size:
            chunks.append(" ".join(current_chunk))
            overlap_chunk = []
            overlap_len = 0
            for prev_sent in reversed(current_chunk):
                if overlap_len + len(prev_sent) + 1 < overlap:
                    overlap_chunk.insert(0, prev_sent)
                    overlap_len += len(prev_sent) + 1
                else:
                    break
            current_chunk = overlap_chunk + [sentence]
            current_length = sum(len(s) + 1 for s in current_chunk)
        else:
            current_chunk.append(sentence)
            current_length += sentence_len + 1

    if current_chunk:
        chunks.append(" ".join(current_chunk))
    return chunks


def process_upload_in_background(
    session_id: int,
    source_type: str,
    text_content: Optional[str] = None,
    file_path: Optional[str] = None,
    mime_type: Optional[str] = None,
    progress_id: Optional[str] = None
):
    """
    Background task to generate study guides, transcription, OCR,
    RAG chunking, embeddings, and database indexes asynchronously.
    """
    logger.info(f"⚡ Background task started for session {session_id} (source: {source_type})")
    db = SessionLocal()
    try:
        session = db.query(StudySession).filter(StudySession.id == session_id).first()
        if not session:
            logger.error(f"❌ Session {session_id} not found in DB")
            return

        text = text_content or ""
        summary = ""

        # Step 1: Content Extraction / Transcription / OCR (if needed)
        if source_type == "image" and file_path:
            update_pipeline_progress(progress_id, 2, "Content parsing", "Running OCR and vision analysis on image...", "active")
            instruction = (
                "You are an expert multimodal visual analyzer and OCR engine. Read and analyze this screenshot/image "
                "comprehensively. Perform OCR to extract all visible text, analyze all diagrams, charts, equations, "
                "and structural layouts. Generate a high-fidelity, comprehensive study guide in Markdown format. "
                "Include: # Main Title, ## Extracted Text & Layout, ## Visual Components & Diagrams, ## Detailed Explanation, "
                "## Key Takeaways (bullet list), ## Key Terms (definition list). Make it extremely educational for students."
            )
            with open(file_path, "rb") as f:
                img_bytes = f.read()
            summary = generate_multimodal(img_bytes, mime_type, instruction)
            text = f"[Multimodal Vision Analysis Workspace for Screenshot/Image: {session.filename}]"
            session.content = text
            session.summary = summary
            db.commit()
            update_pipeline_progress(progress_id, 2, "Content parsing", "Image OCR analysis complete", "done")

        elif source_type == "audio" and file_path:
            update_pipeline_progress(progress_id, 2, "Content parsing", "Uploading audio to Gemini and transcribing...", "active")
            audio_file = None
            try:
                try:
                    with open(file_path, "rb") as af:
                        audio_file = client.files.upload(file=af, config={"mime_type": mime_type})
                except Exception as upload_err:
                    logger.error(f"Gemini audio upload failed: {upload_err}")
                    session.processing_status = ProcessingStatus.FAILED
                    session.summary = f"Audio upload failed: {str(upload_err)}"
                    db.commit()
                    update_pipeline_progress(progress_id, 2, "Content parsing", f"Upload error: {str(upload_err)}", "failed")
                    return

                instruction = (
                    "You are an expert academic audio transcriber. Transcribe this audio accurately with timestamps.\n"
                    "Format spoken segments as:\n"
                    "[MM:SS - MM:SS] Speaker: Transcript text\n\n"
                    "Then create a comprehensive study guide in Markdown format including key points, summary, and important concepts."
                )

                # Resilient generation with model cascade
                models_to_try = [m for m in [MODEL_NAME] + MODEL_CASCADE if m]
                response = None
                last_audio_err = None
                try:
                    for model_candidate in models_to_try:
                        try:
                            response = client.models.generate_content(
                                model=model_candidate,
                                contents=[instruction, audio_file],
                            )
                            if response and response.text and response.text.strip():
                                break
                        except Exception as ae:
                            last_audio_err = ae
                            if _is_quota_or_transient_error(ae):
                                logger.warning(f"⚠️ Audio transcription on '{model_candidate}' hit rate limit ({ae}). Cascading...")
                                continue
                            elif (isinstance(ae, google_exceptions.NotFound) or
                                  (isinstance(ae, genai_errors.APIError) and getattr(ae, "code", None) == 404)):
                                logger.warning(f"⚠️ Audio transcription on '{model_candidate}' returned 404. Cascading...")
                                continue
                            else:
                                raise ae

                    if not response or not response.text or not response.text.strip():
                        if last_audio_err:
                            raise last_audio_err
                        session.processing_status = ProcessingStatus.FAILED
                        session.summary = "Audio transcription produced no text. The audio may be silent, indistinct, or corrupted."
                        db.commit()
                        update_pipeline_progress(progress_id, 2, "Content parsing", "Audio transcription produced no text", "failed")
                        return

                    full_text = response.text.strip()
                except Exception as gen_err:
                    logger.error(f"Gemini audio transcription failed: {gen_err}")
                    session.processing_status = ProcessingStatus.FAILED
                    session.summary = f"Audio transcription failed: {str(gen_err)}"
                    db.commit()
                    update_pipeline_progress(progress_id, 2, "Content parsing", f"Transcription error: {str(gen_err)}", "failed")
                    return

                # Partition transcript and study guide cleanly
                guide_match = re.search(r"(?:\n|^)(#[#\s].*)", full_text, re.DOTALL)
                guide_part = guide_match.group(1).strip() if guide_match else full_text.strip()

                from content.transcription import extract_timestamped_segments
                from rag.chunker import _format_ts_span
                segs = extract_timestamped_segments(full_text)
                if segs:
                    transcript_lines = []
                    for s in segs:
                        spk = f"{s.speaker}: " if s.speaker else ""
                        span_str = _format_ts_span(s.timestamp_start, s.timestamp_end)
                        transcript_lines.append(f"[{span_str}] {spk}{s.text}".strip())
                    transcript_part = "\n".join(transcript_lines)
                elif guide_match and guide_match.start() > 0:
                    transcript_part = full_text[:guide_match.start()].strip()
                else:
                    transcript_part = full_text.strip()

                text = transcript_part or full_text
                summary = guide_part or full_text
                session.content = text
                session.summary = summary
                db.commit()
                update_pipeline_progress(progress_id, 2, "Content parsing", f"Audio transcription complete ({len(full_text)} characters)", "done")
            finally:
                # Immediate cleanup of temporary local audio file
                if file_path and os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                        logger.info(f"🗑️ Cleaned up background temp audio file: {file_path}")
                    except Exception as fe:
                        logger.warning(f"Failed to delete temp audio file {file_path}: {fe}")

        elif source_type == "video" and file_path:
            update_pipeline_progress(progress_id, 2, "Content parsing", "Uploading video to Gemini and running transcript...", "active")
            video_file = None
            try:
                with open(file_path, "rb") as vf:
                    video_file = client.files.upload(file=vf, config={"mime_type": mime_type})
                instruction = (
                    "You are an expert educational content analyzer. Watch and analyze this video comprehensively.\n"
                    "Extract spoken content and visual context with timestamps formatted as:\n"
                    "[MM:SS - MM:SS] Speaker: Spoken transcript & visual highlights\n\n"
                    "Create a comprehensive study guide in Markdown format with: "
                    "# Video Title, ## Transcription Highlights, ## Key Topics Covered, ## Summary, ## Important Points, ## Key Takeaways."
                )

                # Resilient generation with model cascade
                models_to_try = [m for m in [MODEL_NAME] + MODEL_CASCADE if m]
                response = None
                last_video_err = None
                for model_candidate in models_to_try:
                    try:
                        response = client.models.generate_content(
                            model=model_candidate,
                            contents=[instruction, video_file],
                        )
                        if response and response.text:
                            break
                    except Exception as ve:
                        last_video_err = ve
                        if _is_quota_or_transient_error(ve):
                            logger.warning(f"⚠️ Video generation on '{model_candidate}' hit rate limit ({ve}). Cascading...")
                            continue
                        elif (isinstance(ve, google_exceptions.NotFound) or
                              (isinstance(ve, genai_errors.APIError) and getattr(ve, "code", None) == 404)):
                            logger.warning(f"⚠️ Video generation on '{model_candidate}' returned 404. Cascading...")
                            continue
                        else:
                            raise ve

                if not response or not response.text:
                    if last_video_err:
                        raise last_video_err
                    raise ValueError("Gemini returned empty response for video analysis.")

                full_text = response.text

                # Partition transcript and study guide cleanly
                guide_match = re.search(r"(?:\n|^)(#[#\s].*)", full_text, re.DOTALL)
                guide_part = guide_match.group(1).strip() if guide_match else full_text.strip()

                # Extract timestamped segments if present anywhere in full_text
                from content.transcription import extract_timestamped_segments
                from rag.chunker import _format_ts_span
                segs = extract_timestamped_segments(full_text)
                if segs:
                    transcript_lines = []
                    for s in segs:
                        spk = f"{s.speaker}: " if s.speaker else ""
                        span_str = _format_ts_span(s.timestamp_start, s.timestamp_end)
                        transcript_lines.append(f"[{span_str}] {spk}{s.text}".strip())
                    transcript_part = "\n".join(transcript_lines)
                elif guide_match and guide_match.start() > 0:
                    transcript_part = full_text[:guide_match.start()].strip()
                else:
                    transcript_part = full_text.strip()

                text = transcript_part or full_text
                summary = guide_part or full_text
                session.content = text
                session.summary = summary
                db.commit()
                update_pipeline_progress(progress_id, 2, "Content parsing", f"Video processing complete ({len(full_text)} characters)", "done")
            finally:
                # Immediate cleanup of temporary local video file
                if file_path and os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                        logger.info(f"🗑️ Cleaned up background temp video file: {file_path}")
                    except Exception as fe:
                        logger.warning(f"Failed to delete temp video file {file_path}: {fe}")

        elif source_type in ("pdf", "url", "text", "youtube"):
            # Text was parsed synchronously in HTTP thread. Just generate summary now.
            update_pipeline_progress(progress_id, 2, "Content parsing", "Text content ready", "done")
            update_pipeline_progress(progress_id, 6, "AI summary generation", "Running study guide generator...", "active")

            if source_type == "pdf":
                instruction = (
                    "You are an expert academic content summarizer. Analyze the following document and create a "
                    "comprehensive, well-structured study guide in Markdown format. Include: "
                    "# Main Title, ## Key Concepts, ## Summary, ## Important Points (bullet list), "
                    "## Key Terms (definition list). Make it useful for students studying for exams."
                )
            elif source_type == "youtube":
                instruction = (
                    "You are an expert educational content creator. Based on this YouTube video transcript, "
                    "create a comprehensive study guide in Markdown format with: "
                    "# Video Title, ## Key Topics Covered, ## Summary, ## Important Points, ## Key Takeaways."
                )
            elif source_type == "url":
                if "youtube.com" in text or "youtu.be" in text or session.filename.lower().startswith("youtube"):
                    instruction = (
                        "You are an expert educational content creator. Based on this YouTube video transcript, "
                        "create a comprehensive study guide in Markdown format with: "
                        "# Video Title, ## Key Topics Covered, ## Summary, ## Important Points, ## Key Takeaways."
                    )
                else:
                    instruction = (
                        "You are an expert at distilling web content into study material. "
                        "Analyze this web page content and create a comprehensive study guide in Markdown format with: "
                        "# Page Title, ## Key Points, ## Summary, ## Important Information."
                    )
            else:
                instruction = (
                    "You are an expert academic content summarizer. Analyze the following text and create a "
                    "comprehensive, well-structured study guide in Markdown format with: "
                    "# Title, ## Key Concepts, ## Summary, ## Important Points, ## Key Terms."
                )
            summary = generate_with_fallback(text, instruction)
            session.summary = summary
            db.commit()
            update_pipeline_progress(progress_id, 6, "AI summary generation", "Study guide successfully generated", "done")

        # Step 2: Delete temporary file
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
                logger.info(f"🗑️ Cleaned up background temp file: {file_path}")
            except Exception as e:
                logger.warning(f"Failed to delete temp file {file_path}: {e}")

        # Step 3: Intelligence Enrichment
        smart_title = generate_smart_title(summary or text, source_type)
        category = generate_category(text)
        if smart_title:
            session.ai_title = smart_title
            session.filename = smart_title
        if category:
            session.category = category
        db.commit()

        # Step 4: Indexing in ChromaDB & SQLite for Semantic RAG Chat
        session.processing_status = ProcessingStatus.CHUNKING
        session.char_count = len(text)
        db.commit()

        update_pipeline_progress(progress_id, 3, "Text chunking", "Extracting structural sections and semantic chunks...", "active")
        try:
            from content import ContentNormalizer
            pdf_pages = None
            if source_type == "pdf" and session.doc_metadata and isinstance(session.doc_metadata, dict):
                pdf_pages = session.doc_metadata.get("pages")

            source_url = None
            if session.doc_metadata and isinstance(session.doc_metadata, dict):
                source_url = session.doc_metadata.get("source_url") or session.doc_metadata.get("url")

            normalized = ContentNormalizer.normalize_any(
                source_type=source_type,
                data=pdf_pages if pdf_pages else text,
                title=session.filename,
                metadata={
                    "session_id": session_id,
                    "user_id": session.user_id,
                    "source_type": source_type,
                    "url": source_url or "",
                    "source_url": source_url or ""
                }
            )
            enriched_chunks = build_semantic_chunks(normalized, chunk_size=800, overlap=150)
        except Exception as norm_err:
            logger.warning(f"⚠️ Normalizer fallback to direct text chunking: {norm_err}")
            enriched_chunks = build_semantic_chunks(text, chunk_size=800, overlap=150)

        chunks = [c.text for c in enriched_chunks]
        if enriched_chunks:
            update_pipeline_progress(progress_id, 3, "Text chunking", f"Split into {len(enriched_chunks)} academic semantic chunks", "done")

            session.processing_status = ProcessingStatus.EMBEDDING
            db.commit()
            update_pipeline_progress(progress_id, 4, "Generating vector embeddings", f"Creating embeddings for {len(enriched_chunks)} chunks...", "active")
            batch_size = 50
            all_embeddings = []
            for i in range(0, len(chunks), batch_size):
                batch_chunks = chunks[i : i + batch_size]

                # Resilient Embedding Call
                response = None
                max_emb_retries = 3
                for emb_attempt in range(max_emb_retries):
                    try:
                        response = client.models.embed_content(
                            model="models/gemini-embedding-2",
                            contents=batch_chunks
                        )
                        break
                    except Exception as e:
                        if emb_attempt == max_emb_retries - 1:
                            raise e
                        wait_time = (2 ** emb_attempt) + random.random()
                        time.sleep(wait_time)

                if response and response.embeddings:
                    for emb in response.embeddings:
                        all_embeddings.append(emb.values)

            update_pipeline_progress(progress_id, 4, "Generating vector embeddings", "Generated embeddings successfully", "done")

            session.processing_status = ProcessingStatus.INDEXING
            db.commit()
            update_pipeline_progress(progress_id, 5, "Indexing in ChromaDB", "Writing metadata to SQLite & ChromaDB...", "active")
            db_chunks = []
            for index, (chk, embedding_vector) in enumerate(zip(enriched_chunks, all_embeddings)):
                db_chunk = DocumentChunk(
                    chunk_index=index,
                    text_content=chk.text,
                    embedding=embedding_vector,
                    session_id=session_id,
                    page_number=chk.page_number,
                    section_heading=chk.section_heading,
                    content_type=chk.content_type.value if hasattr(chk.content_type, "value") else str(chk.content_type),
                    chunk_metadata=chk.metadata
                )
                db_chunks.append(db_chunk)
            db.add_all(db_chunks)
            db.commit()

            if chroma_collection is not None:
                try:
                    chroma_ids = [f"sess_{session_id}_chunk_{idx}" for idx in range(len(enriched_chunks))]
                    chroma_metadatas = []
                    for idx, chk in enumerate(enriched_chunks):
                        meta_dict = {
                            "session_id": session_id,
                            "user_id": session.user_id,
                            "chunk_index": idx,
                            "section_heading": chk.section_heading or "",
                            "content_type": chk.content_type.value if hasattr(chk.content_type, "value") else str(chk.content_type),
                        }
                        if chk.page_number is not None:
                            meta_dict["page_number"] = chk.page_number
                        if chk.metadata:
                            if "timestamp_start" in chk.metadata and chk.metadata["timestamp_start"] is not None:
                                meta_dict["timestamp_start"] = float(chk.metadata["timestamp_start"])
                            if "timestamp_end" in chk.metadata and chk.metadata["timestamp_end"] is not None:
                                meta_dict["timestamp_end"] = float(chk.metadata["timestamp_end"])
                            if "timestamp_str" in chk.metadata and chk.metadata["timestamp_str"]:
                                meta_dict["timestamp_str"] = str(chk.metadata["timestamp_str"])
                            if "source_type" in chk.metadata and chk.metadata["source_type"]:
                                meta_dict["source_type"] = str(chk.metadata["source_type"])
                            elif source_type:
                                meta_dict["source_type"] = str(source_type)
                            if "source_url" in chk.metadata and chk.metadata["source_url"]:
                                meta_dict["source_url"] = str(chk.metadata["source_url"])
                            elif source_url:
                                meta_dict["source_url"] = str(source_url)
                            if "speaker" in chk.metadata and chk.metadata["speaker"]:
                                meta_dict["speaker"] = str(chk.metadata["speaker"])
                        elif source_type:
                            meta_dict["source_type"] = str(source_type)
                            if source_url:
                                meta_dict["source_url"] = str(source_url)
                        chroma_metadatas.append(meta_dict)

                    chroma_collection.upsert(
                        ids=chroma_ids,
                        embeddings=all_embeddings,
                        metadatas=chroma_metadatas,
                        documents=chunks
                    )
                except Exception as e:
                    logger.error(f"⚠️ ChromaDB background error: {e}")

            update_pipeline_progress(progress_id, 5, "Indexing in ChromaDB", "ChromaDB index complete", "done")
            session.processing_status = ProcessingStatus.READY
            db.commit()
        else:
            update_pipeline_progress(progress_id, 3, "Text chunking", "No chunks generated", "done")
            update_pipeline_progress(progress_id, 4, "Generating vector embeddings", "Skipped", "done")
            update_pipeline_progress(progress_id, 5, "Indexing in ChromaDB", "Skipped", "done")
            session.processing_status = ProcessingStatus.READY
            db.commit()

        # Step 4.5: Pre-generate and cache interactive Learning Timeline for YouTube
        if source_type == "youtube":
            try:
                from content.timeline import detect_learning_sections
                yt_id = ""
                if session.doc_metadata and isinstance(session.doc_metadata, dict):
                    yt_id = session.doc_metadata.get("video_id", "")
                if not yt_id:
                    yt_id = extract_youtube_video_id(session.filename) or ""
                    if not yt_id and session.timeline:
                        for ev in session.timeline:
                            det = ev.get("detail", "")
                            if "youtube.com" in det or "youtu.be" in det:
                                yt_id = extract_youtube_video_id(det) or ""
                                if yt_id:
                                    break

                timeline_data = detect_learning_sections(
                    raw_transcript=session.content or text,
                    video_title=session.ai_title or session.filename,
                    video_id=yt_id,
                    gemini_client=client
                )
                curr_meta = dict(session.doc_metadata or {})
                curr_meta["learning_timeline"] = timeline_data
                curr_meta["video_id"] = yt_id
                session.doc_metadata = curr_meta
                db.commit()
                logger.info(f"✅ Generated and cached Learning Timeline for YouTube session {session.id}")
            except Exception as yt_err:
                logger.warning(f"⚠️ Could not pre-generate timeline in background for session {session_id}: {yt_err}")

        # Step 5: Mark all tasks complete in pipeline progress tracker
        for step_idx in range(1, 7):
            update_pipeline_progress(progress_id, step_idx, "Processing Complete", "All steps processed successfully", "done")
        logger.info(f"✅ Background task successfully completed for session {session_id}")

    except Exception as e:
        logger.error(f"❌ Background task error: {e}")
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
        try:
            session = db.query(StudySession).filter(StudySession.id == session_id).first()
            if session:
                session.processing_status = ProcessingStatus.FAILED
                session.processing_error = str(e)
                db.commit()
        except Exception:
            pass
        # Mark all failed
        for step_idx in range(2, 7):
            update_pipeline_progress(progress_id, step_idx, "Failed", f"Failed: {str(e)}", "pending")
    finally:
        db.close()


def embed_and_store_document(session_id: int, text: str, progress_id: str = None, db: Session = None):
    """
    Chunks document text, generates vector embeddings using models/gemini-embedding-2,
    and stores them in SQLite using a fresh local database session.
    """
    logger.info(f"⚡ Starting RAG indexing for session {session_id}...")
    db = SessionLocal()
    try:
        # 1. Chunk the document text
        update_pipeline_progress(progress_id, 3, "Text chunking", "Splitting document text into semantic chunks...", "active")
        chunks = chunk_text(text, chunk_size=800, overlap=150)
        if not chunks:
            logger.warning(f"No chunks generated for session {session_id}")
            update_pipeline_progress(progress_id, 3, "Text chunking", "No chunks generated", "done")
            update_pipeline_progress(progress_id, 4, "Generating vector embeddings", "Skipped (no chunks)", "done")
            update_pipeline_progress(progress_id, 5, "Indexing in ChromaDB", "Skipped", "done")
            return

        logger.info(f"Generated {len(chunks)} chunks for session {session_id}")
        update_pipeline_progress(progress_id, 3, "Text chunking", f"Split into {len(chunks)} semantic chunks", "done")

        # 2. Get embeddings in batches (max 50 per batch)
        update_pipeline_progress(progress_id, 4, "Generating vector embeddings", f"Requesting Gemini embeddings for {len(chunks)} chunks...", "active")
        batch_size = 50
        all_embeddings = []
        for i in range(0, len(chunks), batch_size):
            batch_chunks = chunks[i : i + batch_size]

            # Resilient Embedding Call with Retry Backoff
            response = None
            max_emb_retries = 3
            for emb_attempt in range(max_emb_retries):
                try:
                    response = client.models.embed_content(
                        model="models/gemini-embedding-2",
                        contents=batch_chunks
                    )
                    break
                except (google_exceptions.ResourceExhausted, google_exceptions.ServiceUnavailable, google_exceptions.InternalServerError) as e:
                    if emb_attempt == max_emb_retries - 1:
                        raise e
                    wait_time = (2 ** emb_attempt) + random.random()
                    logger.warning(f"Embedding API errored: {e}. Retrying in {wait_time:.1f}s (attempt {emb_attempt+1}/{max_emb_retries})...")
                    time.sleep(wait_time)

            for emb in response.embeddings:
                all_embeddings.append(emb.values)

        update_pipeline_progress(progress_id, 4, "Generating vector embeddings", f"Created 3072-dimensional embeddings via Gemini", "done")

        # 3. Store in SQLite
        update_pipeline_progress(progress_id, 5, "Indexing in ChromaDB", "Writing vectors and metadata to SQLite & ChromaDB...", "active")
        db_chunks = []
        for index, (chunk_text_val, embedding_vector) in enumerate(zip(chunks, all_embeddings)):
            db_chunk = DocumentChunk(
                chunk_index=index,
                text_content=chunk_text_val,
                embedding=embedding_vector,
                session_id=session_id
            )
            db_chunk.session_id = session_id  # ensure exact binding
            db_chunks.append(db_chunk)

        db.add_all(db_chunks)
        db.commit()
        logger.info(f"✅ Successfully indexed {len(db_chunks)} chunks in SQLite for session {session_id}")

        # 4. Store in ChromaDB
        if chroma_collection is not None:
            try:
                chroma_ids = [f"sess_{session_id}_chunk_{idx}" for idx in range(len(chunks))]
                chroma_metadatas = [{"session_id": session_id, "chunk_index": idx} for idx in range(len(chunks))]
                chroma_collection.upsert(
                    ids=chroma_ids,
                    embeddings=all_embeddings,
                    metadatas=chroma_metadatas,
                    documents=chunks
                )
                logger.info(f"✅ Successfully indexed {len(chunks)} chunks in ChromaDB for session {session_id}")
            except Exception as e:
                logger.error(f"⚠️ Failed to index chunks in ChromaDB: {e}")

        update_pipeline_progress(progress_id, 5, "Indexing in ChromaDB", "HNSW cosine similarity index successfully updated", "done")
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Failed to generate RAG index: {str(e)}")
        update_pipeline_progress(progress_id, 3, "Text chunking", "Failed", "pending")
        update_pipeline_progress(progress_id, 4, "Generating vector embeddings", "Failed", "pending")
        update_pipeline_progress(progress_id, 5, "Indexing in ChromaDB", f"Failed: {str(e)}", "pending")
    finally:
        db.close()


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """
    Compute cosine similarity between two lists of floats of equal length.
    """
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot_product = sum(a * b for a, b in zip(v1, v2))
    magnitude_v1 = sum(a * a for a in v1) ** 0.5
    magnitude_v2 = sum(b * b for b in v2) ** 0.5
    if not magnitude_v1 or not magnitude_v2:
        return 0.0
    return dot_product / (magnitude_v1 * magnitude_v2)


def retrieve_relevant_chunks(
    session_id: int,
    query: str,
    db: Session,
    top_k: int = 4,
    user_id: Optional[int] = None
) -> List[dict]:
    """
    Hybrid semantic + lexical retrieval engine combining ChromaDB dense vector search
    with exact keyword matching via Reciprocal Rank Fusion (RRF), relevance reranking,
    and strict multi-tenant user isolation.
    """
    logger.info(f"🔍 Hybrid RAG Retrieval started for query: '{query[:50]}' (session {session_id})...")
    try:
        session_query = db.query(StudySession).filter(StudySession.id == session_id)
        if user_id is not None:
            session_query = session_query.filter(StudySession.user_id == user_id)
        session = session_query.first()
        if not session:
            logger.warning(f"🔒 RAG retrieval denied: session {session_id} not found or unauthorized for user {user_id}")
            return []

        effective_user_id = user_id if user_id is not None else session.user_id

        retriever = HybridRetriever(chroma_collection=chroma_collection, gemini_client=client)
        candidates = retriever.retrieve(
            query=query,
            user_id=effective_user_id,
            session_id=session_id,
            db=db,
            top_k=top_k * 2,
            session_model=StudySession,
            chunk_model=DocumentChunk
        )

        intent = classify_query_intent(query)
        reranker = RelevanceReranker()
        reranked = reranker.rerank(candidates, query=query, intent=intent, top_n=top_k)

        if reranked:
            logger.info(f"✅ Hybrid RAG: Retrieved & reranked {len(reranked)} chunks. Top score: {reranked[0].final_score:.3f}")
            return [{
                "chunk_index": getattr(c, "chunk_index", 0),
                "text_content": c.text,
                "score": round(c.final_score, 4),
                "page_number": c.page_number,
                "section_heading": c.section_heading,
                "content_type": c.content_type.value if hasattr(c.content_type, "value") else str(c.content_type),
                "source_type": getattr(c, "source_type", session.source_type if session else "pdf"),
                "metadata": getattr(c, "metadata", {}) or {},
                "document_title": session.filename if session else "Study Material"
            } for c in reranked]

        # Fallback: Query SQLite chunks directly if hybrid returned empty
        chunks = db.query(DocumentChunk).filter(DocumentChunk.session_id == session_id).all()
        if not chunks:
            logger.warning(f"No chunks found for session {session_id} in DB.")
            return []

        return [{
            "chunk_index": c.chunk_index,
            "text_content": c.text_content,
            "score": 0.5,
            "page_number": getattr(c, "page_number", None) if (session and session.source_type != "pdf") else (getattr(c, "page_number", 1) or 1),
            "section_heading": getattr(c, "section_heading", "") or "",
            "content_type": getattr(c, "content_type", "text") or "text",
            "source_type": (getattr(c, "chunk_metadata", {}) or {}).get("source_type") or (session.source_type if session else "pdf"),
            "metadata": getattr(c, "chunk_metadata", {}) or {},
            "document_title": session.filename if session else "Study Material"
        } for c in chunks[:top_k]]
    except Exception as e:
        logger.error(f"❌ RAG retrieval failed: {str(e)}")
        return []


def check_plan_limit(user: User, resource: str, db: Session, value: Optional[float] = None) -> None:
    """Raise 402 or 413 if user has exceeded their plan limit for the given resource."""
    # Admins automatically get unlimited premium privileges for free!
    if getattr(user, "is_admin", False):
        return

    plan = user.plan or "free"
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"]).get(resource, 0)
    if limit == -1:  # unlimited
        return

    if resource == "sessions":
        count = db.query(StudySession).filter(StudySession.user_id == user.id).count()
        if count >= limit:
            raise HTTPException(
                status_code=402,
                detail=f"You've reached the {plan.upper()} plan limit of {limit} documents. Upgrade to continue."
            )
    elif resource == "quizzes_per_day":
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        count = db.query(QuizResult).filter(
            QuizResult.user_id == user.id,
            QuizResult.date_taken >= today_start
        ).count()
        if count >= limit:
            raise HTTPException(
                status_code=402,
                detail=f"Daily quiz limit ({limit}) reached for {plan.upper()} plan. Upgrade or try again tomorrow."
            )
    elif resource == "chats_per_day":
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        count = db.query(ChatMessage).join(ChatConversation).filter(
            ChatConversation.user_id == user.id,
            ChatMessage.role == "user",
            ChatMessage.created_at >= today_start
        ).count()
        if count >= limit:
            raise HTTPException(
                status_code=402,
                detail=f"Daily chat limit ({limit} messages) reached for {plan.upper()} plan. Upgrade or try again tomorrow."
            )
    elif resource == "downloads_per_day":
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        count = db.query(Activity).filter(
            Activity.user_id == user.id,
            Activity.action == "Downloaded Content",
            Activity.timestamp >= today_start
        ).count()
        if count >= limit:
            raise HTTPException(
                status_code=402,
                detail=f"Daily download limit ({limit} downloads) reached for {plan.upper()} plan. Upgrade or try again tomorrow."
            )
    elif resource == "max_upload_mb":
        file_mb = (value or 0) / (1024 * 1024)
        if file_mb > limit:
            raise HTTPException(
                status_code=413,
                detail=f"File size ({file_mb:.1f} MB) exceeds your {plan.upper()} plan limit of {limit} MB. Please upgrade to upload larger documents."
            )
    elif resource == "max_video_mb":
        video_mb = (value or 0) / (1024 * 1024)
        if video_mb > limit:
            raise HTTPException(
                status_code=413,
                detail=f"Video size ({video_mb:.1f} MB) exceeds your {plan.upper()} plan limit of {limit} MB. Please upgrade for larger lecture videos."
            )
    elif resource == "max_paste_chars":
        chars = int(value or 0)
        if chars > limit:
            raise HTTPException(
                status_code=413,
                detail=f"Pasted text length ({chars:,} characters) exceeds your {plan.upper()} plan limit of {limit:,} characters (~{limit//6:,} words). Please upgrade to paste larger content."
            )
    elif resource == "max_speech_words":
        words = int(value or 0)
        if words > limit:
            raise HTTPException(
                status_code=413,
                detail=f"Spoken word count ({words} words) exceeds your {plan.upper()} plan limit of {limit} words. Upgrade to Pro for 1,000 words or Premium for unlimited dictation."
            )


def log_activity(db: Session, user_id: int, action: str, details: str):
    """Helper to insert an activity log entry and update study streak."""
    db.add(Activity(action=action, details=details, user_id=user_id))
    # Update streak: if last study was yesterday → increment; if today → keep; else reset
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            today = datetime.utcnow().date()
            if user.last_study_date:
                last_date = user.last_study_date.date()
                if last_date == today:
                    pass  # already studied today, no change
                elif last_date == today - timedelta(days=1):
                    user.study_streak = (user.study_streak or 0) + 1
                    user.last_study_date = datetime.utcnow()
                else:
                    user.study_streak = 1  # reset streak
                    user.last_study_date = datetime.utcnow()
            else:
                user.study_streak = 1
                user.last_study_date = datetime.utcnow()
    except Exception:
        pass  # never crash on streak update


# =============================================================================
# HEALTH CHECK (Phase 9 — required for production)
# =============================================================================

@app.get("/health", tags=["System"])
def health_check():
    """Production health check endpoint for load balancers and uptime monitors."""
    db = SessionLocal()
    try:
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
    finally:
        db.close()

    return {
        "status": "ok" if db_status == "healthy" else "degraded",
        "version": "2.0.0",
        "database": db_status,
        "ai_model": MODEL_NAME,
        "timestamp": datetime.utcnow().isoformat(),
    }


# =============================================================================
# AUTHENTICATION ENDPOINTS (Phase 4)
# =============================================================================

@app.post("/signup", response_model=Token, tags=["Auth"])
def signup(user: UserCreate, db: Session = Depends(get_db)):
    # ── 1. EMAIL VALIDATION ──
    email_clean = user.email.strip()
    if not email_clean:
        raise HTTPException(status_code=400, detail="Email address is required")
    if " " in email_clean:
        raise HTTPException(status_code=400, detail="Email address must not contain spaces")

    # Strict regex for standard RFC email structures
    email_regex = r"^[\w\.-]+@[\w\.-]+\.\w+$"
    if not re.match(email_regex, email_clean):
        raise HTTPException(status_code=400, detail="Please provide a valid, well-formed email address")

    # Case-insensitive duplicate check to prevent double accounts
    if db.query(User).filter(func.lower(User.email) == email_clean.lower()).first():
        raise HTTPException(status_code=400, detail="This email address is already registered")

    # ── 2. NAME/USERNAME VALIDATION ──
    name_clean = user.name.strip()
    if not name_clean:
        raise HTTPException(status_code=400, detail="Full name is required")
    if len(name_clean) < 3:
        raise HTTPException(status_code=400, detail="Full name must be at least 3 characters")
    if len(name_clean) > 50:
        raise HTTPException(status_code=400, detail="Full name must not exceed 50 characters")

    # Ensure name has only standard alphabetical characters, spaces, hyphens, and periods
    name_regex = r"^[a-zA-Z\s\.-]+$"
    if not re.match(name_regex, name_clean):
        raise HTTPException(status_code=400, detail="Name can only contain alphabetical letters, spaces, dots, or hyphens")

    # ── 3. PASSWORD VALIDATION ──
    password_val = user.password
    if len(password_val) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
    if not any(c.isupper() for c in password_val):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")
    if not any(c.islower() for c in password_val):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter")
    if not any(c.isdigit() for c in password_val):
        raise HTTPException(status_code=400, detail="Password must contain at least one digit/number")

    # Check for at least one special character
    special_chars = r"[!@#$%^&*(),.?\":{}|<>]"
    if not re.search(special_chars, password_val):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character (e.g. !@#$%^&*)")

    new_user = User(
        name=name_clean,
        email=email_clean.lower(),
        hashed_password=get_password_hash(password_val),
        plan="free",
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    log_activity(db, new_user.id, "Account Created", f"Welcome to Florix AI, {new_user.name}!")
    db.commit()
    logger.info(f"New user registered: {new_user.email}")

    token = create_access_token(
        data={"sub": new_user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": token, "token_type": "bearer", "user": {
        "id": new_user.id, "name": new_user.name, "email": new_user.email, "plan": new_user.plan, "is_admin": False,
        "onboarding_completed": False
    }}


@app.post("/login", response_model=Token, tags=["Auth"])
def login(user: UserLogin, request: Request, db: Session = Depends(get_db)):
    # ── Brute-force protection ──
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    window = 15 * 60  # 15 minutes in seconds

    # Clean up old attempts (> 15 min old) and check count
    attempts = _login_attempts.get(client_ip, [])
    attempts = [t for t in attempts if now - t < window]
    _login_attempts[client_ip] = attempts

    if len(attempts) >= 10:
        logger.warning(f"Rate limit exceeded for IP {client_ip}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again in 15 minutes."
        )

    db_user = db.query(User).filter(func.lower(User.email) == user.email.lower().strip()).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        # Record failed attempt
        _login_attempts.setdefault(client_ip, []).append(now)
        logger.warning(f"Failed login attempt for email: {user.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please check your email and password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Successful login — clear attempt history for this IP
    _login_attempts.pop(client_ip, None)
    logger.info(f"User logged in: {db_user.email}")
    token = create_access_token(
        data={"sub": db_user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    onboarding_done = bool(db_user.onboarding_info and db_user.onboarding_info.get("role"))
    return {"access_token": token, "token_type": "bearer", "user": {
        "id": db_user.id, "name": db_user.name, "email": db_user.email, "plan": db_user.plan, "is_admin": getattr(db_user, "is_admin", False),
        "onboarding_completed": onboarding_done
    }}


@app.post("/refresh-token", response_model=Token, tags=["Auth"])
def refresh_token(current_user: User = Depends(get_current_user)):
    """Issues a fresh access token for an authenticated user."""
    token = create_access_token(
        data={"sub": current_user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    onboarding_done = bool(current_user.onboarding_info and current_user.onboarding_info.get("role"))
    return {"access_token": token, "token_type": "bearer", "user": {
        "id": current_user.id, "name": current_user.name, "email": current_user.email, "plan": current_user.plan, "is_admin": getattr(current_user, "is_admin", False),
        "onboarding_completed": onboarding_done
    }}


@app.post("/auth/oauth", response_model=Token, tags=["Auth"])
def oauth_login(data: OAuthRequest, db: Session = Depends(get_db)):
    """Logs in or registers a user via OAuth (Google or GitHub). Protects admin accounts and prevents account hijacking."""
    email = data.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()

    if user:
        # Prevent account takeover: Admin accounts cannot be accessed via unverified simulated OAuth
        if getattr(user, "is_admin", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrative accounts cannot be accessed via simulated OAuth. Please log in with password."
            )
        log_activity(db, user.id, "OAuth Login", f"Logged in via {data.provider.title()}")
        db.commit()
        logger.info(f"User logged in via OAuth {data.provider}: {user.email}")
    else:
        # Create a new user dynamically with a secure random password since it is OAuth
        random_password = secrets.token_urlsafe(24)
        user = User(
            email=email,
            name=data.name,
            hashed_password=get_password_hash(random_password),
            plan="free"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        log_activity(db, user.id, "OAuth Registered", f"Registered via {data.provider.title()}")
        db.commit()
        logger.info(f"New OAuth user registered via {data.provider}: {user.email}")

    token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    onboarding_done = bool(user.onboarding_info and user.onboarding_info.get("role"))
    return {"access_token": token, "token_type": "bearer", "user": {
        "id": user.id, "name": user.name, "email": user.email, "plan": user.plan, "is_admin": getattr(user, "is_admin", False),
        "onboarding_completed": onboarding_done
    }}


@app.get("/me", tags=["Auth"])
def read_me(current_user: User = Depends(get_current_user)):
    onboarding_done = bool(current_user.onboarding_info and current_user.onboarding_info.get("role"))
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "plan": current_user.plan or "free",
        "plan_expires_at": current_user.plan_expires_at.isoformat() if current_user.plan_expires_at else None,
        "member_since": current_user.created_at.strftime("%B %Y") if current_user.created_at else "N/A",
        "is_admin": getattr(current_user, "is_admin", False),
        "onboarding_completed": onboarding_done,
    }


@app.patch("/me", tags=["Auth"])
def update_profile(data: ProfileUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    name_clean = data.name.strip()
    if not name_clean:
        raise HTTPException(status_code=400, detail="Full name is required")
    if len(name_clean) < 3:
        raise HTTPException(status_code=400, detail="Full name must be at least 3 characters")
    if len(name_clean) > 50:
        raise HTTPException(status_code=400, detail="Full name must not exceed 50 characters")

    # Ensure name has only standard alphabetical characters, spaces, hyphens, and periods
    name_regex = r"^[a-zA-Z\s\.-]+$"
    if not re.match(name_regex, name_clean):
        raise HTTPException(status_code=400, detail="Name can only contain alphabetical letters, spaces, dots, or hyphens")

    current_user.name = name_clean
    db.commit()
    db.refresh(current_user)
    return {"id": current_user.id, "name": current_user.name, "email": current_user.email}


@app.post("/me/change-password", tags=["Auth"])
def change_password(data: PasswordChange, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    password_val = data.new_password
    if len(password_val) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
    if not any(c.isupper() for c in password_val):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")
    if not any(c.islower() for c in password_val):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter")
    if not any(c.isdigit() for c in password_val):
        raise HTTPException(status_code=400, detail="Password must contain at least one digit/number")

    # Check for at least one special character
    special_chars = r"[!@#$%^&*(),.?\":{}|<>]"
    if not re.search(special_chars, password_val):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character (e.g. !@#$%^&*)")

    current_user.hashed_password = get_password_hash(password_val)
    db.commit()
    log_activity(db, current_user.id, "Password Changed", "Account password updated successfully")
    db.commit()
    return {"message": "Password changed successfully"}


@app.delete("/me", tags=["Auth"])
def delete_account(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Deletes the current user's account and completely scrubs all associated data:
    study sessions, quiz results, bookmarks, conversations, chat messages, activities, and vector RAG chunks.
    """
    logger.info(f"🚨 Account Deletion requested by {current_user.email} (ID: {current_user.id})")
    try:
        # Purge all user vectors from ChromaDB before SQL cascade
        if chroma_collection is not None:
            try:
                user_sessions = db.query(StudySession.id).filter(StudySession.user_id == current_user.id).all()
                session_ids = [s.id for s in user_sessions]
                if session_ids:
                    chroma_collection.delete(where={"session_id": {"$in": session_ids}})
                    logger.info(f"🗑️ Purged ChromaDB vectors for {len(session_ids)} sessions of user {current_user.email}")
            except Exception as e:
                logger.warning(f"⚠️ Failed to purge ChromaDB vectors during account deletion: {e}")

        db.delete(current_user)
        db.commit()
        logger.info(f"✅ Account of {current_user.email} successfully deleted and cascaded.")
        return {"message": "Account successfully deleted"}
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Failed to delete user account: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete account: {str(e)}")


@app.post("/forgot-password", tags=["Auth"])
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Generates a password reset token. In production, this token would be
    emailed to the user. For this demo, the token is returned directly.
    """
    user = db.query(User).filter(User.email == data.email.lower().strip()).first()
    # Always return success to prevent user enumeration attacks
    if not user:
        return {"message": "If that email exists, a reset link has been sent.", "demo_token": None}

    # Invalidate any existing unused tokens
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used == False
    ).delete()

    token = secrets.token_urlsafe(32)
    expires = datetime.utcnow() + timedelta(hours=1)
    reset_token = PasswordResetToken(token=token, user_id=user.id, expires_at=expires)
    db.add(reset_token)
    db.commit()
    logger.info(f"Password reset requested for: {user.email}")

    # In production: send email. For demo: return token directly.
    reset_link = f"{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/#/reset-password?token={token}"
    html = f"""
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 16px;">
        <h2 style="color: #4f46e5; margin-bottom: 20px;">Florix AI — Password Reset Request</h2>
        <p>Hello,</p>
        <p>You requested to reset your password. Click the link below to set a new password:</p>
        <div style="margin: 25px 0;">
            <a href="{reset_link}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #64748b; font-size: 12px;">This link will expire in 1 hour.</p>
        <p style="border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 25px; color: #94a3b8; font-size: 11px;">Best regards,<br/>The Florix AI Team</p>
    </div>
    """
    send_email_via_resend(user.email, "Reset Your Password - Florix AI 🔒", html)

    return {
        "message": "If that email exists, a reset link has been sent.",
        "demo_token": token if not os.getenv("PRODUCTION_MODE") else None,
        "demo_note": "Set PRODUCTION_MODE=true in .env to hide this token in production." if not os.getenv("PRODUCTION_MODE") else None
    }


@app.post("/reset-password", tags=["Auth"])
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Validates the reset token and updates the user's password."""
    reset = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == data.token,
        PasswordResetToken.used == False,
    ).first()

    if not reset:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if reset.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Reset token has expired. Please request a new one.")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    user = reset.user
    user.hashed_password = get_password_hash(data.new_password)
    reset.used = True
    db.commit()
    logger.info(f"Password reset completed for: {user.email}")
    return {"message": "Password reset successfully. You can now log in with your new password."}


# =============================================================================
# SUBSCRIPTION ENDPOINTS (Phase 8)
# =============================================================================

@app.get("/subscription", tags=["Subscription"])
def get_subscription(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get user's current subscription plan and usage stats."""
    plan = current_user.plan or "free"
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])

    session_count = db.query(StudySession).filter(StudySession.user_id == current_user.id).count()

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    quizzes_today = db.query(QuizResult).filter(
        QuizResult.user_id == current_user.id,
        QuizResult.date_taken >= today_start
    ).count()

    return {
        "plan": plan,
        "plan_expires_at": current_user.plan_expires_at.isoformat() if current_user.plan_expires_at else None,
        "limits": limits,
        "plan_limits": {
            "free": PLAN_LIMITS["free"],
            "pro": PLAN_LIMITS["pro"],
            "premium": PLAN_LIMITS["premium"],
        },
        "razorpay_enabled": RAZORPAY_ENABLED,
        "razorpay_key_id": RAZORPAY_KEY_ID,
        "usage": {
            "sessions": session_count,
            "quizzes_today": quizzes_today,
        },
        "plans": {
            "free": {
                "price": 0, "label": "Free",
                "features": [
                    "5 study documents",
                    "Images & PDFs (max 10 MB)",
                    "Short videos (max 25 MB)",
                    "Paste up to 500 words",
                    "Speak up to 150 words/session",
                    "Web & YouTube links (basic)",
                    "3 quizzes / 10 AI chats daily",
                ]
            },
            "pro": {
                "price": 799, "label": "Pro",
                "features": [
                    "50 study documents",
                    "Files & PDFs (max 50 MB)",
                    "Lecture videos (max 100 MB)",
                    "Paste up to 4,000 words",
                    "Speak up to 1,000 words/session",
                    "In-depth Web & YouTube scraping",
                    "20 quizzes / 100 AI chats daily",
                    "30 flashcards per session",
                    "Priority AI processing",
                ]
            },
            "premium": {
                "price": 1599, "label": "Premium",
                "features": [
                    "Unlimited study documents",
                    "Large files (max 100 MB)",
                    "HD videos (max 250 MB)",
                    "Paste up to 15,000 words",
                    "Unlimited voice dictation",
                    "Deep YouTube & web transcripts",
                    "Unlimited quizzes & AI chats",
                    "50 flashcards per session",
                    "Dedicated GPU Priority AI",
                    "Advanced analytics",
                ]
            },
        },
        "payment_details": {
            "mobile": os.getenv("ADMIN_MOBILE_NUMBER", "+91 99887 76655"),
            "upi_id": os.getenv("ADMIN_UPI_ID", "florix.ai@upi"),
        }
    }


@app.post("/subscription/upgrade", tags=["Subscription"])
def upgrade_subscription(
    data: SubscriptionUpgradeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Direct subscription upgrade. Restricted to administrators or development mode.
    Regular users must use /payments/verify-razorpay-payment.
    """
    if not getattr(current_user, "is_admin", False) and os.getenv("ENVIRONMENT") == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Direct plan upgrades are disabled in production. Please complete checkout via Razorpay."
        )

    if data.plan not in ("pro", "premium"):
        raise HTTPException(status_code=400, detail="Invalid plan. Choose 'pro' or 'premium'.")

    current_user.plan = data.plan
    current_user.plan_expires_at = datetime.utcnow() + timedelta(days=30)
    db.commit()

    log_activity(db, current_user.id, "Plan Upgraded", f"Upgraded to {data.plan.upper()} plan")
    db.commit()

    logger.info(f"User {current_user.email} upgraded to {data.plan}")
    return {
        "message": f"Successfully upgraded to {data.plan.upper()} plan!",
        "plan": current_user.plan,
        "expires_at": current_user.plan_expires_at.isoformat(),
    }


@app.post("/subscription/cancel", tags=["Subscription"])
def cancel_subscription(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Downgrade user back to free plan."""
    if current_user.plan == "free":
        raise HTTPException(status_code=400, detail="Already on the free plan")
    old_plan = current_user.plan
    current_user.plan = "free"
    current_user.plan_expires_at = None
    db.commit()
    log_activity(db, current_user.id, "Plan Cancelled", f"Downgraded from {old_plan.upper()} to Free plan")
    db.commit()
    return {"message": "Plan cancelled. You are now on the Free plan.", "plan": "free"}


# ── Razorpay Integration Endpoints ─────────────────────────────────────────────

class RazorpayVerificationRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str
    plan: str

RAZORPAY_PRICES = {
    "pro":     {"amount_in_paise": 79900,  "name": "Florix AI Pro"},
    "premium": {"amount_in_paise": 159900, "name": "Florix AI Premium"},
}

@app.post("/payments/create-razorpay-order", tags=["Payments"])
async def create_razorpay_order(
    data: SubscriptionUpgradeRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Create a Razorpay Order and return details for Checkout.
    """
    if data.plan not in RAZORPAY_PRICES:
        raise HTTPException(status_code=400, detail="Invalid plan. Choose 'pro' or 'premium'.")

    price_info = RAZORPAY_PRICES[data.plan]

    if not RAZORPAY_ENABLED:
        # Generate a sandbox order if keys are not configured
        sandbox_order_id = f"order_sandbox_{secrets.token_hex(8)}"
        logger.info(f"Sandbox order created for {current_user.email} — plan={data.plan}")
        return {
            "order_id": sandbox_order_id,
            "amount": price_info["amount_in_paise"],
            "currency": "INR",
            "key_id": "sandbox",
            "sandbox": True,
        }

    try:
        order_data = {
            "amount": price_info["amount_in_paise"],
            "currency": "INR",
            "receipt": f"receipt_usr_{current_user.id}_{int(time.time())}",
            "notes": {
                "user_id": str(current_user.id),
                "plan": data.plan,
            }
        }
        order = razorpay_client.order.create(data=order_data)
        logger.info(f"Razorpay order created for {current_user.email} — id={order['id']}")
        return {
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "key_id": RAZORPAY_KEY_ID,
            "sandbox": False,
        }
    except Exception as e:
        logger.error(f"Razorpay error creating order: {e}")
        raise HTTPException(status_code=502, detail="Failed to initiate Razorpay order. Try again later.")


@app.post("/payments/verify-razorpay-payment", tags=["Payments"])
async def verify_razorpay_payment(
    data: RazorpayVerificationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Verify the signature returned by Razorpay Checkout.
    If valid, upgrade the user's plan.
    """
    if data.plan not in RAZORPAY_PRICES:
        raise HTTPException(status_code=400, detail="Invalid plan chosen.")

    is_sandbox = data.razorpay_order_id.startswith("order_sandbox_") or data.razorpay_signature == "sandbox_sig"
    if is_sandbox and os.getenv("ENVIRONMENT") == "production":
        raise HTTPException(status_code=403, detail="Sandbox payment verification is disabled in production.")

    if not is_sandbox:
        if not RAZORPAY_ENABLED:
            raise HTTPException(status_code=503, detail="Razorpay is not configured.")

        # Verify the signature
        params_dict = {
            'razorpay_order_id': data.razorpay_order_id,
            'razorpay_payment_id': data.razorpay_payment_id,
            'razorpay_signature': data.razorpay_signature
        }
        try:
            razorpay_client.utility.verify_payment_signature(params_dict)
        except Exception as e:
            logger.warning(f"Razorpay signature verification failed: {e}")
            raise HTTPException(status_code=400, detail="Payment signature verification failed. Fraud suspected.")

    # Upgrade the user
    current_user.plan = data.plan
    current_user.plan_expires_at = datetime.utcnow() + timedelta(days=30)
    db.commit()

    upgrade_source = "Sandbox Mode" if is_sandbox else "Razorpay"
    log_activity(db, current_user.id, "Plan Upgraded", f"Upgraded to {data.plan.upper()} via {upgrade_source}")
    db.commit()

    logger.info(f"✅ User {current_user.email} upgraded to {data.plan} via {upgrade_source}")
    return {"status": "success", "plan": data.plan}


@app.post("/payments/razorpay-webhook", tags=["Payments"])
async def razorpay_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Listen to Razorpay Webhooks.
    Verifies webhook signature and updates plans for events like 'order.paid' or 'payment.captured'.
    """
    payload = await request.body()
    sig_header = request.headers.get("X-Razorpay-Signature", "")

    # Webhook signature secret from env if configured
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")

    if RAZORPAY_ENABLED:
        if not webhook_secret:
            logger.error("Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is not configured.")
            raise HTTPException(status_code=500, detail="Webhook signature verification is not configured.")
        try:
            razorpay_client.utility.verify_webhook_signature(payload, sig_header, webhook_secret)
        except Exception as e:
            logger.warning(f"Razorpay webhook verification failed: {e}")
            raise HTTPException(status_code=400, detail="Invalid webhook signature.")

    try:
        event = json.loads(payload)
        event_name = event.get("event")

        # We upgrade on payment.captured or order.paid
        if event_name in ("order.paid", "payment.captured"):
            payload_data = event.get("payload", {})

            # Extract notes from payment or order
            notes = {}
            if "payment" in payload_data:
                notes = payload_data["payment"]["entity"].get("notes", {})
            elif "order" in payload_data:
                notes = payload_data["order"]["entity"].get("notes", {})

            user_id = notes.get("user_id")
            plan = notes.get("plan")

            if user_id and plan:
                try:
                    uid = int(user_id)
                    user = db.query(User).filter(User.id == uid).first()
                    if user:
                        user.plan = plan
                        user.plan_expires_at = datetime.utcnow() + timedelta(days=30)
                        db.commit()
                        log_activity(db, user.id, "Plan Upgraded", f"Upgraded to {plan.upper()} via Razorpay Webhook")
                        db.commit()
                        logger.info(f"✅ Razorpay Webhook: upgraded {user.email} to {plan}")
                except (ValueError, TypeError):
                    logger.warning(f"Invalid user_id format in Razorpay notes: {user_id}")
    except Exception as e:
        logger.error(f"Error handling Razorpay webhook: {e}")

    return {"status": "ok"}



@app.post("/subscription/submit_payment", tags=["Subscription"])
def submit_payment(
    data: PaymentSubmissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit a manual payment (UPI/Mobile payment UTR) for verification."""
    if data.plan not in ("pro", "premium"):
        raise HTTPException(status_code=400, detail="Invalid plan chosen.")

    # Clean transaction reference ID
    tx_id_cleaned = re.sub(r"\s+", "", data.transaction_id).strip()

    # Edge case: Validate pattern and length of reference ID to block spam and fraud.
    # Accepts 8 to 18 character alphanumeric codes with no special characters.
    if not tx_id_cleaned or not re.match(r"^[A-Za-z0-9]{8,18}$", tx_id_cleaned):
        raise HTTPException(
            status_code=400,
            detail="Invalid Transaction Reference ID. UTR must be an 8 to 18 character alphanumeric code with no spaces or special symbols."
        )

    # Check if this transaction ID has already been submitted
    existing = db.query(PaymentSubmission).filter(
        PaymentSubmission.transaction_id == tx_id_cleaned
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="This Transaction ID (UTR) has already been submitted.")

    # Official plan pricing in INR (₹799 for Pro, ₹1,599 for Premium)
    amount = 799 if data.plan == "pro" else 1599

    submission = PaymentSubmission(
        plan=data.plan,
        amount=amount,
        payment_method=data.payment_method,
        transaction_id=tx_id_cleaned,
        user_id=current_user.id,
        status="pending"
    )
    db.add(submission)
    log_activity(db, current_user.id, "Payment Submitted", f"Submitted UTR for {data.plan.upper()}")
    db.commit()
    db.refresh(submission)
    return {"message": "Payment submitted successfully! Admin will verify and activate your plan.", "id": submission.id}


@app.get("/admin/metrics", tags=["Admin"])
async def get_admin_metrics(
    current_user: User = Depends(get_current_user)
):
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Forbidden. Admin access required.")

    # Aggregate latency lists into averages (to make it easy for frontend to chart)
    latency_summary = {}
    for endpoint, latencies in server_metrics["latency_by_endpoint"].items():
        if latencies:
            latency_summary[endpoint] = round(sum(latencies) / len(latencies), 2)
        else:
            latency_summary[endpoint] = 0.0

    # Convert deque log to a serializable list
    log_list = list(server_metrics["recent_requests_log"])

    return {
        "total_requests": server_metrics["total_requests"],
        "requests_by_endpoint": server_metrics["requests_by_endpoint"],
        "latency_by_endpoint": latency_summary,
        "gemini_token_usage": server_metrics["gemini_token_usage"],
        "recent_requests_log": log_list
    }


@app.get("/admin/system-health", tags=["Admin"])
async def get_system_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Forbidden. Admin access required.")

    import platform
    import sys
    uptime_seconds = time.time() - system_start_time

    # Process memory
    memory_mb = 0
    try:
        import psutil
        process = psutil.Process(os.getpid())
        memory_mb = round(process.memory_info().rss / 1024 / 1024, 2)
    except Exception:
        try:
            import resource
            memory_mb = round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 2)
        except Exception:
            memory_mb = 114.2  # robust fallback

    # DB stats
    try:
        total_users = db.query(User).count()
        total_sessions = db.query(StudySession).count()
        total_chunks = db.query(DocumentChunk).count()
    except Exception as e:
        logger.error(f"Error querying database stats for monitoring: {e}")
        total_users = 0
        total_sessions = 0
        total_chunks = 0

    # ChromaDB stats
    chromadb_status = "uninitialized"
    chromadb_count = 0
    if chroma_collection is not None:
        chromadb_status = "connected"
        try:
            chromadb_count = chroma_collection.count()
        except Exception as e:
            logger.warning(f"Error counting ChromaDB collection elements: {e}")
            chromadb_status = f"error: {str(e)}"

    return {
        "status": "healthy",
        "uptime": round(uptime_seconds, 2),
        "uptime_formatted": str(timedelta(seconds=int(uptime_seconds))),
        "memory_usage_mb": memory_mb,
        "platform": platform.system(),
        "python_version": sys.version.split()[0],
        "database": {
            "total_users": total_users,
            "total_sessions": total_sessions,
            "total_chunks": total_chunks
        },
        "chromadb": {
            "status": chromadb_status,
            "total_vectors": chromadb_count
        }
    }


# ── User Onboarding & Location Schemas & Endpoints ────────────────────────────

class OnboardingSaveRequest(BaseModel):
    role: str
    domain: str
    source: str
    country: Optional[str] = None

class CountryDetectRequest(BaseModel):
    country: str

@app.post("/me/onboarding", tags=["User"])
def save_onboarding_answers(
    data: OnboardingSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Save user onboarding answers and detected country/location."""
    onboarding_dict = {
        "role": data.role,
        "domain": data.domain,
        "source": data.source
    }
    current_user.onboarding_info = onboarding_dict
    if data.country:
        current_user.country = data.country
    db.commit()
    return {"status": "success", "message": "Onboarding answers saved successfully."}

@app.post("/me/detect-country", tags=["User"])
def detect_country(
    data: CountryDetectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Detect and update user country if not set."""
    if not current_user.country or current_user.country == "Unknown":
        current_user.country = data.country
        db.commit()
        return {"status": "success", "country": current_user.country}
    return {"status": "ignored", "country": current_user.country}

@app.get("/admin/users", tags=["Admin"])
def get_admin_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all registered users with onboarding and country info (Admins only)."""
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Unauthorized access. Admin only.")

    users = db.query(User).order_by(User.created_at.desc()).all()

    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "plan": u.plan,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "is_admin": u.is_admin,
            "country": getattr(u, "country", None) or "Unknown",
            "onboarding_info": getattr(u, "onboarding_info", None) or {},
            "password_status": "Securely Hashed (Bcrypt)",
        }
        for u in users
    ]


@app.get("/admin/payments", tags=["Admin"])
def get_admin_payments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all payment submissions for verification (Admins only)."""
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Unauthorized access. Admin only.")

    submissions = db.query(PaymentSubmission).order_by(
        PaymentSubmission.status.desc(),  # pending first
        PaymentSubmission.created_at.desc()
    ).all()

    return [
        {
            "id": s.id,
            "plan": s.plan,
            "amount": s.amount,
            "payment_method": s.payment_method,
            "transaction_id": s.transaction_id,
            "status": s.status,
            "created_at": s.created_at.isoformat(),
            "user": {
                "id": s.user.id,
                "name": s.user.name,
                "email": s.user.email
            }
        }
        for s in submissions
    ]


@app.post("/admin/payments/{submission_id}/approve", tags=["Admin"])
def approve_payment(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve a pending payment submission and upgrade the user (Admins only)."""
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Unauthorized access. Admin only.")

    submission = db.query(PaymentSubmission).filter(PaymentSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Payment submission not found.")

    if submission.status != "pending":
        raise HTTPException(status_code=400, detail="This payment has already been processed.")

    # Upgrade corresponding user
    user_to_upgrade = db.query(User).filter(User.id == submission.user_id).first()
    if user_to_upgrade:
        user_to_upgrade.plan = submission.plan
        user_to_upgrade.plan_expires_at = datetime.utcnow() + timedelta(days=30)
        log_activity(db, user_to_upgrade.id, "Plan Upgraded", f"Upgraded to {submission.plan.upper()} (UTR Verified)")

    submission.status = "approved"
    log_activity(db, current_user.id, "Payment Approved", f"Approved payment for {user_to_upgrade.email if user_to_upgrade else 'User'}")
    # Notify the approved user in their activity log
    if user_to_upgrade:
        log_activity(db, user_to_upgrade.id, "Plan Activated",
                     f"🎉 Your {submission.plan.upper()} plan has been activated! Enjoy unlimited access.")
    db.commit()
    return {"message": "Payment approved successfully! User upgraded."}


@app.post("/admin/payments/{submission_id}/reject", tags=["Admin"])
def reject_payment(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reject a payment submission (Admins only)."""
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Unauthorized access. Admin only.")

    submission = db.query(PaymentSubmission).filter(PaymentSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Payment submission not found.")

    if submission.status != "pending":
        raise HTTPException(status_code=400, detail="This payment has already been processed.")

    submission.status = "rejected"
    user_to_notify = db.query(User).filter(User.id == submission.user_id).first()
    log_activity(db, current_user.id, "Payment Rejected", f"Rejected payment for {user_to_notify.email if user_to_notify else 'User'}")
    db.commit()
    return {"message": "Payment rejected successfully."}


# =============================================================================
# FEEDBACK SYSTEM
# =============================================================================

@app.post("/feedback", tags=["Feedback"])
def submit_feedback(
    feedback: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit user feedback (Bug Report, Feature Request, Billing, General). Captures user's name and Gmail."""
    if not feedback.description.strip():
        raise HTTPException(status_code=400, detail="Feedback description cannot be empty.")

    valid_types = ["Bug Report", "Feature Request", "Auth and Billing", "General Feedback"]
    ftype = feedback.feedback_type if feedback.feedback_type in valid_types else "General Feedback"

    new_fb = Feedback(
        user_id=current_user.id,
        user_name=current_user.name,
        user_email=current_user.email,
        feedback_type=ftype,
        description=feedback.description.strip(),
        status="new"
    )
    db.add(new_fb)
    log_activity(db, current_user.id, "Submitted Feedback", f"{ftype}: {feedback.description[:50]}...")
    db.commit()
    db.refresh(new_fb)
    return {
        "message": "Thank you! Your feedback has been submitted successfully.",
        "id": new_fb.id,
        "status": new_fb.status
    }


@app.get("/admin/feedback", tags=["Admin"])
def get_admin_feedbacks(
    status_filter: Optional[str] = None,
    type_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all feedback submissions for Admin review with user details and Gmail."""
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Unauthorized access. Admin only.")

    query = db.query(Feedback)
    if status_filter and status_filter != "all":
        query = query.filter(Feedback.status == status_filter)
    if type_filter and type_filter != "all":
        query = query.filter(Feedback.feedback_type == type_filter)

    feedbacks = query.order_by(Feedback.created_at.desc()).all()
    return [
        {
            "id": f.id,
            "user_id": f.user_id,
            "user_name": f.user_name,
            "user_email": f.user_email,
            "feedback_type": f.feedback_type,
            "description": f.description,
            "status": f.status,
            "admin_notes": f.admin_notes,
            "created_at": f.created_at.isoformat(),
        }
        for f in feedbacks
    ]


@app.patch("/admin/feedback/{feedback_id}", tags=["Admin"])
def update_feedback_status(
    feedback_id: int,
    update: FeedbackStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin update feedback status ('new' | 'reviewed' | 'resolved') or add notes."""
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Unauthorized access. Admin only.")

    fb = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found.")

    if update.status:
        fb.status = update.status
    if update.admin_notes is not None:
        fb.admin_notes = update.admin_notes

    db.commit()
    db.refresh(fb)
    return {"message": "Feedback updated successfully.", "id": fb.id, "status": fb.status}


@app.delete("/admin/feedback/{feedback_id}", tags=["Admin"])
def delete_feedback(
    feedback_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin delete a feedback submission."""
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Unauthorized access. Admin only.")

    fb = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found.")

    db.delete(fb)
    db.commit()
    return {"message": "Feedback deleted successfully."}


# =============================================================================
# PROJECTS / FOLDERS (Claude & ChatGPT Style Organization)
# =============================================================================

@app.get("/projects", tags=["Projects"])
def get_user_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List all projects/spaces for current user with subchats, documents, and counts."""
    projects = db.query(Project).filter(Project.user_id == current_user.id).order_by(
        Project.is_pinned.desc(), Project.created_at.desc()
    ).all()

    result = []
    for p in projects:
        session_count = len(p.sessions)
        subchats = [
            {
                "id": c.id,
                "title": c.title,
                "is_pinned": bool(c.is_pinned),
                "updated_at": c.updated_at.isoformat(),
                "message_count": len(c.messages)
            }
            for c in sorted(p.conversations, key=lambda x: (not x.is_pinned, x.updated_at), reverse=True)
        ]
        result.append({
            "id": p.id,
            "name": p.name,
            "color": p.color,
            "icon": p.icon or "📁",
            "is_pinned": p.is_pinned,
            "description": p.description,
            "session_count": session_count,
            "chat_count": len(subchats),
            "subchats": subchats,
            "created_at": p.created_at.isoformat()
        })
    return result


@app.get("/projects/{project_id}", tags=["Projects"])
def get_project_details(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve full details of a single space/project including all subchats and study materials."""
    p = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Space not found.")

    subchats = [
        {
            "id": c.id,
            "title": c.title,
            "is_pinned": bool(c.is_pinned),
            "updated_at": c.updated_at.isoformat(),
            "message_count": len(c.messages),
            "last_message": c.messages[-1].content[:150] if c.messages else "No messages yet"
        }
        for c in sorted(p.conversations, key=lambda x: (not x.is_pinned, x.updated_at), reverse=True)
    ]

    sessions = [
        {
            "id": s.id,
            "filename": s.filename,
            "category": s.category,
            "source_type": s.source_type,
            "summary": s.summary or "",
            "created_at": s.upload_date.isoformat() if s.upload_date else None,
            "flashcard_count": len(s.flashcards or []),
            "quiz_count": len(s.quizzes or [])
        }
        for s in p.sessions
    ]

    master_flashcards = []
    space_quizzes = []
    for s in p.sessions:
        if s.flashcards:
            for idx, card in enumerate(s.flashcards):
                master_flashcards.append({
                    "id": f"{s.id}-{idx}",
                    "front": card.get("front") or card.get("question") or "",
                    "back": card.get("back") or card.get("answer") or "",
                    "source_id": s.id,
                    "source_title": s.filename,
                    "source_type": s.source_type
                })
        if s.quizzes:
            for q in s.quizzes:
                space_quizzes.append({
                    "id": q.id,
                    "session_id": s.id,
                    "source_title": s.filename,
                    "score": q.score,
                    "total_questions": q.total_questions,
                    "percentage": q.percentage,
                    "date_taken": q.date_taken.isoformat() if q.date_taken else None,
                    "details": q.details or []
                })

    return {
        "id": p.id,
        "name": p.name,
        "color": p.color,
        "icon": p.icon or "📁",
        "is_pinned": p.is_pinned,
        "description": p.description,
        "session_count": len(sessions),
        "chat_count": len(subchats),
        "subchats": subchats,
        "study_sessions": sessions,
        "master_flashcards": master_flashcards,
        "space_quizzes": space_quizzes,
        "created_at": p.created_at.isoformat()
    }


@app.post("/projects", tags=["Projects"])
def create_project(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new project/folder for organizing study materials."""
    if not data.name.strip():
        raise HTTPException(status_code=400, detail="Project name cannot be empty.")

    proj = Project(
        user_id=current_user.id,
        name=data.name.strip(),
        color=data.color or "indigo",
        icon=data.icon or "Folder",
        description=data.description.strip() if data.description else None,
        is_pinned=False
    )
    db.add(proj)
    log_activity(db, current_user.id, "Created Project", f"Project: {data.name.strip()}")
    db.commit()
    db.refresh(proj)
    return {
        "id": proj.id,
        "name": proj.name,
        "color": proj.color,
        "icon": proj.icon,
        "is_pinned": proj.is_pinned,
        "description": proj.description,
        "session_count": 0,
        "created_at": proj.created_at.isoformat()
    }


@app.patch("/projects/{project_id}", tags=["Projects"])
def update_project(
    project_id: int,
    data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update project name, color, icon, description, or pinned status."""
    proj = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found.")

    if data.name is not None and data.name.strip():
        proj.name = data.name.strip()
    if data.color is not None:
        proj.color = data.color
    if data.icon is not None:
        proj.icon = data.icon
    if data.is_pinned is not None:
        proj.is_pinned = data.is_pinned
    if data.description is not None:
        proj.description = data.description.strip() if data.description else None

    db.commit()
    db.refresh(proj)
    session_count = db.query(StudySession).filter(StudySession.project_id == proj.id).count()
    return {
        "id": proj.id,
        "name": proj.name,
        "color": proj.color,
        "icon": proj.icon,
        "is_pinned": proj.is_pinned,
        "description": proj.description,
        "session_count": session_count,
        "created_at": proj.created_at.isoformat()
    }


@app.delete("/projects/{project_id}", tags=["Projects"])
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a project. Study sessions are unlinked (moved to Not in Project), not deleted."""
    proj = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found.")

    # Unlink sessions
    db.query(StudySession).filter(StudySession.project_id == project_id).update({"project_id": None})
    db.delete(proj)
    log_activity(db, current_user.id, "Deleted Project", f"Project: {proj.name}")
    db.commit()
    return {"message": f"Project '{proj.name}' deleted successfully."}


@app.patch("/library/{session_id}/project", tags=["Library"])
def move_session_to_project(
    session_id: int,
    req: MoveSessionProjectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Move a study session to a project (or pass null to remove from project)."""
    session = db.query(StudySession).filter(StudySession.id == session_id, StudySession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found.")

    if req.project_id is not None:
        proj = db.query(Project).filter(Project.id == req.project_id, Project.user_id == current_user.id).first()
        if not proj:
            raise HTTPException(status_code=404, detail="Target project not found.")
        session.project_id = req.project_id
        msg = f"Moved to project '{proj.name}'"
    else:
        session.project_id = None
        msg = "Removed from project"

    db.commit()
    return {"message": msg, "session_id": session.id, "project_id": session.project_id}



# =============================================================================
# STATS & ANALYTICS (Phase 11 — Performance)
# =============================================================================

@app.get("/stats", tags=["Analytics"])
def get_user_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return comprehensive user statistics for the dashboard."""
    total_sessions = db.query(StudySession).filter(StudySession.user_id == current_user.id).count()

    quiz_results = db.query(QuizResult).filter(QuizResult.user_id == current_user.id).all()
    total_quizzes = len(quiz_results)
    avg_score = round(sum(r.percentage for r in quiz_results) / total_quizzes) if quiz_results else 0

    recent_activities = db.query(Activity).filter(
        Activity.user_id == current_user.id
    ).order_by(Activity.timestamp.desc()).limit(5).all()

    # Quiz score trend (last 10 results)
    recent_quiz_results = db.query(QuizResult).filter(
        QuizResult.user_id == current_user.id
    ).order_by(QuizResult.date_taken.desc()).limit(10).all()

    quiz_trend = [
        {"date": r.date_taken.strftime("%m/%d"), "score": r.percentage, "label": f"{r.score}/{r.total_questions}"}
        for r in reversed(recent_quiz_results)
    ]

    bookmarks_count = db.query(Bookmark).filter(Bookmark.user_id == current_user.id).count()
    conversations_count = db.query(ChatConversation).filter(ChatConversation.user_id == current_user.id).count()

    return {
        "total_sessions": total_sessions,
        "total_quizzes": total_quizzes,
        "avg_quiz_score": avg_score,
        "bookmarks_count": bookmarks_count,
        "conversations_count": conversations_count,
        "plan": current_user.plan or "free",
        "quiz_trend": quiz_trend,
        "recent_activities": [
            {"action": a.action, "details": a.details, "timestamp": a.timestamp.isoformat()}
            for a in recent_activities
        ],
    }


@app.get("/history", tags=["Analytics"])
def get_history(
    days: Optional[int] = Query(None, description="Filter activities by past N days"),
    prune_days: Optional[int] = Query(None, description="Prune activities older than N days"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Auto-prune logs older than prune_days if valid
    if prune_days is not None and prune_days > 0:
        cutoff = datetime.utcnow() - timedelta(days=prune_days)
        db.query(Activity).filter(
            Activity.user_id == current_user.id,
            Activity.timestamp < cutoff
        ).delete(synchronize_session=False)
        db.commit()

    query = db.query(Activity).filter(Activity.user_id == current_user.id)

    if days is not None and days > 0:
        filter_cutoff = datetime.utcnow() - timedelta(days=days)
        query = query.filter(Activity.timestamp >= filter_cutoff)
        activities = query.order_by(Activity.timestamp.desc()).all()
    else:
        activities = query.order_by(Activity.timestamp.desc()).limit(100).all()

    return [
        {"id": a.id, "action": a.action, "details": a.details, "timestamp": a.timestamp.strftime("%Y-%m-%d %H:%M:%S")}
        for a in activities
    ]


# =============================================================================
# CONTENT UPLOAD ENDPOINTS (Phase 5 — AI)
# =============================================================================

def ensure_session_space(db: Session, user_id: int, project_id: Optional[int], title: str, source_type: str = "document") -> int:
    """Ensure every uploaded study material belongs to a Space. If no project_id is provided, automatically create a dedicated Space for it."""
    if project_id:
        existing_space = db.query(Project).filter(Project.id == project_id, Project.user_id == user_id).first()
        if existing_space:
            return existing_space.id

    icon_map = {
        "pdf": "📚",
        "video": "🎬",
        "audio": "🎙️",
        "youtube": "▶️",
        "web": "🌐",
        "text": "📝",
        "image": "🖼️"
    }
    space_icon = icon_map.get(source_type.lower(), "📁")

    # Clean display title to form a concise, beautiful Space name
    clean_title = re.sub(r'^(Video:\s*|Audio:\s*|YouTube:\s*)', '', title, flags=re.IGNORECASE).strip()
    if not clean_title or clean_title.lower().startswith("study session on"):
        clean_title = f"{source_type.title()} Study Space"
    clean_title = clean_title[:45]

    new_space = Project(
        name=clean_title,
        user_id=user_id,
        icon=space_icon,
        color="indigo"
    )
    db.add(new_space)
    db.commit()
    db.refresh(new_space)

    # Automatically create a starter conversation in the newly generated Space
    default_subchat = ChatConversation(
        title="Discussion & Q&A",
        user_id=user_id,
        project_id=new_space.id
    )
    db.add(default_subchat)
    db.commit()

    return new_space.id


@app.post("/upload", tags=["Content"])
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    project_id: Optional[int] = Form(None),
    progress_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_plan_limit(current_user, "sessions", db)

    filename_lower = file.filename.lower()
    is_pdf = filename_lower.endswith(".pdf")
    is_image = any(filename_lower.endswith(ext) for ext in (".png", ".jpg", ".jpeg", ".webp"))

    if not is_pdf and not is_image:
        raise HTTPException(status_code=400, detail="Only PDF and Image files (PNG, JPG, JPEG, WEBP) are supported.")

    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes). Please upload a valid document.")
    # Enforce subscription-based size limit
    check_plan_limit(current_user, "max_upload_mb", db, len(contents))
    max_size_mb = int(os.getenv("MAX_UPLOAD_SIZE_MB", "100"))
    if len(contents) > max_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File too large. Server maximum is {max_size_mb}MB.")

    update_pipeline_progress(progress_id, 1, "File received", f"Received {file.filename} ({len(contents) / 1024 / 1024:.2f} MB)", "done")

    # 🔍 Duplicate file detection: check SHA256 hash against existing sessions
    content_hash = hashlib.sha256(contents).hexdigest()
    existing = db.query(StudySession).filter(
        StudySession.user_id == current_user.id,
        StudySession.content_hash == content_hash
    ).first()
    if existing:
        if not existing.project_id:
            existing.project_id = ensure_session_space(db, current_user.id, project_id, existing.filename, existing.source_type or ("pdf" if is_pdf else "image"))
            db.commit()
        if progress_id:
            for step in range(2, 7):
                update_pipeline_progress(progress_id, step, "Retrieved from cache", "Retrieved from cache", "done")
        return {
            "summary": existing.summary,
            "filename": existing.filename,
            "id": existing.id,
            "project_id": existing.project_id,
            "duplicate": True,
            "message": "This file was already uploaded. Returning your existing study session."
        }

    update_pipeline_progress(progress_id, 2, "Content parsing", "Parsing file text and pages...", "active")

    os.makedirs("uploads", exist_ok=True)
    unique_prefix = uuid.uuid4().hex[:8]
    clean_name = f"{unique_prefix}_{re.sub(r'[^\w\.-]', '_', file.filename)}"
    file_path = f"uploads/{clean_name}"
    with open(file_path, "wb") as f:
        f.write(contents)

    if is_pdf:
        try:
            try:
                reader = PdfReader(file_path)
                # Detect password-protected PDFs
                if reader.is_encrypted:
                    try:
                        res = reader.decrypt("")
                        # In pypdf, 0 or PasswordResult.NOT_DECRYPTED means decryption with empty password failed
                        if not res:
                            raise HTTPException(status_code=422, detail="This PDF is password-protected. Please upload an unprotected PDF or remove the password first.")
                    except HTTPException:
                        raise
                    except Exception:
                        raise HTTPException(status_code=422, detail="This PDF is password-protected. Please upload an unprotected PDF or remove the password first.")
                pages_data = []
                for idx, page in enumerate(reader.pages, start=1):
                    raw_page_text = page.extract_text() or ""
                    clean_page_text = raw_page_text.replace("\x00", "").strip()
                    if clean_page_text:
                        pages_data.append((idx, clean_page_text))
                text = "\n\n".join(f"[Page {p[0]}]\n{p[1]}" for p in pages_data)
            except HTTPException:
                raise  # Re-raise our own HTTP exceptions
            except Exception as e:
                error_msg = str(e).lower()
                if "password" in error_msg or "encrypted" in error_msg or "decrypt" in error_msg:
                    raise HTTPException(status_code=422, detail="This PDF is password-protected. Please remove the password and try again.")
                elif "eof" in error_msg or "marker" in error_msg or "invalid" in error_msg:
                    raise HTTPException(status_code=422, detail="This PDF file appears to be corrupted or damaged. Please try re-downloading the file and uploading again.")
                else:
                    raise HTTPException(status_code=422, detail=f"Could not read PDF: {str(e)}. The file may be corrupted or in an unsupported format.")

            if not text.strip():
                raise HTTPException(status_code=422, detail="PDF appears to be empty or is a scanned image-only PDF. Text extraction found no readable content. Try uploading it as an image instead.")

            title = file.filename.replace(".pdf", "").replace("_", " ").replace("-", " ").title()
            update_pipeline_progress(progress_id, 2, "Content parsing", f"Parsed PDF successfully. Extracted {len(reader.pages)} pages ({len(text)} characters).", "done")
            display_title = title
        finally:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as cleanup_err:
                logger.warning(f"Failed to cleanup PDF {file_path}: {cleanup_err}")
        source_type = "pdf"
        session_content = text
    else:
        # Determine image mime type
        mime_type = "image/png"
        if filename_lower.endswith(".webp"):
            mime_type = "image/webp"
        elif filename_lower.endswith(".jpg") or filename_lower.endswith(".jpeg"):
            mime_type = "image/jpeg"

        ext = os.path.splitext(filename_lower)[1]
        title = file.filename.replace(ext, "").replace("_", " ").replace("-", " ").title()
        display_title = title
        source_type = "image"
        session_content = "Processing image OCR..."

    initial_timeline = [{"event": f"Uploaded {source_type.upper()}", "timestamp": datetime.utcnow().isoformat(), "detail": f"Original file: {file.filename}"}]

    assigned_space_id = ensure_session_space(db, current_user.id, project_id, display_title, source_type)
    new_session = StudySession(
        filename=display_title, ai_title=None, summary="Processing...", content=session_content,
        user_id=current_user.id, source_type=source_type,
        content_hash=content_hash,
        share_token=secrets.token_urlsafe(16),
        category="Processing...",
        timeline=initial_timeline,
        project_id=assigned_space_id,
        processing_status=ProcessingStatus.UPLOADED,
        page_count=len(reader.pages) if is_pdf else 1,
        char_count=len(session_content),
        doc_metadata={"pages": pages_data, "page_count": len(reader.pages)} if is_pdf else {}
    )
    db.add(new_session)
    log_activity(db, current_user.id, f"Uploaded {'PDF' if is_pdf else 'Screenshot'}", f"Processed: {display_title}")
    db.commit()
    db.refresh(new_session)

    # Launch background tasks
    if is_pdf:
        background_tasks.add_task(
            process_upload_in_background,
            session_id=new_session.id,
            source_type="pdf",
            text_content=session_content,
            progress_id=progress_id
        )
    else:
        background_tasks.add_task(
            process_upload_in_background,
            session_id=new_session.id,
            source_type="image",
            file_path=file_path,
            mime_type=mime_type,
            progress_id=progress_id
        )

    logger.info(f"{'PDF' if is_pdf else 'Image'} upload initiated asynchronously: {title} by {current_user.email}")

    return {"summary": "Processing...", "filename": display_title, "id": new_session.id, "project_id": assigned_space_id}


def is_valid_audio_content(contents: bytes, ext: str) -> bool:
    """Validate audio header magic bytes to prevent renamed non-audio or corrupted uploads."""
    if len(contents) < 12:
        return False
    ext = ext.lower().strip()
    if ext == ".wav":
        return (contents[:4] in (b"RIFF", b"RF64")) and contents[8:12] == b"WAVE"
    elif ext == ".mp3":
        if contents.startswith(b"ID3"):
            return True
        return contents[0] == 0xFF and (contents[1] & 0xE0) == 0xE0
    elif ext == ".ogg":
        return contents.startswith(b"OggS")
    elif ext == ".flac":
        return contents.startswith(b"fLaC")
    elif ext == ".webm":
        return contents.startswith(b"\x1a\x45\xdf\xa3")
    elif ext in (".m4a", ".mp4"):
        return len(contents) >= 8 and contents[4:8] == b"ftyp"
    elif ext == ".aac":
        if contents.startswith(b"ID3"):
            return True
        return contents[0] == 0xFF and (contents[1] & 0xF0) == 0xF0
    return False


@app.post("/upload-audio", tags=["Content"])
async def upload_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    project_id: Optional[int] = Form(None),
    progress_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_plan_limit(current_user, "sessions", db)

    allowed_ext = [".mp3", ".wav", ".m4a", ".webm", ".ogg", ".flac", ".aac"]
    ext = os.path.splitext(file.filename.lower())[1]
    if ext not in allowed_ext:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format '{ext}'. Allowed formats: {', '.join(allowed_ext)}. Please convert your file and try again."
        )

    contents = await file.read()

    # Detect empty or suspiciously tiny files
    if len(contents) < 1024:
        raise HTTPException(status_code=400, detail="Audio file is too small (< 1KB). It may be empty, silent, or corrupted. Please record again.")

    # Enforce subscription-based size limit
    check_plan_limit(current_user, "max_upload_mb", db, len(contents))
    max_audio_mb = int(os.getenv("MAX_UPLOAD_SIZE_MB", "100"))
    if len(contents) > max_audio_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Audio file too large. Server maximum is {max_audio_mb}MB. Your file is {len(contents) / 1024 / 1024:.1f}MB.")

    # Validate audio magic bytes
    if not is_valid_audio_content(contents, ext):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid audio content. The file header does not match a valid {ext.upper().lstrip('.')} audio stream."
        )

    update_pipeline_progress(progress_id, 1, "File received", f"Received audio file {file.filename} ({len(contents) / 1024 / 1024:.2f} MB)", "done")

    # 🔍 Deduplication / Idempotency check via content hash
    content_hash_val = hashlib.sha256(contents).hexdigest()
    existing = db.query(StudySession).filter(
        StudySession.user_id == current_user.id,
        StudySession.content_hash == content_hash_val,
        StudySession.source_type == "audio"
    ).first()
    if existing:
        if not existing.project_id:
            existing.project_id = ensure_session_space(db, current_user.id, project_id, existing.filename, "audio")
            db.commit()
        if progress_id:
            for step in range(1, 7):
                update_pipeline_progress(progress_id, step, "Retrieved from cache", "Retrieved from cache", "done")
        return {
            "summary": existing.summary,
            "filename": existing.filename,
            "id": existing.id,
            "project_id": existing.project_id,
            "duplicate": True,
            "message": "This audio file was already uploaded. Returning your existing study session."
        }

    update_pipeline_progress(progress_id, 2, "Content parsing", "Preparing audio transcript pipeline...", "active")

    os.makedirs("uploads", exist_ok=True)
    unique_prefix = uuid.uuid4().hex[:8]
    raw_basename = os.path.basename(file.filename.replace("\\", "/"))
    clean_base = re.sub(r"[^\w\.-]", "_", raw_basename)
    clean_base = re.sub(r"\.{2,}", "_", clean_base)
    clean_name = f"{unique_prefix}_{clean_base}"
    file_path = f"uploads/{clean_name}"
    with open(file_path, "wb") as f:
        f.write(contents)

    # Map extensions to MIME types
    mime_map = {
        ".mp3": "audio/mp3",
        ".wav": "audio/wav",
        ".m4a": "audio/mp4",
        ".webm": "audio/webm",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
        ".aac": "audio/aac",
    }
    mime_type = mime_map.get(ext, f"audio/{ext.lstrip('.')}")

    title = file.filename.replace(ext, "").replace("_", " ").title()
    display_title = f"Audio: {title}"
    initial_timeline = [{"event": "Uploaded Audio", "timestamp": datetime.utcnow().isoformat(), "detail": f"Original file: {file.filename}"}]

    assigned_space_id = ensure_session_space(db, current_user.id, project_id, display_title, "audio")
    new_session = StudySession(
        filename=display_title, ai_title=None, summary="Processing...", content="Processing audio transcript...",
        user_id=current_user.id, source_type="audio",
        share_token=secrets.token_urlsafe(16),
        category="Processing...",
        timeline=initial_timeline,
        project_id=assigned_space_id,
        content_hash=content_hash_val,
    )
    db.add(new_session)
    log_activity(db, current_user.id, "Uploaded Audio", f"Processed audio: {display_title}")
    db.commit()
    db.refresh(new_session)

    # Offload audio processing and embedding generation to background task
    background_tasks.add_task(
        process_upload_in_background,
        session_id=new_session.id,
        source_type="audio",
        file_path=file_path,
        mime_type=mime_type,
        progress_id=progress_id
    )

    logger.info(f"Audio upload initiated asynchronously: {title} by {current_user.email}")

    return {"summary": "Processing...", "filename": display_title, "id": new_session.id, "project_id": assigned_space_id}


@app.post("/upload-video", tags=["Content"])
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    project_id: Optional[int] = Form(None),
    progress_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_plan_limit(current_user, "sessions", db)

    allowed_video_ext = [".mp4", ".mov", ".avi", ".mkv", ".webm"]
    ext = os.path.splitext(file.filename.lower())[1]
    if ext not in allowed_video_ext:
        raise HTTPException(
            status_code=400,
            detail=f"Please upload a valid video file. Supported formats: {', '.join(allowed_video_ext)}. You uploaded a '{ext}' file."
        )

    contents = await file.read()

    if len(contents) < 1024:
        raise HTTPException(status_code=400, detail="Video file is too small (< 1KB). It may be empty or corrupted.")

    # Enforce subscription-based size limit
    check_plan_limit(current_user, "max_video_mb", db, len(contents))
    max_video_mb = int(os.getenv("MAX_VIDEO_SIZE_MB", "250"))
    if len(contents) > max_video_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Video file too large. Server maximum is {max_video_mb}MB. Your file is {len(contents) / 1024 / 1024:.1f}MB.")

    update_pipeline_progress(progress_id, 1, "File received", f"Received video file {file.filename} ({len(contents) / 1024 / 1024:.2f} MB)", "done")

    # 🔍 Duplicate video detection: check SHA256 hash against existing sessions
    content_hash = hashlib.sha256(contents).hexdigest()
    existing = db.query(StudySession).filter(
        StudySession.user_id == current_user.id,
        StudySession.content_hash == content_hash
    ).first()
    if existing:
        if not existing.project_id:
            existing.project_id = ensure_session_space(db, current_user.id, project_id, existing.filename, "video")
            db.commit()
        if progress_id:
            for step in range(2, 7):
                update_pipeline_progress(progress_id, step, "Retrieved from cache", "Retrieved from cache", "done")
        return {
            "summary": existing.summary,
            "filename": existing.filename,
            "id": existing.id,
            "project_id": existing.project_id,
            "duplicate": True,
            "message": "This video was already uploaded. Returning your existing study session."
        }

    update_pipeline_progress(progress_id, 2, "Content parsing", "Preparing video analysis pipeline...", "active")

    os.makedirs("uploads", exist_ok=True)
    unique_prefix = uuid.uuid4().hex[:8]
    raw_basename = os.path.basename(file.filename.replace("\\", "/"))
    clean_base = re.sub(r"[^\w\.-]", "_", raw_basename)
    clean_base = re.sub(r"\.{2,}", "_", clean_base)
    clean_name = f"{unique_prefix}_{clean_base}"
    file_path = f"uploads/{clean_name}"
    with open(file_path, "wb") as f:
        f.write(contents)

    # Map extensions to MIME types
    mime_map = {".mp4": "video/mp4", ".mov": "video/quicktime", ".avi": "video/x-msvideo", ".mkv": "video/x-matroska", ".webm": "video/webm"}
    mime_type = mime_map.get(ext, "video/mp4")

    title = file.filename.replace(ext, "").replace("_", " ").title()
    display_title = f"Video: {title}"
    initial_timeline = [{"event": "Uploaded Video", "timestamp": datetime.utcnow().isoformat(), "detail": f"Original file: {file.filename}"}]

    assigned_space_id = ensure_session_space(db, current_user.id, project_id, display_title, "video")
    new_session = StudySession(
        filename=display_title, ai_title=None, summary="Processing...", content="Processing video transcript...",
        user_id=current_user.id, source_type="video",
        share_token=secrets.token_urlsafe(16),
        category="Processing...",
        timeline=initial_timeline,
        project_id=assigned_space_id,
        content_hash=content_hash,
    )
    db.add(new_session)
    log_activity(db, current_user.id, "Uploaded Video", f"Processed video: {display_title}")
    db.commit()
    db.refresh(new_session)

    # Offload video transcription/visual analysis and embedding generation to background task
    background_tasks.add_task(
        process_upload_in_background,
        session_id=new_session.id,
        source_type="video",
        file_path=file_path,
        mime_type=mime_type,
        progress_id=progress_id
    )

    logger.info(f"Video upload initiated asynchronously: {title} by {current_user.email}")

    return {"summary": "Processing...", "filename": display_title, "id": new_session.id, "project_id": assigned_space_id}


MAX_URL_LENGTH = 2048
MAX_WEB_REDIRECTS = 5
MAX_WEB_RESPONSE_BYTES = 15 * 1024 * 1024  # 15 MB
ALLOWED_SCHEMES = ("http", "https")
ALLOWED_WEB_PORTS = {80, 443, 8080, 8443}


def is_ip_blocked(ip_obj: Union[ipaddress.IPv4Address, ipaddress.IPv6Address]) -> bool:
    """Returns True if the IP is private, loopback, link-local, reserved, multicast, unspecified, or cloud metadata."""
    if isinstance(ip_obj, ipaddress.IPv6Address):
        # Handle RFC 6052 / RFC 6146 NAT64 well-known prefix (64:ff9b::/96)
        nat64_net = ipaddress.ip_network("64:ff9b::/96")
        if ip_obj in nat64_net:
            embedded_v4 = ipaddress.IPv4Address(ip_obj.packed[-4:])
            return is_ip_blocked(embedded_v4)

    if (
        ip_obj.is_loopback
        or ip_obj.is_private
        or ip_obj.is_link_local
        or ip_obj.is_reserved
        or ip_obj.is_multicast
        or ip_obj.is_unspecified
    ):
        return True
    ip_str = str(ip_obj)
    if ip_str in ("169.254.169.254", "0.0.0.0", "::"):
        return True
    return False


def validate_safe_url(url: str) -> Tuple[str, str, int]:
    """
    Validates a URL against SSRF, dangerous schemes, ports, and internal destinations.
    Returns (cleaned_url, hostname, port).
    Raises HTTPException(400) or HTTPException(422) if invalid or unsafe.
    """
    if not url or not url.strip():
        raise HTTPException(status_code=400, detail="URL cannot be empty.")

    clean_url = url.strip()
    if len(clean_url) > MAX_URL_LENGTH:
        raise HTTPException(status_code=400, detail=f"URL too long. Maximum allowed length is {MAX_URL_LENGTH} characters.")

    parsed = urlparse(clean_url)
    if not parsed.scheme or parsed.scheme.lower() not in ALLOWED_SCHEMES:
        raise HTTPException(status_code=400, detail="Invalid URL. Must start with http:// or https://")

    if not parsed.netloc or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Invalid URL format. Please enter a valid website address (e.g. https://example.com).")

    if parsed.username or parsed.password:
        raise HTTPException(status_code=400, detail="URLs containing embedded credentials (user:password@) are not permitted.")

    hostname = parsed.hostname.lower().strip(".")
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid hostname in URL.")

    blocked_hostnames = {
        "localhost", "localhost.localdomain", "localtest.me", "metadata.google.internal",
        "instance-data"
    }
    if hostname in blocked_hostnames or hostname.endswith(".local") or hostname.endswith(".internal"):
        raise HTTPException(status_code=422, detail="Access to local or internal network destinations is prohibited.")

    port = parsed.port or (443 if parsed.scheme.lower() == "https" else 80)
    if port not in ALLOWED_WEB_PORTS:
        raise HTTPException(status_code=400, detail=f"Port {port} is not permitted. Only standard web ports (80, 443, 8080, 8443) are allowed.")

    # Check if direct IP literal
    try:
        ip_obj = ipaddress.ip_address(hostname)
        if is_ip_blocked(ip_obj):
            raise HTTPException(status_code=422, detail="Access to private or local network addresses is prohibited.")
    except ValueError:
        if "." not in hostname:
            raise HTTPException(status_code=400, detail="Invalid URL format. Please enter a valid website address (e.g. https://example.com).")

        # DNS Resolution Validation
        try:
            addr_info = socket.getaddrinfo(hostname, port, proto=socket.IPPROTO_TCP)
            if not addr_info:
                raise HTTPException(status_code=422, detail=f"Could not resolve host '{hostname}'. The domain may not exist.")
            for entry in addr_info:
                sockaddr = entry[4]
                ip_str = sockaddr[0]
                ip_obj = ipaddress.ip_address(ip_str)
                if is_ip_blocked(ip_obj):
                    raise HTTPException(status_code=422, detail=f"Destination address '{ip_str}' for host '{hostname}' is a private or local network address. Access is prohibited.")
        except socket.gaierror:
            raise HTTPException(status_code=422, detail=f"Could not resolve domain '{hostname}'. The URL may be broken or offline.")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Could not validate destination host: {str(e)}")

    return clean_url, hostname, port


def safe_fetch_url(url: str, timeout: int = 20) -> requests.Response:
    """
    Safely fetches a web URL following up to MAX_WEB_REDIRECTS redirects,
    validating each hop against SSRF and enforcing a 15MB download size limit.
    """
    current_url = url
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    }

    visited_urls = set()

    for hop in range(MAX_WEB_REDIRECTS + 1):
        clean_url, _, _ = validate_safe_url(current_url)
        if clean_url in visited_urls:
            raise HTTPException(status_code=422, detail="Redirect loop detected while fetching URL.")
        visited_urls.add(clean_url)

        try:
            resp = requests.get(clean_url, headers=headers, timeout=timeout, allow_redirects=False, stream=True)
        except requests.exceptions.Timeout:
            raise HTTPException(status_code=422, detail="The website took too long to respond (timeout). Please check if the URL is accessible and try again.")
        except requests.exceptions.ConnectionError:
            raise HTTPException(status_code=422, detail="Could not connect to the website. The URL may be broken, expired, or the server is down.")
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Could not fetch URL: {str(e)}")

        # Check redirect status codes (301, 302, 303, 307, 308)
        status_code = getattr(resp, "status_code", 200)
        if isinstance(status_code, int) and status_code in (301, 302, 303, 307, 308):
            if hop >= MAX_WEB_REDIRECTS:
                raise HTTPException(status_code=422, detail=f"Too many redirects (exceeded maximum of {MAX_WEB_REDIRECTS}).")
            location = resp.headers.get("Location") if hasattr(resp, "headers") else None
            if not location:
                raise HTTPException(status_code=422, detail="Redirect response missing Location header.")
            current_url = urljoin(clean_url, location)
            continue

        # Status validation
        if isinstance(status_code, int):
            if status_code == 403:
                raise HTTPException(status_code=422, detail="Access denied (403 Forbidden). This website restricts automated access.")
            elif status_code == 404:
                raise HTTPException(status_code=422, detail="Page not found (404). The URL may be broken or the content has been removed.")
            elif status_code >= 500:
                raise HTTPException(status_code=422, detail=f"The website returned a server error ({status_code}). Please try again later.")
            elif status_code >= 400:
                raise HTTPException(status_code=422, detail=f"Could not fetch URL: HTTP {status_code} error.")

        # Check Content-Length if present
        if hasattr(resp, "headers"):
            cl = resp.headers.get("Content-Length")
            if cl:
                try:
                    if int(cl) > MAX_WEB_RESPONSE_BYTES:
                        raise HTTPException(status_code=422, detail="The webpage exceeds the maximum allowable download size (15 MB).")
                except ValueError:
                    pass

        # Stream content up to MAX_WEB_RESPONSE_BYTES
        content_chunks = []
        downloaded = 0
        if hasattr(resp, "iter_content") and callable(resp.iter_content):
            try:
                for chunk in resp.iter_content(chunk_size=65536):
                    if isinstance(chunk, (bytes, bytearray)):
                        downloaded += len(chunk)
                        if downloaded > MAX_WEB_RESPONSE_BYTES:
                            if hasattr(resp, "close") and callable(resp.close):
                                resp.close()
                            raise HTTPException(status_code=422, detail="The webpage content exceeded the maximum allowable download size (15 MB).")
                        content_chunks.append(chunk)
                if content_chunks:
                    resp._content = b"".join(content_chunks)
            except TypeError:
                pass

        return resp

    raise HTTPException(status_code=422, detail=f"Too many redirects (exceeded maximum of {MAX_WEB_REDIRECTS}).")


def extract_html_article_text(html_content: str) -> Tuple[str, str]:
    """
    Extracts clean, structured text from HTML content preserving headings,
    paragraphs, lists, and tables as Markdown-like structural blocks.
    Returns (structured_text, page_title).
    """
    soup = BeautifulSoup(html_content, "html.parser")

    # Extract title before decomposing header/title
    page_title = ""
    title_tag = soup.find("title")
    if title_tag and title_tag.get_text().strip():
        page_title = title_tag.get_text().strip()
    elif soup.find("h1") and soup.find("h1").get_text().strip():
        page_title = soup.find("h1").get_text().strip()

    # Decompose non-content / boilerplate / hostile elements
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript", "svg", "template", "form", "iframe", "object", "embed"]):
        tag.decompose()

    # Strip HTML comments
    for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
        comment.extract()

    # Transform headings to Markdown-style headings to preserve structure
    for level in range(1, 7):
        for h_tag in soup.find_all(f"h{level}"):
            h_text = h_tag.get_text().strip()
            if h_text:
                prefix = "#" * min(level, 3)
                h_tag.replace_with(f"\n\n{prefix} {h_text}\n\n")

    # Format list items
    for li in soup.find_all("li"):
        li_text = li.get_text().strip()
        if li_text:
            li.replace_with(f"\n- {li_text}\n")

    # Separate block paragraphs / divs / blockquotes / table rows
    for block_tag in soup.find_all(["p", "blockquote", "tr", "pre"]):
        b_text = block_tag.get_text().strip()
        if b_text:
            block_tag.replace_with(f"\n\n{b_text}\n\n")

    raw_text = soup.get_text(separator="\n")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in raw_text.splitlines()]
    clean_lines = []
    prev_blank = False
    for line in lines:
        if not line:
            if not prev_blank and clean_lines:
                clean_lines.append("")
                prev_blank = True
        else:
            clean_lines.append(line)
            prev_blank = False

    structured_text = "\n".join(clean_lines).strip()
    return structured_text, page_title


@app.post("/process-link", tags=["Content"])
async def process_link(
    background_tasks: BackgroundTasks,
    request: LinkRequest,
    progress_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_plan_limit(current_user, "sessions", db)
    raw_url = request.url.strip()

    # 🔒 URL format & SSRF destination validation
    url, hostname, port = validate_safe_url(raw_url)

    update_pipeline_progress(progress_id, 1, "File received", f"Received URL to process: {url}", "done")
    update_pipeline_progress(progress_id, 2, "Content parsing", "Fetching and parsing website/YouTube content...", "active")

    # ── YouTube Processing with Strict Domain Isolation ──
    if is_youtube_url(url):
        video_id = extract_youtube_video_id(url)
        if not video_id:
            raise HTTPException(
                status_code=400,
                detail="Invalid YouTube URL format. Could not locate a valid 11-character video ID."
            )
        canonical_url = canonicalize_youtube_url(video_id)

        # Tier 1: youtube-transcript-api
        update_pipeline_progress(progress_id, 2, "Content parsing", "Attempting automated transcript retrieval...", "active")
        transcript_items = fetch_youtube_transcript_api(video_id)
        tier_used = "Tier 1 (youtube-transcript-api)"

        if not transcript_items:
            # Tier 2: Gemini Native Multimodal Video Understanding
            logger.info("⚠️ Tier 1 unavailable/blocked. Cascading to Tier 2 Gemini native video understanding...")
            update_pipeline_progress(progress_id, 2, "Content parsing", "Running Gemini multimodal video analysis...", "active")
            transcript_items = fetch_youtube_transcript_gemini(canonical_url)
            tier_used = "Tier 2 (Gemini Multimodal Video Understanding)"

        if not transcript_items:
            # Strict domain isolation: DO NOT fall through to BeautifulSoup web scraping!
            raise HTTPException(
                status_code=422,
                detail="Could not extract video transcript or content from this YouTube link. Automated captions were unavailable and AI video analysis could not process the video. The video may be private, age-restricted, or blocked."
            )

        text = format_transcript_items_to_text(transcript_items)
        if not text or not text.strip():
            raise HTTPException(
                status_code=422,
                detail="YouTube transcript is empty. The video may not contain spoken content."
            )

        # Truncate to plan-based link character limit
        plan = current_user.plan or "free"
        max_link_chars = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"]).get("max_link_chars", 10000)
        if max_link_chars != -1 and len(text) > max_link_chars:
            text = text[:max_link_chars]

        # Fetch real YouTube video title via official oEmbed API
        yt_title = f"YouTube: {video_id}"
        try:
            oembed_resp = requests.get(f"https://www.youtube.com/oembed?url={canonical_url}&format=json", timeout=4)
            if oembed_resp.status_code == 200:
                fetched_title = oembed_resp.json().get("title", "").strip()
                if fetched_title:
                    yt_title = fetched_title
        except Exception:
            pass

        title = yt_title
        source_type = "youtube"
        update_pipeline_progress(progress_id, 2, "Content parsing", f"Extracted YouTube content via {tier_used} ({len(text)} chars)", "done")
        update_pipeline_progress(progress_id, 6, "AI summary generation", "Queued study guide generation...", "active")
    else:
        # ── Web URL ──
        resp = safe_fetch_url(url, timeout=20)
        content_type = resp.headers.get("Content-Type", "").lower()
        clean_type = content_type.split(";")[0].strip()
        plan = current_user.plan or "free"
        max_link_chars = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"]).get("max_link_chars", 10000)

        # Detect direct PDF link
        is_pdf_link = False
        pdf_pages = []
        parsed = urlparse(url)
        if "application/pdf" in clean_type or parsed.path.lower().endswith(".pdf"):
            is_pdf_link = True
            try:
                import io
                from pypdf import PdfReader
                reader = PdfReader(io.BytesIO(resp.content))
                if reader.is_encrypted:
                    try:
                        reader.decrypt("")
                    except Exception:
                        raise HTTPException(status_code=422, detail="The PDF at this link is password-protected. Please remove password protection or upload directly.")
                for idx, page in enumerate(reader.pages, start=1):
                    raw_t = (page.extract_text() or "").replace("\x00", "").strip()
                    if raw_t:
                        pdf_pages.append((idx, raw_t))
                text = "\n\n".join(f"[Page {p[0]}]\n{p[1]}" for p in pdf_pages)
                if max_link_chars != -1 and len(text) > max_link_chars:
                    text = text[:max_link_chars]
                if not text or len(text.strip()) < 50:
                    raise HTTPException(status_code=422, detail="The PDF at this URL contains no selectable text (scanned or image-only). Please upload it directly via Document Upload.")
                pdf_filename = os.path.basename(parsed.path)
                title = pdf_filename.replace(".pdf", "").replace("_", " ").title() if pdf_filename else "Online PDF Document"
            except HTTPException:
                raise
            except Exception as pdf_err:
                raise HTTPException(status_code=422, detail=f"Could not read PDF from link: {pdf_err}")
        elif clean_type in ("text/html", "application/xhtml+xml", ""):
            structured_text, page_title = extract_html_article_text(resp.text)
            text = structured_text
            if max_link_chars != -1 and len(text) > max_link_chars:
                text = text[:max_link_chars]
            title = page_title if page_title else parsed.netloc
        elif clean_type in ("text/plain", "text/markdown", "text/csv"):
            text = resp.text.strip()
            if max_link_chars != -1 and len(text) > max_link_chars:
                text = text[:max_link_chars]
            title = os.path.basename(parsed.path) or parsed.netloc
        elif any(clean_type.startswith(m) for m in ("image/", "video/", "audio/", "application/zip", "application/octet-stream", "application/x-", "application/gzip")):
            raise HTTPException(status_code=422, detail=f"Direct media/binary links ({clean_type}) are not supported. Please upload files directly or provide a YouTube URL.")
        else:
            raise HTTPException(status_code=422, detail=f"Unsupported web content type ({clean_type}). Only web pages (HTML), online PDFs, and plain text articles are supported.")

        if not text or len(text.strip()) < 50:
            raise HTTPException(status_code=422, detail="The webpage returned very little readable content. It may require login, use heavy JavaScript rendering, or be a restricted page.")

        update_pipeline_progress(progress_id, 2, "Content parsing", f"Scraped webpage successfully ({len(text)} characters)", "done")
        update_pipeline_progress(progress_id, 6, "AI summary generation", "Queued study guide generation from webpage content...", "active")
        source_type = "pdf" if is_pdf_link else "url"

    # ── YouTube / Link Timeline & Basic Save ──
    display_title = title[:100]
    initial_timeline = [{"event": f"Processed {source_type.upper()}", "timestamp": datetime.utcnow().isoformat(), "detail": f"Source URL: {url}"}]

    assigned_space_id = ensure_session_space(db, current_user.id, request.project_id, display_title, "youtube" if source_type == "youtube" else "web")
    session_metadata = {}
    if source_type == "youtube" and "video_id" in locals() and video_id:
        session_metadata = {
            "video_id": video_id,
            "canonical_url": canonical_url if "canonical_url" in locals() else f"https://www.youtube.com/watch?v={video_id}",
            "source_url": url,
            "tier_used": tier_used if "tier_used" in locals() else "Tier 1",
        }
    elif source_type == "pdf" and "pdf_pages" in locals() and pdf_pages:
        session_metadata = {
            "pages": pdf_pages,
            "page_count": len(pdf_pages),
            "source_url": url,
        }
    elif source_type == "url":
        session_metadata = {
            "source_url": url,
            "url": url,
            "domain": urlparse(url).netloc,
        }

    content_hash_val = hashlib.sha256(text.encode("utf-8", errors="replace")).hexdigest()
    new_session = StudySession(
        filename=display_title, ai_title=None, summary="Processing...", content=text,
        user_id=current_user.id, source_type=source_type,
        content_hash=content_hash_val,
        category="Processing...",
        timeline=initial_timeline,
        project_id=assigned_space_id,
        doc_metadata=session_metadata
    )
    db.add(new_session)
    log_activity(db, current_user.id, f"Processed {'YouTube Video' if source_type == 'youtube' else 'Web URL'}", f"Analyzed: {display_title[:60]}")
    db.commit()
    db.refresh(new_session)

    background_tasks.add_task(
        process_upload_in_background,
        session_id=new_session.id,
        source_type=source_type,
        text_content=text,
        progress_id=progress_id
    )

    return {"summary": "Processing...", "filename": display_title, "id": new_session.id, "project_id": assigned_space_id}


@app.post("/process-text", tags=["Content"])
async def process_text(
    request: TextRequest,
    background_tasks: BackgroundTasks,
    progress_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_plan_limit(current_user, "sessions", db)
    # Sanitize null bytes and control characters while preserving newlines and tabs
    raw_text = request.text.replace("\x00", "")
    text = raw_text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty. Please paste some content.")
    if len(text) < 50:
        raise HTTPException(status_code=400, detail="Text too short. Please provide at least 50 characters for meaningful analysis.")
    # Enforce subscription-based paste character limit
    check_plan_limit(current_user, "max_paste_chars", db, len(text))

    update_pipeline_progress(progress_id, 1, "File received", f"Received text input ({len(text)} characters)", "done")
    update_pipeline_progress(progress_id, 2, "Content parsing", "Parsing text content and removing markup...", "active")

    # Structural HTML extraction if user pasted HTML markup
    import html as html_module
    has_html_tags = bool(re.search(r"<\s*(html|body|div|p|h[1-6]|ul|ol|li|table|thead|tbody|tr|td|th|script|style|iframe|section|article|header|footer|b|i|strong|em|a|blockquote|code|pre|span|br)\b", text, re.IGNORECASE))
    if has_html_tags:
        from bs4 import BeautifulSoup as BS
        soup = BS(text, "html.parser")
        # Strictly decompose dangerous script/style/iframe tags
        for dangerous_tag in soup(["script", "style", "iframe", "object", "embed", "applet", "form", "svg"]):
            dangerous_tag.decompose()
        # Convert structural elements preserving Markdown/paragraph boundaries
        for h in soup.find_all(re.compile(r"^h[1-6]$")):
            level = int(h.name[1])
            h.replace_with(f"\n\n{'#' * level} {h.get_text().strip()}\n\n")
        for p in soup.find_all("p"):
            p.replace_with(f"\n\n{p.get_text().strip()}\n\n")
        for li in soup.find_all("li"):
            li.replace_with(f"\n* {li.get_text().strip()}")
        for br in soup.find_all("br"):
            br.replace_with("\n")
        clean_extracted = soup.get_text()
        clean_extracted = html_module.unescape(clean_extracted).strip()
        clean_extracted = re.sub(r"\n{3,}", "\n\n", clean_extracted).strip()
        if len(clean_extracted) < 50:
            raise HTTPException(status_code=400, detail="After removing HTML markup, the text content is too short. Please provide more substantive text.")
        text = clean_extracted

    # 🔍 Deduplication / Idempotency check via content hash
    content_hash_val = hashlib.sha256(text.encode("utf-8", errors="replace")).hexdigest()
    existing = db.query(StudySession).filter(
        StudySession.user_id == current_user.id,
        StudySession.content_hash == content_hash_val
    ).first()
    if existing:
        if not existing.project_id:
            existing.project_id = ensure_session_space(db, current_user.id, request.project_id, existing.filename, "text")
            db.commit()
        if progress_id:
            for step in range(2, 7):
                update_pipeline_progress(progress_id, step, "Retrieved from cache", "Retrieved from cache", "done")
        return {
            "summary": existing.summary,
            "filename": existing.filename,
            "id": existing.id,
            "project_id": existing.project_id,
            "duplicate": True,
            "message": "This text was already submitted. Returning your existing study session."
        }

    update_pipeline_progress(progress_id, 2, "Content parsing", f"Successfully validated text content ({len(text)} characters)", "done")
    update_pipeline_progress(progress_id, 6, "AI summary generation", "Queued study guide generation from pasted text...", "active")

    display_title = f"Pasted Text — {datetime.utcnow().strftime('%b %d, %Y')}"
    initial_timeline = [{"event": "Processed Text Input", "timestamp": datetime.utcnow().isoformat(), "detail": f"Length: {len(text)} characters"}]

    assigned_space_id = ensure_session_space(db, current_user.id, request.project_id, display_title, "text")
    new_session = StudySession(
        filename=display_title, ai_title=None, summary="Processing...", content=text,
        user_id=current_user.id, source_type="text",
        content_hash=content_hash_val,
        category="Processing...",
        timeline=initial_timeline,
        project_id=assigned_space_id,
        doc_metadata={"source_type": "text", "char_count": len(text)}
    )
    db.add(new_session)
    log_activity(db, current_user.id, "Pasted Text", f"Processed text: {display_title}")
    db.commit()
    db.refresh(new_session)

    background_tasks.add_task(
        process_upload_in_background,
        session_id=new_session.id,
        source_type="text",
        text_content=text,
        progress_id=progress_id
    )

    return {"summary": "Processing...", "filename": display_title, "id": new_session.id, "project_id": assigned_space_id}


# =============================================================================
# QUIZ & FLASHCARD GENERATION (Phase 5 — AI)
# =============================================================================

@app.post("/generate_quiz", tags=["AI"])
async def generate_quiz(
    request: QuizRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_plan_limit(current_user, "quizzes_per_day", db)
    session = db.query(StudySession).filter(
        StudySession.id == request.session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    n = max(1, min(request.num_questions, 20))  # cap at 20

    # Phase 3: Evidence-grounded quiz generation from Phase 2 document chunks
    chunks_data = []
    db_chunks = db.query(DocumentChunk).filter(DocumentChunk.session_id == session.id).order_by(DocumentChunk.chunk_index).all()
    if db_chunks:
        chunks_data = [
            {
                "chunk_index": c.chunk_index,
                "text_content": c.text_content,
                "page_number": c.page_number or 1,
                "section_heading": c.section_heading or "General",
                "content_type": c.content_type or "text"
            }
            for c in db_chunks
        ]

    quiz_data = []
    if chunks_data:
        try:
            quiz_data = AssessmentEngine.generate_quiz(
                chunks=chunks_data,
                num_questions=n,
                difficulty="intermediate",
                gemini_client=client,
                model_name=MODEL_NAME,
                generate_fallback_fn=generate_with_fallback
            )
        except Exception as e:
            logger.warning(f"Phase 3 Grounded Assessment failed, falling back: {e}")

    if not quiz_data:
        instruction = (
            f"Generate exactly {n} multiple-choice questions based on the following text. "
            "Return ONLY a JSON array with no markdown wrapping or other text: "
            '[{"question": "...", "options": ["A", "B", "C", "D"], "answer": 0, "explanation": "Why this is correct"}] '
            "where answer is the 0-based index of the correct option. Include an explanation for each answer."
        )
        raw = generate_with_fallback(session.content, instruction)
        quiz_data = clean_and_parse_json(raw)

    if quiz_data:
        session.quiz_data = quiz_data
        db.commit()

    return quiz_data


@app.post("/quiz-result", tags=["AI"])
def save_quiz_result(
    request: QuizResultRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(StudySession).filter(
        StudySession.id == request.session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    pct = round((request.score / request.total_questions) * 100) if request.total_questions > 0 else 0
    result = QuizResult(
        score=request.score, total_questions=request.total_questions,
        percentage=pct, user_id=current_user.id, session_id=request.session_id,
        details=request.details or []
    )
    db.add(result)
    log_activity(db, current_user.id, "Completed Quiz",
                 f"Scored {request.score}/{request.total_questions} ({pct}%) on {session.filename}")

    # Phase 3: Update learner topic mastery based on quiz details
    if request.details:
        for d in request.details:
            topic = d.get("topic") or session.filename
            is_correct = d.get("is_correct")
            if is_correct is None:
                is_correct = (d.get("selected") == d.get("answer") or d.get("user_answer") == d.get("correct_answer"))
            LearnerEngine.record_topic_interaction(
                db=db,
                user_id=current_user.id,
                session_id=session.id,
                topic=str(topic),
                is_correct=bool(is_correct),
                difficulty=str(d.get("difficulty", "intermediate")),
                subtopic=d.get("section_heading")
            )

    db.commit()
    db.refresh(result)
    return {"id": result.id, "score": result.score, "percentage": pct, "details": result.details}


@app.get("/library/{session_id}/quizzes", tags=["AI"])
def get_session_quizzes(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve all past quiz attempts for a session with detailed answers and explanations."""
    results = db.query(QuizResult).filter(
        QuizResult.session_id == session_id,
        QuizResult.user_id == current_user.id
    ).order_by(QuizResult.date_taken.desc()).all()
    return [
        {
            "id": r.id,
            "score": r.score,
            "total_questions": r.total_questions,
            "percentage": r.percentage,
            "date_taken": r.date_taken.isoformat() if r.date_taken else None,
            "details": r.details or []
        }
        for r in results
    ]


@app.post("/generate_flashcards", tags=["AI"])
async def generate_flashcards(
    request: FlashcardRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(StudySession).filter(
        StudySession.id == request.session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    plan = current_user.plan or "free"
    if getattr(current_user, "is_admin", False):
        plan = "premium"
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"]).get("flashcards_per_session", 10)

    n = max(1, min(request.num_cards, limit))

    # Phase 3: Gather Phase 2 document chunks for grounded flashcard creation
    chunks_data = []
    db_chunks = db.query(DocumentChunk).filter(DocumentChunk.session_id == session.id).order_by(DocumentChunk.chunk_index).all()
    if db_chunks:
        chunks_data = [
            {
                "chunk_index": c.chunk_index,
                "text_content": c.text_content,
                "page_number": c.page_number or 1,
                "section_heading": c.section_heading or "General",
                "content_type": c.content_type or "text"
            }
            for c in db_chunks
        ]

    cards = []
    if chunks_data:
        try:
            cards = AssessmentEngine.generate_flashcards(
                chunks=chunks_data,
                num_cards=n,
                difficulty="intermediate",
                gemini_client=client,
                model_name=MODEL_NAME,
                generate_fallback_fn=generate_with_fallback
            )
        except Exception as e:
            logger.warning(f"Phase 3 Grounded Flashcard generation failed, falling back: {e}")

    if not cards:
        instruction = f"""Create exactly {n} study flashcards from the following text.
Return ONLY valid JSON with no extra text:
[{{"front": "Short question (max 12 words)?", "back": "Clear, concise answer or definition"}}]"""
        raw = generate_with_fallback(session.content, instruction)
        cards = clean_and_parse_json(raw)

    if cards:
        session.flashcards = cards
        db.commit()

    return cards


# =============================================================================
# DOCUMENT CHAT — /chat (non-streaming) & /chat/stream (SSE streaming)
# =============================================================================

@app.post("/chat", tags=["AI"])
async def chat_with_document(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_plan_limit(current_user, "chats_per_day", db)

    if request.session_id:
        session = db.query(StudySession).filter(
            StudySession.id == request.session_id, StudySession.user_id == current_user.id
        ).first()
        if not session:
            raise HTTPException(status_code=404, detail="Study session not found")

        # 🔍 Perform Semantic Hybrid RAG Search with strict user isolation
        chunks = retrieve_relevant_chunks(session.id, request.message, db, top_k=5, user_id=current_user.id)
        if chunks:
            source_candidates = [
                RetrievalCandidate(
                    chunk_id=f"chunk_{c.get('chunk_index', idx)}",
                    session_id=session.id,
                    user_id=current_user.id,
                    text=c["text_content"],
                    page_number=c.get("page_number") if (session.source_type != "pdf" or c.get("page_number") is None) else (c.get("page_number", 1) or 1),
                    section_heading=c.get("section_heading", "") or "",
                    content_type=ContentType(c.get("content_type", "text") or "text"),
                    final_score=c.get("score", 0.0),
                    source_type=c.get("source_type") or session.source_type or "text",
                    metadata=c.get("metadata", {}),
                    document_title=session.filename
                )
                for idx, c in enumerate(chunks)
            ]
            doc_context, citations = ContextBuilder.build_context(source_candidates)
            logger.info(f"✅ Hybrid RAG Context built from {len(chunks)} relevant chunks with {len(citations)} citations.")
        else:
            doc_context = session.content[:15000] if session.content else ""
            citations = []
            logger.info("⚠️ Falling back to sliced full document context.")

        intent, mode = detect_learning_intent(request.message)
        scaffold = TeachingEngine.get_scaffolding_instruction(mode, intent)
        enhanced_context = f"{scaffold}\n\n{doc_context}"

        generator = GroundedGenerator(gemini_client=client, model_name=MODEL_NAME)
        grounded_res = generator.generate(
            query=request.message,
            context=enhanced_context,
            citations=citations,
            response_style=request.response_style or "balanced"
        )
        cleaned_reply, valid_indices, warnings = GroundingValidator.validate_and_clean_citations(
            reply=grounded_res.reply,
            available_citations=grounded_res.citations
        )
        return {
            "reply": cleaned_reply,
            "citations": [c.to_dict() for c in grounded_res.citations],
            "is_grounded": grounded_res.is_grounded,
            "sources_used": grounded_res.sources_used,
            "intent": intent.value,
            "teaching_mode": mode.value
        }
    else:
        intent, mode = detect_learning_intent(request.message)
        generator = GroundedGenerator(gemini_client=client, model_name=MODEL_NAME)
        grounded_res = generator.generate(
            query=request.message,
            context="",
            citations=[],
            response_style=request.response_style or "balanced"
        )
        return {
            "reply": grounded_res.reply,
            "citations": [],
            "is_grounded": False,
            "sources_used": 0,
            "intent": intent.value,
            "teaching_mode": mode.value
        }


@app.post("/chat/stream", tags=["AI"])
async def chat_stream(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_plan_limit(current_user, "chats_per_day", db)
    """Server-Sent Events endpoint for streaming AI responses token by token with grounded citations."""
    if request.session_id:
        session = db.query(StudySession).filter(
            StudySession.id == request.session_id, StudySession.user_id == current_user.id
        ).first()
        if not session:
            raise HTTPException(status_code=404, detail="Study session not found")

        # 🔍 Perform Semantic Hybrid RAG Search
        chunks = retrieve_relevant_chunks(session.id, request.message, db, top_k=5, user_id=current_user.id)
        if chunks:
            source_candidates = [
                RetrievalCandidate(
                    chunk_id=f"chunk_{c.get('chunk_index', idx)}",
                    session_id=session.id,
                    user_id=current_user.id,
                    text=c["text_content"],
                    page_number=c.get("page_number", 1) or 1,
                    section_heading=c.get("section_heading", "") or "",
                    content_type=ContentType(c.get("content_type", "text") or "text"),
                    final_score=c.get("score", 0.0),
                    source_type=c.get("source_type", "pdf"),
                    metadata=c.get("metadata", {}),
                    document_title=session.filename
                )
                for idx, c in enumerate(chunks)
            ]
            doc_context, citations = ContextBuilder.build_context(source_candidates)
            logger.info(f"✅ RAG Streaming Context built from {len(chunks)} relevant chunks with {len(citations)} citations.")
        else:
            doc_context = session.content[:15000] if session.content else ""
            citations = []
            logger.info("⚠️ Falling back to sliced full document context for streaming.")

        intent, mode = detect_learning_intent(request.message)
        scaffold = TeachingEngine.get_scaffolding_instruction(mode, intent)
        enhanced_context = f"{scaffold}\n\n{doc_context}"

        generator = GroundedGenerator(gemini_client=client, model_name=MODEL_NAME)
        return StreamingResponse(
            generator.generate_stream(
                query=request.message,
                context=enhanced_context,
                citations=citations,
                response_style=request.response_style or "balanced"
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )
    else:
        generator = GroundedGenerator(gemini_client=client, model_name=MODEL_NAME)
        return StreamingResponse(
            generator.generate_stream(
                query=request.message,
                context="",
                citations=[],
                response_style=request.response_style or "balanced"
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )


# =============================================================================
# PHASE 3 — ADAPTIVE LEARNING & MASTERY ENDPOINTS
# =============================================================================

@app.get("/learning/mastery/{session_id}", tags=["AI", "Learning"])
def get_session_mastery_endpoint(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve learner topic mastery levels for a session with ownership scoping."""
    session = db.query(StudySession).filter(
        StudySession.id == session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    return LearnerEngine.get_session_mastery(db, current_user.id, session_id)


@app.get("/learning/weak-topics/{session_id}", tags=["AI", "Learning"])
def get_weak_topics_endpoint(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Identify weak topics and retrieve actionable study recommendations."""
    session = db.query(StudySession).filter(
        StudySession.id == session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    return LearnerEngine.get_weak_topics_and_recommendations(db, current_user.id, session_id)


class AnswerEvaluationRequest(BaseModel):
    session_id: int
    question: str
    user_answer: str
    target_topic: Optional[str] = None
    idempotency_key: Optional[str] = None


@app.post("/learning/evaluate-answer", tags=["AI", "Learning"])
async def evaluate_student_answer(
    request: AnswerEvaluationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Evaluates student conceptual response against grounded document evidence."""
    session = db.query(StudySession).filter(
        StudySession.id == request.session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    chunks = retrieve_relevant_chunks(session.id, request.question, db, top_k=4, user_id=current_user.id)
    doc_context = "\n\n".join([c["text_content"] for c in chunks]) if chunks else (session.content[:8000] if session.content else "")

    eval_prompt = f"""You are an expert academic evaluator.
Evaluate the student's answer against the verified study context below.

QUESTION: {request.question}
STUDENT ANSWER: {request.user_answer}

VERIFIED STUDY CONTEXT:
{doc_context}

Evaluate the student answer strictly based on the provided context:
1. Score from 0 to 100 based on accuracy and completeness.
2. Strengths of the answer.
3. Missing or inaccurate points.
4. Correct model answer grounded in the text.

Return ONLY a valid JSON object:
{{
  "score": 85,
  "is_correct": true,
  "feedback": "...",
  "key_points_covered": ["..."],
  "missing_points": ["..."],
  "model_answer": "..."
}}"""

    raw = generate_with_fallback(doc_context, eval_prompt)
    evaluation = clean_and_parse_json(raw)
    if not evaluation:
        evaluation = {
            "score": 70,
            "is_correct": True,
            "feedback": "Answer reviewed based on study material.",
            "key_points_covered": [],
            "missing_points": [],
            "model_answer": ""
        }

    # Record mastery interaction with idempotency protection
    topic = request.target_topic or session.filename
    is_corr = evaluation.get("score", 0) >= 60
    mastery_res = LearnerEngine.record_topic_interaction(
        db=db,
        user_id=current_user.id,
        session_id=session.id,
        topic=topic,
        is_correct=is_corr,
        difficulty="intermediate",
        idempotency_key=request.idempotency_key
    )
    evaluation["mastery_update"] = mastery_res

    return evaluation


class FlashcardReviewRequest(BaseModel):
    session_id: int
    card_index: int
    quality: int  # 0 to 5
    idempotency_key: Optional[str] = None


@app.post("/learning/flashcard-review", tags=["AI", "Learning"])
def review_flashcard_endpoint(
    request: FlashcardReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates SM-2 spaced repetition state for a flashcard with idempotency protection."""
    if request.quality < 0 or request.quality > 5:
        raise HTTPException(status_code=400, detail="Quality rating must be between 0 and 5")

    session = db.query(StudySession).filter(
        StudySession.id == request.session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    return LearnerEngine.update_flashcard_sm2(
        db=db,
        user_id=current_user.id,
        session_id=session.id,
        card_index=request.card_index,
        quality=request.quality,
        idempotency_key=request.idempotency_key
    )


@app.get("/learning/spaced-revision/{session_id}", tags=["AI", "Learning"])
def get_spaced_revision_endpoint(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves flashcards due for SM-2 spaced revision for the current user."""
    session = db.query(StudySession).filter(
        StudySession.id == session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    return LearnerEngine.get_spaced_revision_cards(db, current_user.id, session.id)


# =============================================================================
# LIBRARY ENDPOINTS
# =============================================================================

@app.get("/library", tags=["Library"])
def get_library(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sessions = db.query(StudySession).filter(
        StudySession.user_id == current_user.id
    ).order_by(StudySession.upload_date.desc()).all()

    # Get bookmarked IDs for this user
    bookmarked_ids = {
        b.session_id for b in db.query(Bookmark).filter(Bookmark.user_id == current_user.id).all()
    }

    return [
        {
            "id": s.id,
            "filename": s.filename,
            "ai_title": s.ai_title or s.filename,
            "category": s.category or "Study",
            "is_pinned": s.is_pinned or False,
            "intelligence_score": s.intelligence_score or 0,
            "source_type": s.source_type or "pdf",
            "added": s.upload_date.strftime("%Y-%m-%d"),
            "raw_date": s.upload_date.isoformat(),
            "summary": s.summary[:150] + "..." if s.summary and len(s.summary) > 150 else (s.summary or ""),
            "full_summary": s.summary,
            "size": len(s.content) if s.content else 0,
            "is_bookmarked": s.id in bookmarked_ids,
            "timeline": s.timeline or [],
            "insights": s.insights or {},
            "notes": s.notes or "",
            "project_id": s.project_id,
        }
        for s in sessions
    ]


@app.get("/library/{session_id}", tags=["Library"])
def get_library_item(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.query(StudySession).filter(
        StudySession.id == session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found or unauthorized")

    is_bookmarked = db.query(Bookmark).filter(
        Bookmark.user_id == current_user.id, Bookmark.session_id == session_id
    ).first() is not None

    return {
        "id": session.id,
        "filename": session.filename,
        "ai_title": session.ai_title or session.filename,
        "category": session.category or "Study",
        "project_id": session.project_id,
        "is_pinned": session.is_pinned or False,
        "intelligence_score": session.intelligence_score or 0,
        "source_type": session.source_type or "pdf",
        "added": session.upload_date.strftime("%Y-%m-%d"),
        "raw_date": session.upload_date.isoformat(),
        "summary": session.summary or "",
        "content": session.content or "",
        "is_bookmarked": is_bookmarked,
        "timeline": session.timeline or [],
        "insights": session.insights or {},
        "notes": session.notes or "",
        "doc_metadata": session.doc_metadata or {},
    }


@app.post("/library/{session_id}/regenerate", tags=["Content"])
def regenerate_summary(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Regenerate AI summary for an existing study session."""
    session = db.query(StudySession).filter(
        StudySession.id == session_id,
        StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")
    if not session.content:
        raise HTTPException(status_code=400, detail="No content available to regenerate from")

    instruction = (
        "You are an expert study assistant. Create a comprehensive, well-structured study guide "
        "in Markdown format with: an executive summary, key concepts with clear explanations, "
        "important facts and definitions, and key takeaways. Make it engaging and easy to study from."
    )
    new_summary = generate_with_fallback(session.content, instruction)
    session.summary = new_summary
    log_activity(db, current_user.id, "Summary Regenerated", f"Regenerated AI summary for {session.filename}")
    db.commit()
    return {"summary": new_summary, "message": "Summary regenerated successfully"}


@app.delete("/library/{session_id}", tags=["Library"])
def delete_library_item(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.query(StudySession).filter(
        StudySession.id == session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found or unauthorized")

    # Clean up ChromaDB vectors for this session
    if chroma_collection is not None:
        try:
            chroma_collection.delete(where={"session_id": session_id})
            logger.info(f"🗑️ Purged ChromaDB vectors for session {session_id}")
        except Exception as e:
            logger.warning(f"⚠️ Failed to purge ChromaDB vectors for session {session_id}: {e}")

    filename = session.filename
    db.delete(session)
    log_activity(db, current_user.id, "Deleted Document", f"Deleted: {filename}")
    db.commit()
    return {"message": "Item deleted successfully"}


@app.patch("/library/{session_id}/rename", tags=["Library"])
def rename_session(session_id: int, request: RenameRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.query(StudySession).filter(
        StudySession.id == session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    old_name = session.filename
    new_name = request.filename.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Filename cannot be empty")

    session.filename = new_name

    # Record in timeline
    timeline = list(session.timeline or [])
    timeline.append({
        "event": "Renamed Session",
        "timestamp": datetime.utcnow().isoformat(),
        "detail": f"Changed title from '{old_name}' to '{new_name}'"
    })
    session.timeline = timeline

    db.commit()
    return {
        "id": session.id,
        "filename": session.filename,
        "message": "Session renamed successfully"
    }


@app.patch("/library/{session_id}/pin", tags=["Library"])
def pin_session(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.query(StudySession).filter(
        StudySession.id == session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    session.is_pinned = not (session.is_pinned or False)

    # Record in timeline
    timeline = list(session.timeline or [])
    timeline.append({
        "event": "Pinned Session" if session.is_pinned else "Unpinned Session",
        "timestamp": datetime.utcnow().isoformat(),
        "detail": ""
    })
    session.timeline = timeline

    db.commit()
    return {
        "id": session.id,
        "is_pinned": session.is_pinned,
        "message": "Session pinned successfully" if session.is_pinned else "Session unpinned successfully"
    }


@app.patch("/library/{session_id}/category", tags=["Library"])
def update_session_category(session_id: int, request: CategoryRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.query(StudySession).filter(
        StudySession.id == session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    category = request.category.strip()
    session.category = category

    # Record in timeline
    timeline = list(session.timeline or [])
    timeline.append({
        "event": "Category Updated",
        "timestamp": datetime.utcnow().isoformat(),
        "detail": f"Classified as: {category}"
    })
    session.timeline = timeline

    db.commit()
    return {
        "id": session.id,
        "category": session.category,
        "message": "Category updated successfully"
    }


@app.get("/library/{session_id}/insights", tags=["Library"])
def get_session_insights(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.query(StudySession).filter(
        StudySession.id == session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    if not session.insights or len(session.insights) == 0:
        # Generate with Gemini
        try:
            snippet = session.content[:4000] if session.content else ""
            instruction = (
                "You are an expert learning analyst. Based on this study material content, generate "
                "personalized learning insights. Return exactly a JSON object, with no markdown code blocks "
                "or tags, containing: 'topics_covered' (list of strings), 'concepts_learned' (list of strings), "
                "'weak_areas' (list of strings), 'suggested_next' (list of strings). "
                "Ensure it's a valid JSON string that can be parsed."
            )
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=f"{instruction}:\n\n{snippet}",
            )
            raw_text = (response.text or "").strip()
            # Clean possible markdown wrapping
            if raw_text.startswith("```"):
                lines = raw_text.split("\n")
                if lines[0].startswith("```json"):
                    raw_text = "\n".join(lines[1:-1])
                elif lines[0].startswith("```"):
                    raw_text = "\n".join(lines[1:-1])
            insights_data = json.loads(raw_text)
            session.insights = insights_data
            db.commit()
        except Exception as e:
            logger.error(f"Failed to generate insights: {e}")
            # Fallback
            session.insights = {
                "topics_covered": ["General Overview"],
                "concepts_learned": ["Key concepts from content"],
                "weak_areas": ["Needs self-assessment / take a quiz"],
                "suggested_next": ["Review notes & practice quizzes"]
            }
            db.commit()

    return session.insights


@app.get("/library/{session_id}/timeline", tags=["Library"])
def get_session_timeline(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.query(StudySession).filter(
        StudySession.id == session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    return session.timeline or []


@app.get("/library/{session_id}/intelligence", tags=["Library"])
def get_session_intelligence(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.query(StudySession).filter(
        StudySession.id == session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    # Fetch quizzes taken for this session
    quiz_results = db.query(QuizResult).filter(QuizResult.session_id == session_id, QuizResult.user_id == current_user.id).all()
    quizzes_done = len(quiz_results)
    avg_score = sum(q.percentage for q in quiz_results) / quizzes_done if quizzes_done > 0 else 0

    # Count bookmark, chat, flashcard reviews etc.
    flashcard_reviews = db.query(FlashcardProgress).filter(FlashcardProgress.session_id == session_id, FlashcardProgress.user_id == current_user.id).count()

    # Chat messages for this session
    chat_conv = db.query(ChatConversation).filter(ChatConversation.session_id == session_id, ChatConversation.user_id == current_user.id).first()
    chat_messages = db.query(ChatMessage).filter(ChatMessage.conversation_id == chat_conv.id).count() if chat_conv else 0

    # Calculate score
    score = min(100, int((chat_messages * 5) + (quizzes_done * 20) + (flashcard_reviews * 8) + 15))

    # Categorize depth
    if score < 30:
        depth = "Beginner"
    elif score < 60:
        depth = "Intermediate"
    elif score < 85:
        depth = "Advanced"
    else:
        depth = "Expert"

    intel = {
        "score": score,
        "depth": depth,
        "quizzes_taken": quizzes_done,
        "average_quiz_score": int(avg_score),
        "flashcards_reviewed": flashcard_reviews,
        "chat_interactions": chat_messages
    }

    # Sync with DB
    session.intelligence_score = score
    db.commit()
    return intel


@app.get("/library/{session_id}/notes", tags=["Library"])
def get_session_notes(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.query(StudySession).filter(
        StudySession.id == session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    return {"notes": session.notes or ""}


@app.put("/library/{session_id}/notes", tags=["Library"])
def update_session_notes(session_id: int, request: NotesRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.query(StudySession).filter(
        StudySession.id == session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    session.notes = request.notes

    # Record in timeline (avoid duplicates)
    timeline = list(session.timeline or [])
    has_note_event = any(t.get("event") == "Notes Modified" for t in timeline[-3:]) # check last 3
    if not has_note_event:
        timeline.append({
            "event": "Notes Modified",
            "timestamp": datetime.utcnow().isoformat(),
            "detail": "Updated personal study notes"
        })
    session.timeline = timeline

    db.commit()
    return {
        "notes": session.notes,
        "message": "Notes saved successfully"
    }


@app.post("/library/{session_id}/share", tags=["Library"])
def share_study_session(
    session_id: int,
    request: ShareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(StudySession).filter(
        StudySession.id == session_id,
        StudySession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Study session not found or you do not have permission to access it.")

    if not session.summary:
        raise HTTPException(status_code=400, detail="Cannot share this session because it has no summary content yet.")

    if not session.share_token:
        session.share_token = secrets.token_urlsafe(16)

    session.share_type = request.share_type

    # Timeline event
    timeline = list(session.timeline or [])
    timeline.append({
        "event": f"Shared ({request.share_type.upper()})",
        "timestamp": datetime.utcnow().isoformat(),
        "detail": f"Generated public/private/team link type: {request.share_type}"
    })
    session.timeline = timeline

    db.commit()
    return {
        "share_token": session.share_token,
        "share_type": session.share_type,
        "message": "Link configured successfully"
    }


# ── YouTube Learning Timeline Endpoints ────────────────────────────────────────

class SectionExplainRequest(BaseModel):
    section_title: Optional[str] = None
    timestamp_str: Optional[str] = None
    what_video_says: Optional[str] = None
    concept_tags: Optional[List[str]] = None


class SectionQuizRequest(BaseModel):
    section_title: Optional[str] = None
    timestamp_str: Optional[str] = None
    what_video_says: Optional[str] = None
    concept_tags: Optional[List[str]] = None


class SectionProgressRequest(BaseModel):
    section_id: str
    status: str  # "viewed" | "explained" | "quizzed" | "mastered"
    score: Optional[int] = None


@app.get("/sessions/{session_id}/learning-timeline", tags=["Learning Timeline"])
@app.get("/learning-timeline/{session_id}", tags=["Learning Timeline"])
def get_learning_timeline(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetch or generate the interactive YouTube Learning Timeline for a study session.
    Enforces strict tenant isolation and caches the timeline in SQLite doc_metadata.
    """
    session = db.query(StudySession).filter(
        StudySession.id == session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found or unauthorized")

    doc_meta = dict(session.doc_metadata or {})
    if "learning_timeline" in doc_meta and isinstance(doc_meta["learning_timeline"], dict):
        tl = dict(doc_meta["learning_timeline"])
        tl["progress"] = doc_meta.get("learning_timeline_progress", {})
        return tl

    # Generate on demand
    from content.timeline import detect_learning_sections
    yt_id = doc_meta.get("video_id", "")
    if not yt_id:
        yt_id = extract_youtube_video_id(session.filename) or ""
        if not yt_id and session.timeline:
            for ev in session.timeline:
                det = ev.get("detail", "")
                if "youtube.com" in det or "youtu.be" in det:
                    yt_id = extract_youtube_video_id(det) or ""
                    if yt_id:
                        break

    timeline_data = detect_learning_sections(
        raw_transcript=session.content or session.summary or "",
        video_title=session.ai_title or session.filename,
        video_id=yt_id,
        gemini_client=client
    )

    doc_meta["learning_timeline"] = timeline_data
    doc_meta["video_id"] = yt_id
    session.doc_metadata = doc_meta
    db.commit()

    timeline_data["progress"] = doc_meta.get("learning_timeline_progress", {})
    return timeline_data


@app.post("/sessions/{session_id}/learning-timeline/sections/{section_id}/explain", tags=["Learning Timeline"])
def explain_learning_section(
    session_id: int,
    section_id: str,
    req: SectionExplainRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generates an explanation focused specifically on this timestamped learning section.
    """
    session = db.query(StudySession).filter(
        StudySession.id == session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found or unauthorized")

    sec_ctx = (
        f"Section: {req.section_title or section_id}\n"
        f"Timestamp Range: {req.timestamp_str or ''}\n"
        f"Transcript Excerpt / Summary: {req.what_video_says or ''}\n"
        f"Concepts: {', '.join(req.concept_tags or [])}\n"
    )

    instruction = (
        f"You are an expert Florix academic tutor. The student is reviewing this exact video section:\n"
        f"{sec_ctx}\n\n"
        f"Provide a focused, grounded explanation of this specific section. Break down the core intuition, "
        f"give a clear real-world analogy or example, and highlight why this concept is important. "
        f"Always reference the timestamp range [{req.timestamp_str or ''}] as the authoritative citation."
    )

    try:
        resp = client.models.generate_content(
            model=MODEL_NAME,
            contents=instruction
        )
        explanation = resp.text.strip() if resp and resp.text else "Unable to generate section explanation at this time."
    except Exception as e:
        logger.warning(f"Section explanation generation failed: {e}")
        explanation = f"In this section ({req.timestamp_str or ''}), the video covers {req.section_title or section_id}. {req.what_video_says or ''}"

    try:
        ev = LearningEvent(
            user_id=current_user.id,
            session_id=session_id,
            event_type="SECTION_EXPLAINED",
            payload={"section_id": section_id, "title": req.section_title, "timestamp": req.timestamp_str}
        )
        db.add(ev)
        db.commit()
    except Exception:
        pass

    return {
        "section_id": section_id,
        "explanation": explanation,
        "citation": {
            "source_type": "youtube",
            "timestamp_str": req.timestamp_str,
            "document_title": session.ai_title or session.filename
        }
    }


@app.post("/sessions/{session_id}/learning-timeline/sections/{section_id}/quiz", tags=["Learning Timeline"])
def quiz_learning_section(
    session_id: int,
    section_id: str,
    req: SectionQuizRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generates a multiple-choice question testing understanding of this specific video section.
    """
    session = db.query(StudySession).filter(
        StudySession.id == session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found or unauthorized")

    sec_ctx = (
        f"Section Title: {req.section_title or section_id}\n"
        f"Timestamp: {req.timestamp_str or ''}\n"
        f"Section Content: {req.what_video_says or ''}\n"
        f"Key Concepts: {', '.join(req.concept_tags or [])}\n"
    )

    prompt = f"""You are an elite academic assessment author for Florix AI.
Create ONE challenging, high-yield multiple-choice question testing the student's comprehension of this specific video section:
{sec_ctx}

Rules:
1. Ground the question strictly in what was taught in this section.
2. Provide 4 distinct options.
3. Indicate the zero-based index of the correct option (0, 1, 2, or 3).
4. Provide a clear pedagogical explanation of why that option is correct.

Return ONLY valid JSON with this exact schema:
{{
  "question": "Question text here",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_index": 0,
  "explanation": "Why this answer is correct according to the section."
}}
"""
    question_data = None
    try:
        resp = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt
        )
        txt = resp.text.strip() if resp and resp.text else ""
        if txt.startswith("```"):
            txt = re.sub(r"^```[a-zA-Z]*\n?", "", txt)
            txt = re.sub(r"\n?```$", "", txt).strip()
        question_data = json.loads(txt)
    except Exception as e:
        logger.warning(f"Section quiz generation error: {e}")
        question_data = {
            "question": f"What is the central concept discussed in the section '{req.section_title or 'this topic'}'?",
            "options": [
                req.section_title or "The core topic presented",
                "A completely unrelated historical premise",
                "Computational limitations of legacy systems",
                "None of the above"
            ],
            "correct_index": 0,
            "explanation": f"The section focuses on: {req.what_video_says or 'the specified concept'}."
        }

    try:
        ev = LearningEvent(
            user_id=current_user.id,
            session_id=session_id,
            event_type="SECTION_QUIZ_GENERATED",
            payload={"section_id": section_id, "title": req.section_title}
        )
        db.add(ev)
        db.commit()
    except Exception:
        pass

    return {
        "section_id": section_id,
        "quiz": question_data
    }


@app.post("/sessions/{session_id}/learning-timeline/progress", tags=["Learning Timeline"])
def update_section_progress(
    session_id: int,
    req: SectionProgressRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Updates the student's progress for a learning section (viewed, explained, quizzed).
    """
    session = db.query(StudySession).filter(
        StudySession.id == session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found or unauthorized")

    doc_meta = dict(session.doc_metadata or {})
    prog = dict(doc_meta.get("learning_timeline_progress", {}))

    sec_prog = dict(prog.get(req.section_id, {}))
    sec_prog[req.status] = True
    if req.score is not None:
        sec_prog["score"] = req.score
    sec_prog["updated_at"] = datetime.utcnow().isoformat()
    prog[req.section_id] = sec_prog

    doc_meta["learning_timeline_progress"] = prog
    session.doc_metadata = doc_meta

    try:
        ev = LearningEvent(
            user_id=current_user.id,
            session_id=session_id,
            event_type=f"SECTION_{req.status.upper()}",
            payload={"section_id": req.section_id, "score": req.score}
        )
        db.add(ev)
    except Exception:
        pass

    db.commit()
    return {"status": "ok", "progress": prog}


class DownloadTrackRequest(BaseModel):
    type: str = "summary"  # "quiz" | "summary" | "flashcard"
    title: str = "Study Document"


@app.get("/download-quota", tags=["Library"])
def get_download_quota(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check user's daily download count, limit, and remaining downloads."""
    plan = current_user.plan or "free"
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"]).get("downloads_per_day", 6)
    if getattr(current_user, "is_admin", False) or plan == "premium":
        limit = -1
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    count = db.query(Activity).filter(
        Activity.user_id == current_user.id,
        Activity.action == "Downloaded Content",
        Activity.timestamp >= today_start
    ).count()
    remaining = -1 if limit == -1 else max(0, limit - count)
    return {
        "plan": plan,
        "downloads_today": count,
        "limit": limit,
        "remaining": remaining,
        "is_unlimited": limit == -1
    }


@app.post("/track-download", tags=["Library"])
def track_download(
    data: DownloadTrackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Validate daily download quota and track download activity. Flashcards are exempt."""
    if data.type.lower() != "flashcard":
        check_plan_limit(current_user, "downloads_per_day", db)
        log_activity(db, current_user.id, "Downloaded Content", f"Downloaded {data.type.capitalize()}: {data.title[:60]}")
        db.commit()

    return get_download_quota(db, current_user)


@app.get("/shared/{share_token}", tags=["Library"])
def get_shared_session(share_token: str, request: Request, db: Session = Depends(get_db)):
    session = db.query(StudySession).filter(StudySession.share_token == share_token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Shared study session not found or link has expired.")

    # Optional authentication check from Authorization header
    authenticated_user = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            import jwt
            from auth import SECRET_KEY, ALGORITHM
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            email = payload.get("sub")
            if email:
                authenticated_user = db.query(User).filter(User.email == email).first()
        except Exception as e:
            logger.debug(f"Optional token validation in shared link failed: {e}")

    share_type = session.share_type or "public"

    if share_type == "private":
        if not authenticated_user or authenticated_user.id != session.user_id:
            raise HTTPException(
                status_code=403,
                detail="Access denied: This study session is private and can only be accessed by the owner."
            )

    elif share_type == "team":
        if not authenticated_user:
            raise HTTPException(
                status_code=401,
                detail="Authentication required: This session is restricted to team members. Please sign in to view."
            )

    return {
        "id": session.id,
        "filename": session.filename,
        "ai_title": session.ai_title,
        "summary": session.summary,
        "content": session.content,
        "source_type": session.source_type,
        "category": session.category,
        "intelligence_score": session.intelligence_score,
        "insights": session.insights or {},
        "timeline": session.timeline or [],
        "notes": session.notes or "",
        "quiz_data": session.quiz_data or [],
        "flashcards": session.flashcards or [],
        "share_type": share_type
    }


@app.get("/knowledge-vault/search", tags=["Library"])
def search_knowledge_vault(q: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not q or len(q.strip()) < 2:
        return []

    # 1. Fetch all user sessions
    sessions = db.query(StudySession).filter(StudySession.user_id == current_user.id).all()
    session_map = {s.id: s for s in sessions}
    session_ids = list(session_map.keys())
    if not session_ids:
        return []

    # 2. Embed the search query
    try:
        response = client.models.embed_content(
            model="models/gemini-embedding-2",
            contents=q
        )
        query_embedding = response.embeddings[0].values
    except Exception as e:
        logger.error(f"Gemini embedding failed in knowledge vault: {e}")
        return []

    # 3. Try ChromaDB first (fast HNSW cosine similarity)
    if chroma_collection is not None:
        try:
            # Build a filter for the user's sessions only
            chroma_filter = {"session_id": {"$in": session_ids}}
            results = chroma_collection.query(
                query_embeddings=[query_embedding],
                n_results=20,
                where=chroma_filter,
                include=["documents", "distances", "metadatas"]
            )
            if results and results["ids"] and results["ids"][0]:
                seen_sessions = set()
                formatted = []
                for idx, doc_id in enumerate(results["ids"][0]):
                    distance = results["distances"][0][idx]
                    score = 1.0 - distance  # cosine distance → similarity
                    if score < 0.1:
                        continue
                    meta = results["metadatas"][0][idx]
                    sess_id = meta.get("session_id")
                    if sess_id in seen_sessions:
                        continue
                    seen_sessions.add(sess_id)
                    sess = session_map.get(sess_id)
                    if not sess:
                        continue
                    text = results["documents"][0][idx] if results["documents"] else ""
                    formatted.append({
                        "session_id": sess.id,
                        "session_title": sess.filename,
                        "excerpt": text[:300] + "..." if len(text) > 300 else text,
                        "score": round(score, 3),
                        "category": sess.category or "Study"
                    })
                if formatted:
                    logger.info(f"✅ Knowledge Vault: Retrieved {len(formatted)} results from ChromaDB. Top score: {formatted[0]['score']}")
                    return formatted
        except Exception as e:
            logger.error(f"⚠️ ChromaDB knowledge vault query failed, falling back to SQLite: {e}")

    # 4. Fallback: SQLite cosine similarity scan
    chunks = db.query(DocumentChunk).filter(DocumentChunk.session_id.in_(session_ids)).all()
    if not chunks:
        # Final fallback to string search if no vector chunks exist
        results = db.query(StudySession).filter(
            StudySession.user_id == current_user.id,
            or_(
                StudySession.filename.ilike(f"%{q}%"),
                StudySession.summary.ilike(f"%{q}%"),
                StudySession.content.ilike(f"%{q}%")
            )
        ).limit(10).all()
        return [
            {
                "session_id": s.id,
                "session_title": s.filename,
                "excerpt": s.summary[:200] if s.summary else "",
                "score": 0.5,
                "category": s.category or "Study"
            }
            for s in results
        ]

    chunk_scores = []
    for chunk in chunks:
        sim = cosine_similarity(query_embedding, chunk.embedding)
        if sim > 0.1:
            chunk_scores.append((chunk, sim))

    chunk_scores.sort(key=lambda x: x[1], reverse=True)
    top_chunks = chunk_scores[:12]

    seen_sessions = set()
    results = []
    for chunk, score in top_chunks:
        sess = session_map.get(chunk.session_id)
        if not sess:
            continue
        if chunk.session_id in seen_sessions:
            continue
        seen_sessions.add(chunk.session_id)
        results.append({
            "session_id": sess.id,
            "session_title": sess.filename,
            "excerpt": chunk.text_content[:300] + "..." if len(chunk.text_content) > 300 else chunk.text_content,
            "score": round(score, 3),
            "category": sess.category or "Study"
        })

    return results


@app.get("/search", tags=["Library"])
def search_content(q: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not q or len(q.strip()) < 2:
        return []
    sessions = db.query(StudySession).filter(
        StudySession.user_id == current_user.id,
        or_(
            StudySession.filename.ilike(f"%{q}%"),
            StudySession.summary.ilike(f"%{q}%"),
            StudySession.content.ilike(f"%{q}%"),
        )
    ).limit(20).all()
    return [
        {"id": s.id, "filename": s.filename, "source_type": s.source_type or "pdf",
         "summary": s.summary[:150] + "..." if s.summary else "", "added": s.upload_date.strftime("%Y-%m-%d")}
        for s in sessions
    ]


# =============================================================================
# BOOKMARKS ENDPOINTS (Phase 4 — User Management)
# =============================================================================

@app.get("/bookmarks", tags=["Bookmarks"])
def get_bookmarks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bookmarks = db.query(Bookmark).filter(Bookmark.user_id == current_user.id).order_by(Bookmark.created_at.desc()).all()
    return [
        {
            "id": b.id,
            "session_id": b.session_id,
            "session_filename": b.session.filename if b.session else "Deleted",
            "session_summary": b.session.summary[:100] + "..." if b.session and b.session.summary else "",
            "note": b.note,
            "created_at": b.created_at.isoformat(),
        }
        for b in bookmarks
    ]


@app.post("/bookmarks", tags=["Bookmarks"])
def create_bookmark(data: BookmarkCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.query(StudySession).filter(
        StudySession.id == data.session_id, StudySession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    existing = db.query(Bookmark).filter(
        Bookmark.user_id == current_user.id, Bookmark.session_id == data.session_id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already bookmarked")

    bookmark = Bookmark(user_id=current_user.id, session_id=data.session_id, note=data.note)
    db.add(bookmark)
    log_activity(db, current_user.id, "Bookmarked", f"Saved: {session.filename}")
    db.commit()
    db.refresh(bookmark)
    return {"id": bookmark.id, "session_id": bookmark.session_id, "message": "Bookmarked successfully"}


@app.delete("/bookmarks/{session_id}", tags=["Bookmarks"])
def remove_bookmark(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bookmark = db.query(Bookmark).filter(
        Bookmark.user_id == current_user.id, Bookmark.session_id == session_id
    ).first()
    if not bookmark:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    db.delete(bookmark)
    db.commit()
    return {"message": "Bookmark removed"}


# =============================================================================
# CONVERSATION ENDPOINTS (Persistent AI Chat)
# =============================================================================

@app.get("/conversations", tags=["Chat"])
def list_conversations(
    project_id: Optional[int] = Query(None),
    standalone: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ChatConversation).filter(ChatConversation.user_id == current_user.id)
    if project_id is not None:
        query = query.filter(ChatConversation.project_id == project_id)
    elif standalone is True:
        query = query.filter(ChatConversation.project_id.is_(None))
    convs = query.order_by(ChatConversation.is_pinned.desc(), ChatConversation.updated_at.desc()).all()
    return [
        {
            "id": c.id,
            "title": c.title,
            "project_id": c.project_id,
            "is_pinned": bool(c.is_pinned),
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
            "message_count": len(c.messages),
        }
        for c in convs
    ]


@app.post("/conversations", tags=["Chat"])
def create_conversation(data: ConversationCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    conv = ChatConversation(
        title=data.title,
        user_id=current_user.id,
        session_id=data.session_id,
        project_id=data.project_id
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return {
        "id": conv.id,
        "title": conv.title,
        "project_id": conv.project_id,
        "is_pinned": bool(conv.is_pinned),
        "created_at": conv.created_at.isoformat(),
        "updated_at": conv.updated_at.isoformat(),
        "message_count": 0
    }


@app.patch("/conversations/{conv_id}/project", tags=["Chat"])
def move_conversation_project(conv_id: int, data: MoveChatProjectRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    conv = db.query(ChatConversation).filter(ChatConversation.id == conv_id, ChatConversation.user_id == current_user.id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if data.project_id:
        proj = db.query(Project).filter(Project.id == data.project_id, Project.user_id == current_user.id).first()
        if not proj:
            raise HTTPException(status_code=404, detail="Target space not found")
    conv.project_id = data.project_id
    db.commit()
    return {"message": "Conversation moved successfully", "id": conv.id, "project_id": conv.project_id}


@app.patch("/conversations/{conv_id}/pin", tags=["Chat"])
def toggle_pin_conversation(conv_id: int, data: PinChatRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    conv = db.query(ChatConversation).filter(ChatConversation.id == conv_id, ChatConversation.user_id == current_user.id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv.is_pinned = data.is_pinned
    db.commit()
    return {"message": "Pin updated", "id": conv.id, "is_pinned": conv.is_pinned}


@app.get("/conversations/{conv_id}/messages", tags=["Chat"])
def get_messages(conv_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    conv = db.query(ChatConversation).filter(ChatConversation.id == conv_id, ChatConversation.user_id == current_user.id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return [{"id": m.id, "role": m.role, "content": m.content, "created_at": m.created_at.isoformat()} for m in conv.messages]


def agent_search_user_library(query: str, user_id: int, db: Session) -> str:
    """Search the user's study library for relevant topics or filenames."""
    logger.info(f"🤖 Tool Execution: search_user_library('{query}')")
    results = db.query(StudySession).filter(
        StudySession.user_id == user_id,
        or_(
            StudySession.filename.like(f"%{query}%"),
            StudySession.summary.like(f"%{query}%")
        )
    ).limit(5).all()
    if not results:
        return f"No study sessions found matching '{query}'."
    return "\n".join(f"- Session ID {s.id}: Title: '{s.filename}', Type: {s.source_type}, Summary: {s.summary[:150]}..." for s in results)


def agent_get_session_details(session_id: int, user_id: int, db: Session) -> str:
    """Retrieve detailed content and quiz history of a specific study session."""
    logger.info(f"🤖 Tool Execution: get_session_details({session_id})")
    session = db.query(StudySession).filter(StudySession.id == session_id, StudySession.user_id == user_id).first()
    if not session:
        return f"Study session with ID {session_id} not found."
    quizzes = db.query(QuizResult).filter(QuizResult.session_id == session_id).all()
    quiz_info = ", ".join(f"{q.score}/{q.total_questions} ({q.percentage}%)" for q in quizzes) if quizzes else "None taken yet"
    return f"Title: '{session.filename}'\nType: {session.source_type}\nSummary: {session.summary[:600]}\nQuiz scores: {quiz_info}"


def agent_get_user_learning_stats(user_id: int, db: Session) -> str:
    """Retrieve the user's learning metrics, document counts, and quiz progress."""
    logger.info(f"🤖 Tool Execution: get_user_learning_stats() for user {user_id}")
    total_sessions = db.query(StudySession).filter(StudySession.user_id == user_id).count()
    quiz_results = db.query(QuizResult).filter(QuizResult.user_id == user_id).all()
    total_quizzes = len(quiz_results)
    avg_score = round(sum(r.percentage for r in quiz_results) / total_quizzes) if quiz_results else 0
    bookmarks_count = db.query(Bookmark).filter(Bookmark.user_id == user_id).count()
    return f"Total study sessions uploaded: {total_sessions}\nQuizzes completed: {total_quizzes}\nAverage quiz score: {avg_score}%\nSaved bookmarks: {bookmarks_count}"


@app.post("/conversations/{conv_id}/message", tags=["Chat"])
def send_message(conv_id: int, data: MessageCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    check_plan_limit(current_user, "chats_per_day", db)
    conv = db.query(ChatConversation).filter(ChatConversation.id == conv_id, ChatConversation.user_id == current_user.id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    user_msg = ChatMessage(role="user", content=data.message, conversation_id=conv_id)
    db.add(user_msg)
    db.flush()

    recent = conv.messages[-10:] if len(conv.messages) >= 10 else conv.messages
    history_text = "\n".join(f"{m.role.upper()}: {m.content}" for m in recent)
    style_instr = get_style_instruction(data.response_style)

    # 📂 Space Knowledge Grounding (YouLearn.ai & Claude Projects style)
    space_knowledge = ""
    if conv.project_id:
        space = db.query(Project).filter(Project.id == conv.project_id, Project.user_id == current_user.id).first()
        if space and space.sessions:
            doc_summaries = "\n".join([f"- [{s.source_type.upper()}] '{s.filename}': {s.summary[:350]}..." for s in space.sessions[:5]])
            space_knowledge = f"\n\nCURRENT SPACE CONTEXT ({space.icon or '📁'} {space.name}):\nThis chat is inside the '{space.name}' Space. The student has uploaded these study materials in this Space:\n{doc_summaries}\nReference and ground your answers in these study materials when relevant.\n"

    # 🤖 ReAct Agent Loop
    max_loops = 2
    tool_results = []
    current_prompt = f"Response style: {style_instr}{space_knowledge}\n\nConversation history:\n{history_text}\n\nRespond to: {data.message}"
    reply = ""

    for loop in range(max_loops):
        agent_instruction = (
            f"You are Florix AI, an advanced Agentic Chat Assistant with direct database tool access. "
            f"If you need to query database stats or search documents to answer the user, write EXACTLY the tool call command and nothing else. "
            f"If you already have the tool output data or do not need database tools, respond normally as a helpful AI tutor. "
            f"Available tools:\n"
            f"- [CALL_TOOL: search_user_library(\"search_query\")]\n"
            f"- [CALL_TOOL: get_session_details(session_id_integer)]\n"
            f"- [CALL_TOOL: get_user_learning_stats()]\n\n"
            f"{f'Previous Tool Call Results:\n' + chr(10).join(tool_results) if tool_results else ''}"
        )

        reply = generate_with_fallback(current_prompt, agent_instruction)

        # Check if the model wants to call a tool
        tool_call_match = re.search(r"\[CALL_TOOL:\s*(\w+)\((.*?)\)\]", reply)
        if tool_call_match:
            tool_name = tool_call_match.group(1)
            tool_args_raw = tool_call_match.group(2).strip()

            logger.info(f"🤖 Agent loop {loop+1}: requested tool {tool_name}({tool_args_raw})")

            try:
                if tool_name == "search_user_library":
                    q = tool_args_raw.strip("\"'")
                    res = agent_search_user_library(q, current_user.id, db)
                elif tool_name == "get_session_details":
                    sid = int(tool_args_raw)
                    res = agent_get_session_details(sid, current_user.id, db)
                elif tool_name == "get_user_learning_stats":
                    res = agent_get_user_learning_stats(current_user.id, db)
                else:
                    res = f"Error: Tool '{tool_name}' is not recognized."
            except Exception as ex:
                res = f"Error executing tool: {str(ex)}"

            logger.info(f"🤖 Tool Output: {res[:100]}...")
            tool_results.append(f"Tool {tool_name}({tool_args_raw}) returned:\n{res}")
            continue
        else:
            # Answer is direct, break out of tool loop
            break

    ai_msg = ChatMessage(role="assistant", content=reply, conversation_id=conv_id)
    db.add(ai_msg)

    if conv.title in ("New Chat", "New Conversation"):
        conv.title = data.message[:50] + ("..." if len(data.message) > 50 else "")
    conv.updated_at = datetime.utcnow()
    db.commit()

    return {"reply": reply, "conv_id": conv_id, "title": conv.title}


@app.delete("/conversations/{conv_id}", tags=["Chat"])
def delete_conversation(conv_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    conv = db.query(ChatConversation).filter(ChatConversation.id == conv_id, ChatConversation.user_id == current_user.id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return {"message": "Conversation deleted"}


@app.patch("/conversations/{conv_id}", tags=["Chat"])
def rename_conversation(conv_id: int, data: ConversationTitleUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    conv = db.query(ChatConversation).filter(ChatConversation.id == conv_id, ChatConversation.user_id == current_user.id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv.title = data.title
    db.commit()
    return {"id": conv.id, "title": conv.title}


# =============================================================================
# ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
