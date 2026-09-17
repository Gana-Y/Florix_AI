"""
Florix AI Phase 3 Intelligence Layer
Adaptive academic study system, deterministic intent classification,
pedagogical scaffolding, grounded assessments, and explainable learner modeling.
"""

from .models import (
    LearningIntent,
    TeachingMode,
    QuestionType,
    GroundedQuizQuestion,
    GroundedFlashcard,
    TopicMasteryRecord,
    IntelligenceResponse
)
from .intent import IntentClassifier, detect_learning_intent
from .teaching import TeachingEngine
from .assessment import AssessmentEngine
from .learner import LearnerEngine
from .validators import GroundingValidator
from .orchestrator import IntelligenceOrchestrator

__all__ = [
    "LearningIntent",
    "TeachingMode",
    "QuestionType",
    "GroundedQuizQuestion",
    "GroundedFlashcard",
    "TopicMasteryRecord",
    "IntelligenceResponse",
    "IntentClassifier",
    "detect_learning_intent",
    "TeachingEngine",
    "AssessmentEngine",
    "LearnerEngine",
    "GroundingValidator",
    "IntelligenceOrchestrator"
]
