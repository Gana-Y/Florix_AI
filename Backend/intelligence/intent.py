"""
Phase 3 Query & Intent Engine
Deterministic, rule-based classification of learning intents and pedagogical teaching modes.
Zero LLM latency overhead for high-frequency user interactions.
"""

import re
from typing import Tuple, Optional
from .models import LearningIntent, TeachingMode


class IntentClassifier:
    """
    Deterministic academic intent and teaching mode classifier.
    Prioritizes fast regex matching to control token cost and response latency.
    """

    # Intent regex patterns
    PATTERNS = [
        # QUIZ
        (
            LearningIntent.QUIZ,
            re.compile(r"\b(quiz me|give me (?:\d+|some)?\s*questions?|practice questions?|test my knowledge|test me|generate a test|mcqs?|ask me questions?)\b", re.IGNORECASE)
        ),
        # FLASHCARD
        (
            LearningIntent.FLASHCARD,
            re.compile(r"\b(flashcards?|make cards|create flashcards|study cards|anki cards|cards on)\b", re.IGNORECASE)
        ),
        # SUMMARIZE
        (
            LearningIntent.SUMMARIZE,
            re.compile(r"\b(summarize|summary of|tldr|tl;dr|key takeaways|quick recap|give me an overview of|condense)\b", re.IGNORECASE)
        ),
        # COMPARE
        (
            LearningIntent.COMPARE,
            re.compile(r"\b(compare|difference between|differences between|vs\.?|versus|similarities between|contrast|distinguish between)\b", re.IGNORECASE)
        ),
        # DEFINE
        (
            LearningIntent.DEFINE,
            re.compile(r"^\s*(?:what is|what are|define|definition of|meaning of|what does .+ mean)\b", re.IGNORECASE)
        ),
        # PROCEDURE
        (
            LearningIntent.PROCEDURE,
            re.compile(r"\b(how to|steps to|step-by-step|procedure for|walk me through|algorithm for|process of)\b", re.IGNORECASE)
        ),
        # SOLVE
        (
            LearningIntent.SOLVE,
            re.compile(r"\b(solve|calculate|compute|find the value|evaluate the integral|derivative of|work out)\b", re.IGNORECASE)
        ),
        # DEBUG
        (
            LearningIntent.DEBUG,
            re.compile(r"\b(debug|fix this code|why is this error|traceback|exception in|fix the bug|syntax error)\b", re.IGNORECASE)
        ),
        # EXAM PREPARATION
        (
            LearningIntent.EXAM_PREPARATION,
            re.compile(r"\b(exam questions?|prepare for (?:my |the )?exam|exam tomorrow|expected questions|marking scheme|high-yield)\b", re.IGNORECASE)
        ),
        # REVISION
        (
            LearningIntent.REVISION,
            re.compile(r"\b(revise|revision|quick review|cram|brush up on|refresh my memory)\b", re.IGNORECASE)
        ),
        # DEEP DIVE
        (
            LearningIntent.DEEP_DIVE,
            re.compile(r"\b(deep dive|under the hood|internal mechanism|internals of|low-level details|in-depth architecture)\b", re.IGNORECASE)
        ),
        # CLARIFICATION
        (
            LearningIntent.CLARIFICATION,
            re.compile(r"\b(i got .*wrong|why did i get .*wrong|i don't understand|clarify|what do you mean by)\b", re.IGNORECASE)
        ),
        # EXAMPLE
        (
            LearningIntent.EXAMPLE,
            re.compile(r"\b(give me an? example|show an? example|illustrate with an example|sample of|concrete use case)\b", re.IGNORECASE)
        ),
        # OUT_OF_SCOPE
        (
            LearningIntent.OUT_OF_SCOPE,
            re.compile(r"\b(write a (?:poem|song|story|rap)|tell me a joke|recipe for|weather in|who won the (?:world cup|match|game)|ignore previous instructions)\b", re.IGNORECASE)
        ),
    ]

    # Teaching Mode patterns
    MODE_PATTERNS = [
        (TeachingMode.BEGINNER, re.compile(r"\b(like i['’]m (?:5|a beginner|five|a child)|beginner|eli5|simple explanation|plain english|dummy|easy to understand)\b", re.IGNORECASE)),
        (TeachingMode.REVISION, re.compile(r"\b(quick review|revision notes|cheat sheet|bullet points only|quick recap|cram|brush up on)\b", re.IGNORECASE)),
        (TeachingMode.EXAM, re.compile(r"\b(exam|test tomorrow|midterm|finals|marking scheme|for (?:my |the )?exam|scoring rubric)\b", re.IGNORECASE)),
        (TeachingMode.ADVANCED, re.compile(r"\b(advanced|deep dive|under the hood|internals|edge cases|mathematical proof|formal specification|rigorous)\b", re.IGNORECASE)),
        (TeachingMode.INTERVIEW, re.compile(r"\b(interview|mock interview|system design interview|coding interview|faang)\b", re.IGNORECASE)),
    ]

    @classmethod
    def classify(cls, query: str, default_mode: Optional[TeachingMode] = None) -> Tuple[LearningIntent, TeachingMode]:
        """
        Classifies user query into (LearningIntent, TeachingMode).
        """
        clean_q = query.strip()
        if not clean_q:
            return LearningIntent.EXPLAIN, TeachingMode.INTERMEDIATE

        # 1. Detect Intent
        detected_intent = LearningIntent.EXPLAIN  # Default
        for intent, pattern in cls.PATTERNS:
            if pattern.search(clean_q):
                detected_intent = intent
                break

        # 2. Detect Teaching Mode
        detected_mode = default_mode or TeachingMode.INTERMEDIATE
        for mode, pattern in cls.MODE_PATTERNS:
            if pattern.search(clean_q):
                detected_mode = mode
                break

        # Coupling adjustments
        if detected_intent == LearningIntent.REVISION:
            detected_mode = TeachingMode.REVISION
        elif detected_intent == LearningIntent.EXAM_PREPARATION and detected_mode != TeachingMode.BEGINNER:
            detected_mode = TeachingMode.EXAM
        elif detected_intent == LearningIntent.DEEP_DIVE and detected_mode == TeachingMode.INTERMEDIATE:
            detected_mode = TeachingMode.ADVANCED

        return detected_intent, detected_mode


def detect_learning_intent(query: str, default_mode: Optional[TeachingMode] = None) -> Tuple[LearningIntent, TeachingMode]:
    """Convenience functional wrapper for intent classification."""
    return IntentClassifier.classify(query, default_mode=default_mode)
