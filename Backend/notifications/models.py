"""Pydantic schemas for Revision Notification & Reminder Infrastructure."""

from datetime import datetime, timezone
import re
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator, model_validator


VALID_TARGET_TYPES = {"session", "flashcard", "quiz", "visual", "topic"}
VALID_RECURRENCES = {"once", "daily", "weekly"}
VALID_STATUSES = {"pending", "due", "notified", "opened", "completed", "snoozed", "dismissed"}


class ReminderCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Title of reminder")
    message: Optional[str] = Field(None, max_length=1000, description="Optional description or details")
    scheduled_at: datetime = Field(..., description="Target ISO datetime to remind")
    session_id: Optional[int] = Field(None, description="Optional associated study session ID")
    target_type: Optional[str] = Field("session", description="Type of learning target: session, flashcard, quiz, visual, topic")
    target_reference: Optional[str] = Field(None, max_length=200, description="Reference metadata (e.g. card index, topic name, visual ID)")
    recurrence: Optional[str] = Field("once", description="Recurrence: once, daily, weekly")

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Title cannot be blank")
        return s

    @field_validator("target_type")
    @classmethod
    def validate_target_type(cls, v: Optional[str]) -> str:
        if not v:
            return "session"
        val = v.strip().lower()
        if val not in VALID_TARGET_TYPES:
            raise ValueError(f"target_type must be one of: {sorted(list(VALID_TARGET_TYPES))}")
        return val

    @field_validator("recurrence")
    @classmethod
    def validate_recurrence(cls, v: Optional[str]) -> str:
        if not v:
            return "once"
        val = v.strip().lower()
        if val not in VALID_RECURRENCES:
            raise ValueError(f"recurrence must be one of: {sorted(list(VALID_RECURRENCES))}")
        return val


class ReminderUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    message: Optional[str] = Field(None, max_length=1000)
    scheduled_at: Optional[datetime] = None
    target_type: Optional[str] = None
    target_reference: Optional[str] = None
    recurrence: Optional[str] = None
    is_read: Optional[bool] = None

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            s = v.strip()
            if not s:
                raise ValueError("Title cannot be blank")
            return s
        return v

    @field_validator("target_type")
    @classmethod
    def validate_target_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            val = v.strip().lower()
            if val not in VALID_TARGET_TYPES:
                raise ValueError(f"target_type must be one of: {sorted(list(VALID_TARGET_TYPES))}")
            return val
        return v

    @field_validator("recurrence")
    @classmethod
    def validate_recurrence(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            val = v.strip().lower()
            if val not in VALID_RECURRENCES:
                raise ValueError(f"recurrence must be one of: {sorted(list(VALID_RECURRENCES))}")
            return val
        return v


class SnoozeRequest(BaseModel):
    minutes: Optional[int] = Field(None, ge=1, le=43200, description="Minutes to snooze (1 to 30 days)")
    until: Optional[datetime] = Field(None, description="Explicit future ISO datetime until which to snooze")

    @model_validator(mode="after")
    def validate_snooze_parameters(self):
        if self.minutes is None and self.until is None:
            raise ValueError("Must provide either 'minutes' or 'until' for snooze.")
        return self


class NotificationPreferenceUpdate(BaseModel):
    browser_notifications_enabled: Optional[bool] = None
    sm2_auto_reminders: Optional[bool] = None
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None

    @field_validator("quiet_hours_start", "quiet_hours_end")
    @classmethod
    def validate_time_format(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not re.match(r"^([01]\d|2[0-3]):[0-5]\d$", v):
                raise ValueError("Time must be in 24-hour HH:MM format (e.g. 22:00 or 08:30)")
        return v


class NotificationPreferenceResponse(BaseModel):
    browser_notifications_enabled: bool = True
    sm2_auto_reminders: bool = True
    quiet_hours_enabled: bool = False
    quiet_hours_start: str = "22:00"
    quiet_hours_end: str = "08:00"


class ReminderResponse(BaseModel):
    id: int
    user_id: int
    session_id: Optional[int] = None
    session_title: Optional[str] = None
    title: str
    message: Optional[str] = None
    reminder_type: str
    target_type: str
    target_reference: Optional[str] = None
    scheduled_at: datetime
    snoozed_until: Optional[datetime] = None
    status: str
    recurrence: str
    is_read: bool
    is_due: bool = False
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None


class NotificationCenterResponse(BaseModel):
    due_reminders: List[ReminderResponse]
    upcoming_reminders: List[ReminderResponse]
    recent_history: List[ReminderResponse]
    counts: Dict[str, int]
    quiet_hours_active: bool = False
    preferences: NotificationPreferenceResponse
