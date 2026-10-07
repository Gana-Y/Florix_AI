"""Exam / Mock Exam Engine package."""

from .models import (
    ExamCreateRequest,
    ExamResponse,
    ExamQuestionSanitizedResponse,
    AnswerItem,
    ExamAnswerSaveRequest,
    ExamSubmitRequest,
    ExamAttemptResponse,
    ExamQuestionReviewResponse,
    ExamAttemptReviewResponse,
)
from .service import ExamService
from .scoring import (
    evaluate_answer,
    calculate_topic_performance,
    generate_recommended_actions,
)

__all__ = [
    "ExamCreateRequest",
    "ExamResponse",
    "ExamQuestionSanitizedResponse",
    "AnswerItem",
    "ExamAnswerSaveRequest",
    "ExamSubmitRequest",
    "ExamAttemptResponse",
    "ExamQuestionReviewResponse",
    "ExamAttemptReviewResponse",
    "ExamService",
    "evaluate_answer",
    "calculate_topic_performance",
    "generate_recommended_actions",
]
