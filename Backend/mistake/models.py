"""Pydantic schemas and DTOs for Mistake Intelligence & Metacognitive Debugger."""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class CitationItem(BaseModel):
    chunk_index: Optional[int] = None
    page_number: Optional[int] = None
    section_heading: Optional[str] = None
    snippet: Optional[str] = None


class MistakeAnalyzeRequest(BaseModel):
    question_text: str = Field(..., min_length=3, description="Text of the assessment question")
    options: Optional[List[str]] = Field(default_factory=list, description="List of MCQ options")
    user_answer: Any = Field(..., description="The learner's submitted answer (text or option index)")
    correct_answer: Any = Field(..., description="The correct answer (text or option index)")
    topic: Optional[str] = Field("General", description="Subject or topic area")
    subtopic: Optional[str] = Field(None, description="Granular module or section name")
    difficulty: Optional[str] = Field("intermediate", description="beginner | intermediate | advanced")
    session_id: Optional[int] = Field(None, description="Associated study session ID")
    section_heading: Optional[str] = Field(None, description="Originating document heading")
    page_number: Optional[int] = Field(None, description="Page number if paginated")
    source_type: Optional[str] = Field("quiz", description="'quiz' | 'exam' | 'manual'")
    source_id: Optional[int] = Field(None, description="ID of the quiz result or exam attempt")
    teaching_mode: Optional[str] = Field("INTERMEDIATE", description="Teaching mode: BEGINNER | INTERMEDIATE | ADVANCED | EXAM | INTERVIEW | REVISION")
    persist: Optional[bool] = Field(True, description="Whether to persist as a MistakeRecord")


class MistakeAnalysisResponse(BaseModel):
    id: Optional[int] = None
    session_id: Optional[int] = None
    question_text: str
    user_answer: str
    correct_answer: str
    topic: str
    subtopic: Optional[str] = None
    error_category: str
    category_label: str
    misconception: Optional[str] = None
    why_incorrect: str
    correct_reasoning: str
    prerequisite_concept: Optional[str] = None
    pattern_state: str  # ISOLATED | RECURRING | PERSISTENT | IMPROVING | RESOLVED
    is_resolved: bool = False
    citations: List[CitationItem] = []
    teaching_mode: str = "INTERMEDIATE"
    recommended_remediation: str
    created_at: Optional[str] = None


class TargetedPracticeRequest(BaseModel):
    num_questions: int = Field(default=3, ge=1, le=10, description="Number of practice questions (1-10)")
    difficulty: Optional[str] = Field("intermediate", description="Target difficulty")


class PracticeQuestionItem(BaseModel):
    question_order: int
    question_text: str
    options: List[str]
    topic: str
    difficulty: str


class TargetedPracticeResponse(BaseModel):
    mistake_id: int
    topic: str
    prerequisite_concept: Optional[str] = None
    review_summary: str
    questions: List[PracticeQuestionItem]


class PracticeAnswerItem(BaseModel):
    question_order: int
    user_answer: int


class PracticeSubmitRequest(BaseModel):
    answers: List[PracticeAnswerItem]


class PracticeGradedItem(BaseModel):
    question_order: int
    question_text: str
    options: List[str]
    user_answer: int
    correct_answer: int
    is_correct: bool
    explanation: str


class PracticeResultResponse(BaseModel):
    mistake_id: int
    score: int
    total_questions: int
    percentage: int
    passed: bool
    pattern_state: str
    is_resolved: bool
    feedback: str
    graded_questions: List[PracticeGradedItem]
