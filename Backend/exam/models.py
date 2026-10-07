"""Exam / Mock Exam Engine models and schemas."""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class ExamCreateRequest(BaseModel):
    session_id: Optional[int] = None
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    exam_mode: str = Field(default="practice")  # practice | mock | topic | full_syllabus
    difficulty: str = Field(default="intermediate")  # beginner | intermediate | advanced
    duration_minutes: int = Field(default=30, ge=1, le=180)
    passing_percentage: int = Field(default=70, ge=1, le=100)
    num_questions: int = Field(default=10, ge=1, le=50)
    topics: Optional[List[str]] = []


class ExamResponse(BaseModel):
    id: int
    user_id: int
    session_id: Optional[int] = None
    session_title: Optional[str] = None
    title: str
    description: Optional[str] = None
    exam_mode: str
    difficulty: str
    duration_minutes: int
    passing_percentage: int
    total_questions: int
    topics: List[str]
    created_at: str
    updated_at: str
    attempts_count: int = 0
    best_score: Optional[int] = None


class ExamQuestionSanitizedResponse(BaseModel):
    """Sanitized question payload returned during an active exam attempt.
    Withholds correct_answer and explanation to prevent client-side answer leakage.
    """
    id: int
    exam_id: int
    question_order: int
    question_text: str
    question_type: str
    options: List[str]
    topic: str
    difficulty: str


class AnswerItem(BaseModel):
    question_id: int
    user_answer: Optional[int] = None
    is_marked_for_review: Optional[bool] = False
    time_spent_seconds: Optional[int] = 0


class ExamAnswerSaveRequest(BaseModel):
    answers: List[AnswerItem]


class ExamSubmitRequest(BaseModel):
    answers: Optional[List[AnswerItem]] = None


class ExamAttemptResponse(BaseModel):
    """Active attempt representation."""
    id: int
    exam_id: int
    user_id: int
    exam_title: str
    exam_mode: str
    status: str
    started_at: str
    expires_at: Optional[str] = None
    duration_minutes: int
    remaining_seconds: Optional[int] = None
    total_questions: int
    questions: List[ExamQuestionSanitizedResponse]
    saved_answers: Dict[str, Dict[str, Any]] = {}


class ExamQuestionReviewResponse(BaseModel):
    """Full question payload returned after submission with review answers, explanations, and citations."""
    id: int
    question_order: int
    question_text: str
    question_type: str
    options: List[str]
    user_answer: Optional[int] = None
    correct_answer: int
    is_correct: bool
    is_marked_for_review: bool
    explanation: str
    topic: str
    section_heading: Optional[str] = None
    page_number: Optional[int] = None
    source_chunk_id: Optional[str] = None
    difficulty: str


class ExamAttemptReviewResponse(BaseModel):
    """Full graded attempt result."""
    id: int
    exam_id: int
    exam_title: str
    exam_mode: str
    status: str
    started_at: str
    completed_at: Optional[str] = None
    score: int
    total_questions: int
    percentage: int
    passed: bool
    time_taken_seconds: int
    topic_scores: Dict[str, Any]
    questions: List[ExamQuestionReviewResponse]
    mistakes: List[ExamQuestionReviewResponse]
    recommended_actions: List[str]
