"""Pydantic schemas and DTOs for Viva / Oral Examination Mode."""

from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class VivaMode(str, Enum):
    QUICK_VIVA = "QUICK_VIVA"
    TOPIC_VIVA = "TOPIC_VIVA"
    DOCUMENT_VIVA = "DOCUMENT_VIVA"
    EXAM_PREPARATION_VIVA = "EXAM_PREPARATION_VIVA"
    WEAK_AREA_VIVA = "WEAK_AREA_VIVA"


class VivaStatus(str, Enum):
    CREATED = "CREATED"
    IN_PROGRESS = "IN_PROGRESS"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    TIME_EXPIRED = "TIME_EXPIRED"
    CANCELLED = "CANCELLED"


class FollowUpType(str, Enum):
    CLARIFICATION = "CLARIFICATION"
    WHY_HOW = "WHY_HOW"
    APPLICATION = "APPLICATION"
    PROBE_MISCONCEPTION = "PROBE_MISCONCEPTION"
    PREREQUISITE_CHECK = "PREREQUISITE_CHECK"
    NONE = "NONE"


class VivaCreateRequest(BaseModel):
    title: Optional[str] = Field(None, max_length=200, description="Optional custom title for the viva")
    session_id: Optional[int] = Field(None, description="Target study session ID to ground the viva")
    topic: Optional[str] = Field("General", max_length=150, description="Subject or topic area")
    viva_mode: Optional[str] = Field("TOPIC_VIVA", description="QUICK_VIVA | TOPIC_VIVA | DOCUMENT_VIVA | EXAM_PREPARATION_VIVA | WEAK_AREA_VIVA")
    teaching_mode: Optional[str] = Field("INTERMEDIATE", description="BEGINNER | INTERMEDIATE | ADVANCED | EXAM | INTERVIEW | REVISION")
    difficulty: Optional[str] = Field("intermediate", description="beginner | intermediate | advanced")
    total_questions: Optional[int] = Field(5, ge=1, le=20, description="Total number of main questions")
    time_limit_minutes: Optional[int] = Field(None, ge=1, le=180, description="Optional server time limit in minutes")
    focus_weak_areas: Optional[bool] = Field(False, description="Whether to prioritize low-mastery concepts")


class VivaAnswerRequest(BaseModel):
    question_id: int = Field(..., description="ID of the VivaQuestion being answered")
    user_answer: str = Field(..., min_length=1, max_length=10000, description="Learner's oral transcript or typed answer")
    input_mode: Optional[str] = Field("typed", description="'typed' | 'voice'")
    time_spent_seconds: Optional[int] = Field(0, ge=0, description="Seconds spent formulating the response")

    @field_validator("user_answer")
    @classmethod
    def strip_and_validate(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("user_answer cannot be empty")
        return s


class VivaQuestionResponse(BaseModel):
    id: int
    question_order: int
    question_text: str
    question_type: str
    expected_concepts: List[str] = []
    topic: str
    difficulty: str
    is_follow_up: bool
    parent_question_id: Optional[int] = None
    page_number: Optional[int] = None
    citation_excerpt: Optional[str] = None
    is_answered: bool = False


class VivaTurnResponse(BaseModel):
    id: int
    question_id: int
    user_answer: str
    input_mode: str
    correctness_score: float
    completeness_score: float
    reasoning_score: float
    clarity_score: float
    overall_score: float
    is_grounded: bool
    evidence_found: List[str] = []
    misconceptions: List[str] = []
    missing_concepts: List[str] = []
    strengths: Optional[str] = None
    improvement_feedback: Optional[str] = None
    follow_up_prompt: Optional[str] = None
    needs_follow_up: bool = False
    time_spent_seconds: int = 0
    answered_at: Optional[str] = None


class VivaSessionResponse(BaseModel):
    id: int
    session_id: Optional[int] = None
    title: str
    viva_mode: str
    teaching_mode: str
    topic: str
    difficulty: str
    status: str
    total_questions: int
    current_question_index: int
    time_limit_minutes: Optional[int] = None
    started_at: Optional[str] = None
    expires_at: Optional[str] = None
    completed_at: Optional[str] = None
    overall_score: Optional[float] = None
    current_question: Optional[VivaQuestionResponse] = None
    questions: List[VivaQuestionResponse] = []
    turns: List[VivaTurnResponse] = []


class VivaResultsResponse(BaseModel):
    id: int
    title: str
    viva_mode: str
    teaching_mode: str
    topic: str
    status: str
    overall_score: float
    passed: bool
    proficiency_level: str
    total_questions: int
    answered_questions: int
    overall_feedback: str
    strong_areas: List[str] = []
    weak_areas: List[str] = []
    turns: List[VivaTurnResponse] = []
    mistake_ids: List[int] = []


class VivaPlanTaskRequest(BaseModel):
    scheduled_date: Optional[str] = Field(None, description="Target execution date (YYYY-MM-DD)")


class VivaRemindRequest(BaseModel):
    scheduled_at: str = Field(..., description="ISO datetime string for revision notification")
    recurrence: Optional[str] = Field("once", description="'once' | 'daily' | 'weekly'")
