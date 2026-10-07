"""Controlled mistake taxonomy and longitudinal pattern states for Florix AI.

Strict classification guarantees that LLM outputs adhere to vetted pedagogical categories.
Unknown is explicitly preferred over hallucinated or over-confident diagnoses.
"""

from enum import Enum
from typing import Dict, Any


class MistakeCategory(str, Enum):
    """Controlled taxonomy of student academic errors."""
    CONCEPTUAL_MISUNDERSTANDING = "CONCEPTUAL_MISUNDERSTANDING"
    PARTIAL_UNDERSTANDING = "PARTIAL_UNDERSTANDING"
    PROCEDURAL_ERROR = "PROCEDURAL_ERROR"
    CALCULATION_ERROR = "CALCULATION_ERROR"
    CARELESS_ERROR = "CARELESS_ERROR"
    MISREAD_QUESTION = "MISREAD_QUESTION"
    MEMORY_RECALL_FAILURE = "MEMORY_RECALL_FAILURE"
    PREREQUISITE_GAP = "PREREQUISITE_GAP"
    CONFUSION_BETWEEN_CONCEPTS = "CONFUSION_BETWEEN_CONCEPTS"
    INCORRECT_APPLICATION = "INCORRECT_APPLICATION"
    UNKNOWN = "UNKNOWN"


class PatternState(str, Enum):
    """Longitudinal pattern states for recurring error detection."""
    ISOLATED = "ISOLATED"
    RECURRING = "RECURRING"
    PERSISTENT = "PERSISTENT"
    IMPROVING = "IMPROVING"
    RESOLVED = "RESOLVED"


CATEGORY_METADATA: Dict[str, Dict[str, str]] = {
    MistakeCategory.CONCEPTUAL_MISUNDERSTANDING.value: {
        "label": "Conceptual Misunderstanding",
        "description": "Fundamental flaw in theoretical comprehension or definition.",
        "remediation": "Review the core definition and foundational theorems."
    },
    MistakeCategory.PARTIAL_UNDERSTANDING.value: {
        "label": "Partial Understanding",
        "description": "Grasps primary idea but misses specific nuances, boundaries, or constraints.",
        "remediation": "Focus on boundary conditions and exception criteria."
    },
    MistakeCategory.PROCEDURAL_ERROR.value: {
        "label": "Procedural Error",
        "description": "Erred in executing a sequence of steps, algorithm, or methodology.",
        "remediation": "Trace the step-by-step procedure on a worked example."
    },
    MistakeCategory.CALCULATION_ERROR.value: {
        "label": "Calculation Error",
        "description": "Mathematical, numerical, or indexing arithmetic slip.",
        "remediation": "Double-check numerical calculations and unit conversions."
    },
    MistakeCategory.CARELESS_ERROR.value: {
        "label": "Careless Error",
        "description": "Hasty execution or overlooked obvious cues.",
        "remediation": "Read all options and verify every statement before confirming."
    },
    MistakeCategory.MISREAD_QUESTION.value: {
        "label": "Misread Question",
        "description": "Misinterpreted prompt wording (e.g., overlooked NOT, EXCEPT, or FALSE).",
        "remediation": "Highlight qualifying keywords (NOT, ALWAYS, EXCEPT) in questions."
    },
    MistakeCategory.MEMORY_RECALL_FAILURE.value: {
        "label": "Memory Recall Failure",
        "description": "Inability to retrieve memorized facts, terms, or standard nomenclature.",
        "remediation": "Engage in SM-2 active recall flashcard drilling."
    },
    MistakeCategory.PREREQUISITE_GAP.value: {
        "label": "Prerequisite Gap",
        "description": "Lacks necessary foundational knowledge required to understand this topic.",
        "remediation": "Study the prerequisite foundation before continuing with this topic."
    },
    MistakeCategory.CONFUSION_BETWEEN_CONCEPTS.value: {
        "label": "Confusion Between Concepts",
        "description": "Conflated two distinct but related concepts.",
        "remediation": "Compare and contrast both concepts side-by-side."
    },
    MistakeCategory.INCORRECT_APPLICATION.value: {
        "label": "Incorrect Application",
        "description": "Understood theory correctly but applied it to an improper context.",
        "remediation": "Practice applying the theory across diverse problem archetypes."
    },
    MistakeCategory.UNKNOWN.value: {
        "label": "Unknown / Unclassified",
        "description": "Insufficient evidence to classify error definitively.",
        "remediation": "Re-read the study section and verify core principles."
    }
}


def normalize_category(raw_val: str) -> MistakeCategory:
    """Normalizes raw model output to a strictly validated MistakeCategory."""
    if not raw_val:
        return MistakeCategory.UNKNOWN
    clean = str(raw_val).strip().upper().replace(" ", "_").replace("-", "_")
    for cat in MistakeCategory:
        if clean == cat.value:
            return cat
    # Substring / keyword fuzzy match fallback
    if "PREREQUISITE" in clean:
        return MistakeCategory.PREREQUISITE_GAP
    if "CALCULAT" in clean or "ARITHMETIC" in clean:
        return MistakeCategory.CALCULATION_ERROR
    if "PROCEDUR" in clean or "ALGORITHM" in clean:
        return MistakeCategory.PROCEDURAL_ERROR
    if "CONFUS" in clean or "CONFLAT" in clean:
        return MistakeCategory.CONFUSION_BETWEEN_CONCEPTS
    if "MISREAD" in clean:
        return MistakeCategory.MISREAD_QUESTION
    if "CARELESS" in clean:
        return MistakeCategory.CARELESS_ERROR
    if "MEMORY" in clean or "RECALL" in clean:
        return MistakeCategory.MEMORY_RECALL_FAILURE
    if "PARTIAL" in clean:
        return MistakeCategory.PARTIAL_UNDERSTANDING
    if "CONCEPT" in clean:
        return MistakeCategory.CONCEPTUAL_MISUNDERSTANDING
    if "APPLICAT" in clean:
        return MistakeCategory.INCORRECT_APPLICATION
    return MistakeCategory.UNKNOWN
