"""Pydantic schemas for Adaptive Study Planner."""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator, model_validator


VALID_PLAN_MODES = {"daily", "weekly", "exam", "goal"}
VALID_TASK_TYPES = {
    "study_topic",
    "review_flashcards",
    "take_quiz",
    "visual_review",
    "practice_weak_area"
}
VALID_PRIORITIES = {"critical", "high", "medium", "low"}
VALID_TASK_STATUSES = {"pending", "completed", "skipped", "rescheduled"}
VALID_DAYS = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}


class PlanCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Title of the study plan")
    description: Optional[str] = Field(None, max_length=1000)
    plan_mode: str = Field("daily", description="Mode: daily | weekly | exam | goal")
    target_date: Optional[datetime] = Field(None, description="Target exam date or goal deadline")
    daily_available_minutes: int = Field(60, ge=15, le=480, description="Daily available study time (15-480 min)")
    preferred_days: List[str] = Field(
        default_factory=lambda: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
        description="Active study days"
    )
    focus_session_ids: Optional[List[int]] = Field(default_factory=list, description="Target sessions to plan from")
    focus_topics: Optional[List[str]] = Field(default_factory=list, description="Specific topics to focus on")
    auto_create_reminders: bool = Field(False, description="Automatically schedule reminders via Notification Infrastructure")

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Plan title cannot be empty")
        return s

    @field_validator("plan_mode")
    @classmethod
    def validate_plan_mode(cls, v: str) -> str:
        val = v.strip().lower()
        if val not in VALID_PLAN_MODES:
            raise ValueError(f"plan_mode must be one of {sorted(list(VALID_PLAN_MODES))}")
        return val

    @field_validator("preferred_days")
    @classmethod
    def validate_days(cls, v: List[str]) -> List[str]:
        if not v:
            return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
        cleaned = [d.strip().lower() for d in v if d.strip().lower() in VALID_DAYS]
        return cleaned or ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

    @model_validator(mode="after")
    def check_exam_date(self):
        if self.plan_mode == "exam":
            if not self.target_date:
                raise ValueError("Exam plans require a valid target_date")
            now = datetime.now(timezone.utc)
            td = self.target_date
            if td.tzinfo is not None:
                td = td.astimezone(timezone.utc)
            else:
                td = td.replace(tzinfo=timezone.utc)
            if td <= now:
                raise ValueError("Exam date must be in the future")
        return self


class PlanUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    target_date: Optional[datetime] = None
    daily_available_minutes: Optional[int] = Field(None, ge=15, le=480)
    preferred_days: Optional[List[str]] = None
    status: Optional[str] = None

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            s = v.strip()
            if not s:
                raise ValueError("Plan title cannot be empty")
            return s
        return v


class TaskCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    task_type: str = Field("study_topic", description="study_topic | review_flashcards | take_quiz | visual_review | practice_weak_area")
    session_id: Optional[int] = None
    target_topic: Optional[str] = Field(None, max_length=200)
    priority: str = Field("medium", description="critical | high | medium | low")
    estimated_minutes: int = Field(25, ge=5, le=240)
    scheduled_date: datetime = Field(..., description="Target scheduled datetime")
    auto_create_reminder: bool = Field(False)

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Task title cannot be empty")
        return s

    @field_validator("task_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        val = v.strip().lower()
        if val not in VALID_TASK_TYPES:
            raise ValueError(f"task_type must be one of {sorted(list(VALID_TASK_TYPES))}")
        return val

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        val = v.strip().lower()
        if val not in VALID_PRIORITIES:
            return "medium"
        return val


class TaskUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    priority: Optional[str] = None
    estimated_minutes: Optional[int] = Field(None, ge=5, le=240)
    scheduled_date: Optional[datetime] = None
    status: Optional[str] = None


class StudyPlanTaskResponse(BaseModel):
    id: int
    plan_id: int
    user_id: int
    session_id: Optional[int] = None
    session_title: Optional[str] = None
    title: str
    description: Optional[str] = None
    task_type: str
    target_topic: Optional[str] = None
    priority: str
    priority_score: float
    estimated_minutes: int
    scheduled_date: str
    status: str
    is_user_created: bool
    recommendation_reason: Optional[str] = None
    reason_factors: Dict[str, Any] = Field(default_factory=dict)
    completed_at: Optional[str] = None
    reminder_id: Optional[int] = None
    created_at: str
    updated_at: str


class StudyPlanResponse(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str] = None
    plan_mode: str
    status: str
    target_date: Optional[str] = None
    daily_available_minutes: int
    preferred_days: List[str]
    focus_session_ids: List[int]
    focus_topics: List[str]
    total_tasks: int
    completed_tasks: int
    progress_percent: float
    tasks: List[StudyPlanTaskResponse] = Field(default_factory=list)
    created_at: str
    updated_at: str


class PlanAdaptResponse(BaseModel):
    plan_id: int
    tasks_rescheduled: int
    tasks_reprioritized: int
    message: str
    plan: StudyPlanResponse
