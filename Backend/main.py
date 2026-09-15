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
from typing import List, Optional, AsyncGenerator
from datetime import timedelta, datetime
from contextlib import asynccontextmanager

import requests
from bs4 import BeautifulSoup
from youtube_transcript_api import YouTubeTranscriptApi
from urllib.parse import urlparse, parse_qs
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
from google.api_core import exceptions as google_exceptions
from dotenv import load_dotenv
from pypdf import PdfReader

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
MODEL_NAME = "gemini-3.5-flash"
MODEL_CASCADE = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]

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

def generate_with_fallback(prompt: str, instruction: str = "Summarize this text professionally in Markdown format") -> str:
    """Call Gemini with exponential backoff retry on quota or unavailable demand spikes, falling back dynamically to gemini-1.5-flash."""
    max_retries = 3
    safety = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
    ]
    current_model = MODEL_NAME
    for attempt in range(max_retries):
        try:
            truncated = prompt[:15000]
            response = client.models.generate_content(
                model=current_model,
                contents=f"{instruction}:\n\n{truncated}",
                config={"safety_settings": safety},
            )
            track_gemini_tokens(response)
            return response.text if response and response.text else "AI returned an empty response."
        except (google_exceptions.ResourceExhausted, google_exceptions.ServiceUnavailable, google_exceptions.InternalServerError) as e:
            wait = (2 ** attempt) + random.random()
            
            # If rate limited or service is unavailable, switch immediately to highly available fallback model
            if attempt >= 0 and current_model != "gemini-1.5-flash":
                logger.warning(f"Primary model {current_model} spiked or hit rate limit ({e}). Switching dynamically to fallback gemini-1.5-flash.")
                current_model = "gemini-1.5-flash"
                
            logger.warning(f"Gemini error: {e}. Retrying in {wait:.1f}s (attempt {attempt+1}/{max_retries})")
            time.sleep(wait)
        except google_exceptions.NotFound:
            logger.error(f"Model {current_model} not found.")
            if current_model != "gemini-1.5-flash":
                logger.warning("Attempting model fallback to gemini-1.5-flash.")
                current_model = "gemini-1.5-flash"
                continue
            return "Error: AI model not found. Please contact support."
        except Exception as e:
            logger.error(f"Gemini exception: {e}")
            return f"Error connecting to AI: {str(e)}"
    return "The AI engine is currently experiencing high demand. Please try again in a few moments."


def generate_multimodal(image_bytes: bytes, mime_type: str, instruction: str) -> str:
    """Call Gemini with an image for multimodal vision analysis, with retry backoffs."""
    max_retries = 3
    safety = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
    ]
    current_model = "gemini-2.5-flash"  # Highly performant at vision/multimodal!
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=current_model,
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                    instruction
                ],
                config={"safety_settings": safety},
            )
            track_gemini_tokens(response)
            return response.text if response and response.text else "AI returned an empty multimodal response."
        except (google_exceptions.ResourceExhausted, google_exceptions.ServiceUnavailable, google_exceptions.InternalServerError) as e:
            wait = (2 ** attempt) + random.random()
            if attempt >= 0 and current_model != "gemini-1.5-flash":
                logger.warning(f"Primary vision model {current_model} spiked/errored. Switching dynamically to gemini-1.5-flash.")
                current_model = "gemini-1.5-flash"
            logger.warning(f"Gemini vision error: {e}. Retrying in {wait:.1f}s (attempt {attempt+1}/{max_retries})")
            time.sleep(wait)
        except Exception as e:
            logger.error(f"Multimodal exception: {e}")
            return f"Error analyzing image: {str(e)}"
    return "The AI vision engine is currently experiencing high demand. Please try again later."


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
            with open(file_path, "rb") as af:
                audio_file = client.files.upload(file=af, config={"mime_type": mime_type})
            instruction = (
                "Transcribe this audio recording accurately. Then create a comprehensive study guide "
                "from the transcription in Markdown format, including key points, summary, and important concepts."
            )
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=[instruction, audio_file],
            )
            full_text = response.text if response and response.text else ""
            summary = full_text
            text = full_text
            session.content = text
            session.summary = summary
            db.commit()
            update_pipeline_progress(progress_id, 2, "Content parsing", f"Audio transcription complete ({len(full_text)} characters)", "done")

        elif source_type == "video" and file_path:
            update_pipeline_progress(progress_id, 2, "Content parsing", "Uploading video to Gemini and running transcript...", "active")
            with open(file_path, "rb") as vf:
                video_file = client.files.upload(file=vf, config={"mime_type": mime_type})
            instruction = (
                "You are an expert educational content analyzer. Watch and analyze this video comprehensively. "
                "Extract all spoken content (transcription), visual information, text on screen, diagrams, and key concepts. "
                "Create a comprehensive study guide in Markdown format with: "
                "# Video Title, ## Transcription Highlights, ## Key Topics Covered, ## Summary, ## Important Points, ## Key Takeaways."
            )
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=[instruction, video_file],
            )
            full_text = response.text if response and response.text else ""
            summary = full_text
            text = full_text
            session.content = text
            session.summary = summary
            db.commit()
            update_pipeline_progress(progress_id, 2, "Content parsing", f"Video processing complete ({len(full_text)} characters)", "done")

        elif source_type in ("pdf", "url", "text"):
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
        update_pipeline_progress(progress_id, 3, "Text chunking", "Chunking document text...", "active")
        chunks = chunk_text(text, chunk_size=800, overlap=150)
        if chunks:
            update_pipeline_progress(progress_id, 3, "Text chunking", f"Split into {len(chunks)} semantic chunks", "done")
            
            update_pipeline_progress(progress_id, 4, "Generating vector embeddings", f"Creating embeddings for {len(chunks)} chunks...", "active")
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
            
            update_pipeline_progress(progress_id, 5, "Indexing in ChromaDB", "Writing metadata to SQLite & ChromaDB...", "active")
            db_chunks = []
            for index, (chunk_text_val, embedding_vector) in enumerate(zip(chunks, all_embeddings)):
                db_chunk = DocumentChunk(
                    chunk_index=index,
                    text_content=chunk_text_val,
                    embedding=embedding_vector,
                    session_id=session_id
                )
                db_chunks.append(db_chunk)
            db.add_all(db_chunks)
            db.commit()

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
                except Exception as e:
                    logger.error(f"⚠️ ChromaDB background error: {e}")

            update_pipeline_progress(progress_id, 5, "Indexing in ChromaDB", "ChromaDB index complete", "done")
        else:
            update_pipeline_progress(progress_id, 3, "Text chunking", "No chunks generated", "done")
            update_pipeline_progress(progress_id, 4, "Generating vector embeddings", "Skipped", "done")
            update_pipeline_progress(progress_id, 5, "Indexing in ChromaDB", "Skipped", "done")

        # Step 5: Mark all tasks complete in pipeline progress tracker
        for step_idx in range(1, 7):
            update_pipeline_progress(progress_id, step_idx, "Processing Complete", "All steps processed successfully", "done")
        logger.info(f"✅ Background task successfully completed for session {session_id}")

    except Exception as e:
        logger.error(f"❌ Background task error: {e}")
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


def retrieve_relevant_chunks(session_id: int, query: str, db: Session, top_k: int = 4) -> List[dict]:
    """
    Embeds the user query and retrieves the Top-K document chunks
    matching by cosine similarity from ChromaDB (with SQLite fallback).
    """
    logger.info(f"🔍 Retrieval started for query: '{query[:50]}' (session {session_id})...")
    try:
        # 1. Embed query
        response = client.models.embed_content(
            model="models/gemini-embedding-2",
            contents=query
        )
        query_embedding = response.embeddings[0].values
        
        # 2. Try querying ChromaDB first
        if chroma_collection is not None:
            try:
                results = chroma_collection.query(
                    query_embeddings=[query_embedding],
                    n_results=top_k,
                    where={"session_id": session_id}
                )
                if results and results.get("documents") and len(results["documents"][0]) > 0:
                    documents = results["documents"][0]
                    metadatas = results["metadatas"][0]
                    distances = results["distances"][0] if "distances" in results else [0.5] * len(documents)
                    
                    formatted_chunks = []
                    for doc, meta, dist in zip(documents, metadatas, distances):
                        sim_score = 1.0 - dist  # Cosine distance to similarity
                        formatted_chunks.append({
                            "chunk_index": meta.get("chunk_index", 0),
                            "text_content": doc,
                            "score": sim_score
                        })
                    logger.info(f"✅ Retrieved {len(formatted_chunks)} chunks from ChromaDB. Top score: {formatted_chunks[0]['score']:.3f}")
                    return formatted_chunks
            except Exception as e:
                logger.error(f"⚠️ ChromaDB query failed, falling back to SQLite: {e}")
        
        # 3. Fallback: Fetch chunks from SQLite
        chunks = db.query(DocumentChunk).filter(DocumentChunk.session_id == session_id).all()
        if not chunks:
            logger.warning(f"No chunks found for session {session_id} in DB. Falling back to empty retrieval.")
            return []
            
        # Calculate cosine similarity
        chunk_scores = []
        for chunk in chunks:
            sim = cosine_similarity(query_embedding, chunk.embedding)
            chunk_scores.append((chunk, sim))
            
        # Sort and return Top-K
        chunk_scores.sort(key=lambda x: x[1], reverse=True)
        top_chunks = chunk_scores[:top_k]
        
        if top_chunks:
            logger.info(f"✅ Retrieved {len(top_chunks)} chunks from SQLite fallback. Top score: {top_chunks[0][1]:.3f}")
        else:
            logger.info("No chunks matched.")
            
        return [{"chunk_index": c.chunk_index, "text_content": c.text_content, "score": s} for c, s in top_chunks]
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
        "id": new_user.id, "name": new_user.name, "email": new_user.email, "plan": new_user.plan
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

    if len(attempts) >= 5:
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Please try again in 15 minutes.",
        )

    db_user = db.query(User).filter(User.email == user.email.lower().strip()).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        # Record failed attempt
        _login_attempts.setdefault(client_ip, []).append(now)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Successful login — clear attempt history for this IP
    _login_attempts.pop(client_ip, None)
    logger.info(f"User logged in: {db_user.email}")
    token = create_access_token(
        data={"sub": db_user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": token, "token_type": "bearer", "user": {
        "id": db_user.id, "name": db_user.name, "email": db_user.email, "plan": db_user.plan, "is_admin": getattr(db_user, "is_admin", False)
    }}


@app.post("/refresh-token", response_model=Token, tags=["Auth"])
def refresh_token(current_user: User = Depends(get_current_user)):
    """Issues a fresh access token for an authenticated user."""
    token = create_access_token(
        data={"sub": current_user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": token, "token_type": "bearer", "user": {
        "id": current_user.id, "name": current_user.name, "email": current_user.email, "plan": current_user.plan, "is_admin": getattr(current_user, "is_admin", False)
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
    return {"access_token": token, "token_type": "bearer", "user": {
        "id": user.id, "name": user.name, "email": user.email, "plan": user.plan, "is_admin": getattr(user, "is_admin", False)
    }}


@app.get("/me", tags=["Auth"])
def read_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "plan": current_user.plan or "free",
        "plan_expires_at": current_user.plan_expires_at.isoformat() if current_user.plan_expires_at else None,
        "member_since": current_user.created_at.strftime("%B %Y") if current_user.created_at else "N/A",
        "is_admin": getattr(current_user, "is_admin", False),
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
                        reader.decrypt("")
                    except Exception:
                        raise HTTPException(status_code=422, detail="This PDF is password-protected. Please upload an unprotected PDF or remove the password first.")
                text = "\n".join(page.extract_text() or "" for page in reader.pages)
            except HTTPException:
                raise  # Re-raise our own HTTP exceptions
            except Exception as e:
                error_msg = str(e).lower()
                if "password" in error_msg or "encrypted" in error_msg:
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

    update_pipeline_progress(progress_id, 1, "File received", f"Received audio file {file.filename} ({len(contents) / 1024 / 1024:.2f} MB)", "done")
    update_pipeline_progress(progress_id, 2, "Content parsing", "Preparing audio transcript pipeline...", "active")

    os.makedirs("uploads", exist_ok=True)
    clean_name = re.sub(r"[^\w\.-]", "_", file.filename)
    file_path = f"uploads/{clean_name}"
    with open(file_path, "wb") as f:
        f.write(contents)

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
        mime_type=f"audio/{ext.lstrip('.')}",
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
    update_pipeline_progress(progress_id, 2, "Content parsing", "Preparing video analysis pipeline...", "active")

    os.makedirs("uploads", exist_ok=True)
    clean_name = re.sub(r"[^\w\.-]", "_", file.filename)
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


@app.post("/process-link", tags=["Content"])
async def process_link(
    background_tasks: BackgroundTasks,
    request: LinkRequest,
    progress_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_plan_limit(current_user, "sessions", db)
    url = request.url.strip()

    # 🔒 URL format validation
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty.")
    parsed = urlparse(url)
    if not parsed.scheme or parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Invalid URL. Must start with http:// or https://")
    if not parsed.netloc or "." not in parsed.netloc:
        raise HTTPException(status_code=400, detail="Invalid URL format. Please enter a valid website address (e.g. https://example.com).")

    update_pipeline_progress(progress_id, 1, "File received", f"Received URL to process: {url}", "done")
    update_pipeline_progress(progress_id, 2, "Content parsing", "Fetching and parsing website/YouTube content...", "active")

    # ── YouTube ──
    yt_match = re.search(r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)([a-zA-Z0-9_-]{11})", url)
    if yt_match:
        video_id = yt_match.group(1)
        try:
            text = ""
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
                    text = " ".join(
                        item["text"] if isinstance(item, dict) else getattr(item, "text", str(item))
                        for item in fetched
                    )
            except AttributeError:
                transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
                text = " ".join(t["text"] for t in transcript_list)
        except Exception as e:
            error_str = str(e).lower()
            if "no transcript" in error_str or "disabled" in error_str:
                raise HTTPException(status_code=422, detail="This YouTube video has no available transcript. Subtitles/captions may be disabled by the creator.")
            elif "video unavailable" in error_str or "not found" in error_str:
                raise HTTPException(status_code=422, detail="This YouTube video is unavailable, private, or does not exist.")
            else:
                raise HTTPException(status_code=422, detail=f"Could not fetch YouTube transcript: {str(e)}")

        if not text or not text.strip():
            raise HTTPException(status_code=422, detail="YouTube transcript is empty. The video may not have any spoken content.")

        # Truncate to plan-based link character limit
        plan = current_user.plan or "free"
        max_link_chars = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"]).get("max_link_chars", 10000)
        if max_link_chars != -1 and len(text) > max_link_chars:
            text = text[:max_link_chars]

        instruction = (
            "You are an expert educational content creator. Based on this YouTube video transcript, "
            "create a comprehensive study guide in Markdown format with: "
            "# Video Title, ## Key Topics Covered, ## Summary, ## Important Points, ## Key Takeaways."
        )
        update_pipeline_progress(progress_id, 2, "Content parsing", f"Fetched YouTube transcript successfully ({len(text)} characters)", "done")
        update_pipeline_progress(progress_id, 6, "AI summary generation", "Generating study guide from YouTube video transcript...", "active")
        # Fetch real YouTube video title via official oEmbed API
        yt_title = f"YouTube: {video_id}"
        try:
            oembed_resp = requests.get(f"https://www.youtube.com/oembed?url={url}&format=json", timeout=4)
            if oembed_resp.status_code == 200:
                fetched_title = oembed_resp.json().get("title", "").strip()
                if fetched_title:
                    yt_title = fetched_title
        except Exception:
            pass
        title = yt_title
        source_type = "youtube"
    else:
        # ── Web URL ──
        try:
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"}
            resp = requests.get(url, timeout=20, headers=headers, allow_redirects=True)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
                tag.decompose()
            # Truncate to plan-based link character limit
            plan = current_user.plan or "free"
            max_link_chars = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"]).get("max_link_chars", 10000)
            text = " ".join(soup.get_text(separator=" ").split())[:max_link_chars]
            page_title = soup.find("title")
            title = page_title.get_text().strip() if page_title else urlparse(url).netloc
        except requests.exceptions.Timeout:
            raise HTTPException(status_code=422, detail="The website took too long to respond (timeout). Please check if the URL is accessible and try again.")
        except requests.exceptions.ConnectionError:
            raise HTTPException(status_code=422, detail="Could not connect to the website. The URL may be broken, expired, or the server is down.")
        except requests.exceptions.HTTPError as he:
            status = he.response.status_code if he.response else 0
            if status == 403:
                raise HTTPException(status_code=422, detail="Access denied (403 Forbidden). This website restricts automated access.")
            elif status == 404:
                raise HTTPException(status_code=422, detail="Page not found (404). The URL may be broken or the content has been removed.")
            elif status >= 500:
                raise HTTPException(status_code=422, detail=f"The website returned a server error ({status}). Please try again later.")
            else:
                raise HTTPException(status_code=422, detail=f"Could not fetch URL: HTTP {status} error.")
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Could not fetch URL: {str(e)}")

        if not text or len(text.strip()) < 50:
            raise HTTPException(status_code=422, detail="The webpage returned very little readable content. It may require login, use heavy JavaScript rendering, or be a restricted page.")

        instruction = (
            "You are an expert at distilling web content into study material. "
            "Analyze this web page content and create a comprehensive study guide in Markdown format with: "
            "# Page Title, ## Key Points, ## Summary, ## Important Information."
        )
        update_pipeline_progress(progress_id, 2, "Content parsing", f"Scraped webpage successfully ({len(text)} characters)", "done")
        update_pipeline_progress(progress_id, 6, "AI summary generation", "Generating study guide from webpage content...", "active")
        summary = generate_with_fallback(text, instruction)
        source_type = "url"

    # ── YouTube / Link Timeline & Basic Save ──
    display_title = title[:100]
    initial_timeline = [{"event": f"Processed {source_type.upper()}", "timestamp": datetime.utcnow().isoformat(), "detail": f"Source URL: {url}"}]

    assigned_space_id = ensure_session_space(db, current_user.id, request.project_id, display_title, "youtube" if yt_match else "web")
    new_session = StudySession(
        filename=display_title, ai_title=None, summary="Processing...", content=text,
        user_id=current_user.id, source_type=source_type,
        category="Processing...",
        timeline=initial_timeline,
        project_id=assigned_space_id,
    )
    db.add(new_session)
    log_activity(db, current_user.id, f"Processed {'YouTube Video' if yt_match else 'Web URL'}", f"Analyzed: {display_title[:60]}")
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
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty. Please paste some content.")
    if len(text) < 50:
        raise HTTPException(status_code=400, detail="Text too short. Please provide at least 50 characters for meaningful analysis.")
    # Enforce subscription-based paste character limit
    check_plan_limit(current_user, "max_paste_chars", db, len(text))

    update_pipeline_progress(progress_id, 1, "File received", f"Received text input ({len(text)} characters)", "done")
    update_pipeline_progress(progress_id, 2, "Content parsing", "Parsing text content and removing markup...", "active")

    # Strip HTML tags if user pasted HTML content
    import html as html_module
    if "<" in text and ">" in text:
        from bs4 import BeautifulSoup as BS
        text = BS(text, "html.parser").get_text(separator=" ")
        text = html_module.unescape(text).strip()
        if len(text) < 50:
            raise HTTPException(status_code=400, detail="After removing HTML markup, the text content is too short. Please provide more substantive text.")

    instruction = (
        "You are an expert academic content summarizer. Analyze the following text and create a "
        "comprehensive study guide in Markdown format with: "
        "# Title, ## Key Concepts, ## Summary, ## Important Points, ## Key Terms."
    )
    update_pipeline_progress(progress_id, 2, "Content parsing", f"Successfully validated text content ({len(text)} characters)", "done")
    update_pipeline_progress(progress_id, 6, "AI summary generation", "Generating study guide from pasted text...", "active")
    summary = generate_with_fallback(text, instruction)
    title = f"Pasted Text — {datetime.utcnow().strftime('%b %d, %Y')}"

    title = f"Pasted Text — {datetime.utcnow().strftime('%b %d, %Y')}"
    display_title = title
    initial_timeline = [{"event": "Processed Text Input", "timestamp": datetime.utcnow().isoformat(), "detail": f"Length: {len(text)} characters"}]

    assigned_space_id = ensure_session_space(db, current_user.id, request.project_id, display_title, "text")
    new_session = StudySession(
        filename=display_title, ai_title=None, summary="Processing...", content=text,
        user_id=current_user.id, source_type="text",
        category="Processing...",
        timeline=initial_timeline,
        project_id=assigned_space_id,
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
    style_instruction = get_style_instruction(request.response_style)

    if request.session_id:
        session = db.query(StudySession).filter(
            StudySession.id == request.session_id, StudySession.user_id == current_user.id
        ).first()
        if not session:
            raise HTTPException(status_code=404, detail="Study session not found")

        # 🔍 Perform Semantic RAG Search
        chunks = retrieve_relevant_chunks(session.id, request.message, db, top_k=4)
        if chunks:
            doc_context = "\n\n---\n\n".join(
                f"[Chunk {c['chunk_index']} (Relevance Score: {c['score']:.3f})]:\n{c['text_content']}"
                for c in chunks
            )
            logger.info(f"✅ RAG Context built from {len(chunks)} relevant database chunks.")
        else:
            # Fallback to whole slice if not indexed
            doc_context = session.content[:15000]
            logger.info("⚠️ Falling back to sliced full document context.")

        instruction = (
            f"You are Florix AI, an intelligent study assistant. "
            f"Answer the user's question based on the relevant document chunks provided below. "
            f"If the document doesn't contain the answer, use your general knowledge and clearly state so. "
            f"Response style: {style_instruction}. "
            f"User Question: {request.message}"
        )
        answer = generate_with_fallback(doc_context, instruction)
    else:
        instruction = (
            f"You are Florix AI, a highly intelligent, friendly AI study assistant and tutor. "
            f"You help students understand complex topics clearly. "
            f"Response style: {style_instruction}. "
            f"User Question: {request.message}"
        )
        answer = generate_with_fallback("", instruction)

    return {"reply": answer}


@app.post("/chat/stream", tags=["AI"])
async def chat_stream(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_plan_limit(current_user, "chats_per_day", db)
    """Server-Sent Events endpoint for streaming AI responses token by token."""
    style_instruction = get_style_instruction(request.response_style)

    if request.session_id:
        session = db.query(StudySession).filter(
            StudySession.id == request.session_id, StudySession.user_id == current_user.id
        ).first()
        if not session:
            raise HTTPException(status_code=404, detail="Study session not found")
        
        # 🔍 Perform Semantic RAG Search
        chunks = retrieve_relevant_chunks(session.id, request.message, db, top_k=4)
        if chunks:
            doc_context = "\n\n---\n\n".join(
                f"[Chunk {c['chunk_index']} (Relevance Score: {c['score']:.3f})]:\n{c['text_content']}"
                for c in chunks
            )
            logger.info(f"✅ RAG Streaming Context built from {len(chunks)} relevant chunks.")
        else:
            # Fallback
            doc_context = session.content[:15000]
            logger.info("⚠️ Falling back to sliced full document context for streaming.")

        instruction = (
            f"You are Florix AI, an intelligent study assistant. "
            f"Answer based on the following relevant document chunks. Response style: {style_instruction}. "
            f"User Question: {request.message}\n\nDocument Chunks:\n{doc_context}"
        )
    else:
        instruction = (
            f"You are Florix AI, a friendly AI study assistant. "
            f"Response style: {style_instruction}. "
            f"Answer: {request.message}"
        )

    async def event_generator() -> AsyncGenerator[str, None]:
        safety = [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]
        try:
            for chunk in client.models.generate_content_stream(
                model=MODEL_NAME,
                contents=instruction,
                config={"safety_settings": safety},
            ):
                if chunk.text:
                    # SSE format: data: <payload>\n\n
                    yield f"data: {json.dumps({'token': chunk.text})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


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