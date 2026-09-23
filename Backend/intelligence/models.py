"""
Phase 3 Intelligence Layer — Data Models & Schemas
Strongly typed Enums and Pydantic models for intent, pedagogy, assessments, and mastery.
"""

from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class LearningIntent(str, Enum):
    EXPLAIN = "EXPLAIN"
    DEFINE = "DEFINE"
    SUMMARIZE = "SUMMARIZE"
    COMPARE = "COMPARE"
    EXAMPLE = "EXAMPLE"
    PROCEDURE = "PROCEDURE"
    SOLVE = "SOLVE"
    DEBUG = "DEBUG"
    QUIZ = "QUIZ"
    FLASHCARD = "FLASHCARD"
    REVISION = "REVISION"
    EXAM_PREPARATION = "EXAM_PREPARATION"
    DEEP_DIVE = "DEEP_DIVE"
    CLARIFICATION = "CLARIFICATION"
    OUT_OF_SCOPE = "OUT_OF_SCOPE"


class TeachingMode(str, Enum):
    BEGINNER = "BEGINNER"
    INTERMEDIATE = "INTERMEDIATE"
    ADVANCED = "ADVANCED"
    EXAM = "EXAM"
    INTERVIEW = "INTERVIEW"
    REVISION = "REVISION"


class QuestionType(str, Enum):
    MCQ = "MCQ"
    TRUE_FALSE = "TRUE_FALSE"
    SHORT_ANSWER = "SHORT_ANSWER"
    CONCEPTUAL = "CONCEPTUAL"
    CODE = "CODE"
    NUMERICAL = "NUMERICAL"


class GroundedQuizQuestion(BaseModel):
    """
    Evidence-grounded assessment question.
    Backward-compatible with existing frontend: includes question, options, answer (int), explanation.
    """
    question: str
    options: List[str]
    answer: int = Field(ge=0, description="0-based index of correct option")
    explanation: str
    question_type: QuestionType = QuestionType.MCQ
    difficulty: str = "intermediate"  # beginner | intermediate | advanced
    topic: Optional[str] = None
    source_chunk_id: Optional[str] = None
    page_number: Optional[int] = None
    section_heading: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return self.model_dump()


class GroundedFlashcard(BaseModel):
    """
    Evidence-grounded study flashcard.
    Backward-compatible with existing frontend: includes front, back.
    """
    front: str
    back: str
    topic: Optional[str] = None
    difficulty: str = "intermediate"  # beginner | intermediate | advanced
    source_chunk_id: Optional[str] = None
    page_number: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return self.model_dump()


class TopicMasteryRecord(BaseModel):
    """
    Explainable learner topic mastery state.
    """
    topic: str
    mastery_score: float = Field(ge=0.0, le=1.0, description="Deterministic mastery score from 0.0 to 1.0")
    attempts: int = 0
    correct: int = 0
    weak_subtopics: List[str] = []
    last_reviewed: Optional[str] = None
    status: str = "learning"  # mastered | review_needed | learning | struggling

    def to_dict(self) -> Dict[str, Any]:
        return self.model_dump()


class IntelligenceResponse(BaseModel):
    """
    Final validated response from Phase 3 Intelligence Layer.
    """
    reply: str
    intent: LearningIntent
    teaching_mode: TeachingMode
    citations: List[Dict[str, Any]] = []
    is_grounded: bool = True
    sources_used: int = 0
    confidence_level: str = "HIGH"  # HIGH | MEDIUM | LOW | NO_EVIDENCE
    warnings: List[str] = []

    def to_dict(self) -> Dict[str, Any]:
        return self.model_dump()
