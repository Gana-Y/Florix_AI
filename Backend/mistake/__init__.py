"""
Mistake Intelligence / Metacognitive Debugger Package.
Provides deep error taxonomy classification, misconception diagnosis,
prerequisite concept discovery, and grounded targeted practice generation.
"""

from .taxonomy import (
    MistakeCategory,
    PatternState,
    CATEGORY_METADATA,
    normalize_category,
)
from .models import (
    CitationItem,
    MistakeAnalyzeRequest,
    MistakeAnalysisResponse,
    TargetedPracticeRequest,
    PracticeQuestionItem,
    TargetedPracticeResponse,
    PracticeAnswerItem,
    PracticeSubmitRequest,
    PracticeGradedItem,
    PracticeResultResponse,
)
from .analyzer import MistakeAnalyzer
from .service import MistakeService

__all__ = [
    "MistakeCategory",
    "PatternState",
    "CATEGORY_METADATA",
    "normalize_category",
    "CitationItem",
    "MistakeAnalyzeRequest",
    "MistakeAnalysisResponse",
    "TargetedPracticeRequest",
    "PracticeQuestionItem",
    "TargetedPracticeResponse",
    "PracticeAnswerItem",
    "PracticeSubmitRequest",
    "PracticeGradedItem",
    "PracticeResultResponse",
    "MistakeAnalyzer",
    "MistakeService",
]
