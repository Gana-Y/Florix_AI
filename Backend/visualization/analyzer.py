"""
Florix AI — Phase 5 Visual Readiness Analyzer
Deterministic pre-generation content evaluation.
Evaluates semantic density, academic conceptual content, noise, and modality constraints.
Author: Ganesh (Lead Architect) & Aria
"""

import re
from typing import List, Dict, Any, Optional, Tuple
from .models import VisualReadinessStatus, ReadinessAnalysis, VisualType


# Common English stopwords to compute information/semantic density
STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "because", "as", "what", "which",
    "this", "that", "these", "those", "then", "just", "so", "than", "such",
    "both", "through", "about", "for", "is", "of", "while", "during", "to", "from",
    "in", "out", "on", "off", "again", "further", "then", "once", "here", "there",
    "when", "where", "why", "how", "all", "any", "each", "few", "more", "most",
    "other", "some", "no", "nor", "not", "only", "own", "same", "so", "too", "very",
    "can", "will", "don", "should", "now", "i", "you", "he", "she", "it", "we", "they"
}

# Academic concept keywords that indicate semantic substance even in short snippets
ACADEMIC_SIGNALS = {
    "algorithm", "array", "binary", "search", "tree", "graph", "sorting", "complexity",
    "memory", "cpu", "process", "thread", "database", "sql", "entropy", "enthalpy",
    "molecule", "cell", "protein", "dna", "matrix", "vector", "function", "derivative",
    "integral", "theorem", "law", "system", "architecture", "protocol", "network",
    "equation", "state", "variable", "constant", "quantum", "physics", "chemistry",
    "biology", "analysis", "synthesis", "definition", "principle", "mechanism", "structure"
}

# Patterns indicating specific visual archetypes
PROCESS_PATTERNS = [
    r"\b(?:first|second|third|then|next|subsequently|finally|afterwards)\b",
    r"\b(?:step \d|phase \d|stage \d)\b",
    r"\b(?:algorithm|procedure|pipeline|lifecycle|workflow)\b"
]

COMPARISON_PATTERNS = [
    r"\b(?:versus|vs\.?|differ(?:s|ence|ences)?|contrasting|contrasted|compared to|on the other hand|whereas|while)\b",
    r"\b(?:pros and cons|advantages and disadvantages|similarities and differences)\b"
]

TIMELINE_PATTERNS = [
    r"\b(?:in \d{4}|century|bce|ce|era|period|chronolog(?:y|ical)|timeline|history of)\b",
    r"\b(?:\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})\b"  # Video timestamp spans
]

HIERARCHY_PATTERNS = [
    r"\b(?:classified into|types of|subtypes|categories of|branches of|hierarchy|subdivisions)\b",
    r"\b(?:parent|child|ancestor|descendant|taxonomy)\b"
]


class VisualReadinessAnalyzer:
    """
    Rigorously analyzes input text and session state before attempting visual generation.
    Enforces a strict 'Never fabricate on empty evidence' policy.
    """

    @classmethod
    def analyze_content(
        cls,
        text: Optional[str],
        visual_type: VisualType = VisualType.CONCEPT_MAP,
        source_type: str = "text"
    ) -> ReadinessAnalysis:
        """
        Deterministically evaluates whether the provided text contains sufficient
        academic concepts and structure to generate a reliable visual.
        """
        analysis = cls.analyze_text(text or "", source_type=source_type)
        if visual_type != VisualType.AUTO and analysis.can_generate:
            analysis.suggested_visual_type = visual_type
        return analysis

    @classmethod
    def analyze_text(cls, text: str, source_type: str = "text") -> ReadinessAnalysis:
        """
        Deterministically evaluates whether the provided text contains sufficient
        academic concepts and structure to generate a reliable visual.
        """
        if not text or not isinstance(text, str):
            return ReadinessAnalysis(
                status=VisualReadinessStatus.UNAVAILABLE,
                message="No content was provided for visual analysis.",
                can_generate=False,
                suggested_visual_type=VisualType.CONCEPT_MAP,
                word_count=0
            )

        clean_text = text.strip()

        # 1. Check for pure whitespace or empty
        if not clean_text:
            return ReadinessAnalysis(
                status=VisualReadinessStatus.UNAVAILABLE,
                message="The provided text is empty or contains only whitespace.",
                can_generate=False,
                suggested_visual_type=VisualType.CONCEPT_MAP,
                word_count=0
            )

        # 2. Check for punctuation/symbols-only (e.g. ",,,,,,,,,,,", ".......", "!@#$%")
        non_punct = re.sub(r"[^\w\s]", "", clean_text)
        if not non_punct.strip():
            return ReadinessAnalysis(
                status=VisualReadinessStatus.INSUFFICIENT,
                message="The provided text contains only punctuation or symbols without academic concepts.",
                can_generate=False,
                suggested_visual_type=VisualType.CONCEPT_MAP,
                word_count=0
            )

        # 3. Check for pure numbers/digits-only (e.g. "123456789")
        words = clean_text.split()
        num_words = len(words)
        alpha_words = [w for w in words if any(c.isalpha() for c in w)]
        if not alpha_words:
            return ReadinessAnalysis(
                status=VisualReadinessStatus.INSUFFICIENT,
                message="The text contains only numbers or raw symbols without semantic concepts.",
                can_generate=False,
                suggested_visual_type=VisualType.CONCEPT_MAP,
                word_count=num_words
            )

        # 4. Check for keyboard mash / gibberish (e.g. "asdfghjkl", "qwertyuiop")
        vowels = set("aeiouyAEIOU")
        meaningful_tokens = []
        for w in alpha_words:
            cleaned_word = re.sub(r"[^\w]", "", w)
            has_vowel = any(c in vowels for c in cleaned_word)
            # Long consonants-only word is likely mash
            if len(cleaned_word) > 4 and not has_vowel:
                continue
            meaningful_tokens.append(cleaned_word.lower())

        if not meaningful_tokens:
            return ReadinessAnalysis(
                status=VisualReadinessStatus.INSUFFICIENT,
                message="The provided content appears to be unintelligible or noise.",
                can_generate=False,
                suggested_visual_type=VisualType.CONCEPT_MAP,
                word_count=num_words
            )

        # 5. Extract prospective concept keywords (capitalized words, non-stopwords > 3 chars)
        content_words = [t for t in meaningful_tokens if t not in STOPWORDS and len(t) > 2]
        unique_concepts = list(dict.fromkeys(
            [t.title() for t in content_words if t in ACADEMIC_SIGNALS or len(t) > 4]
        ))

        # Check for presence of verified academic signals
        has_academic_signal = any(t in ACADEMIC_SIGNALS for t in content_words)

        # Compute semantic density
        semantic_density = len(content_words) / max(1, num_words)

        # Determine suggested visual archetype
        suggested_type = cls.infer_visual_type(clean_text)

        # Single generic word case (e.g. "hello", "java", "os")
        if num_words <= 2 and not has_academic_signal:
            return ReadinessAnalysis(
                status=VisualReadinessStatus.INSUFFICIENT,
                message=f"'{clean_text}' is too brief on its own to form a grounded visual without surrounding context.",
                can_generate=False,
                detected_concepts=unique_concepts[:3],
                suggested_visual_type=suggested_type,
                semantic_density_score=round(semantic_density, 2),
                word_count=num_words
            )

        # A concise but meaningful academic statement (e.g., "Binary search divides a sorted array into halves.")
        if num_words < 12:
            if has_academic_signal or len(unique_concepts) >= 2:
                return ReadinessAnalysis(
                    status=VisualReadinessStatus.LIMITED,
                    message="Concise academic snippet detected. A focused, atomic visual map can be generated.",
                    can_generate=True,
                    detected_concepts=unique_concepts[:5],
                    suggested_visual_type=suggested_type,
                    semantic_density_score=round(semantic_density, 2),
                    word_count=num_words
                )
            else:
                return ReadinessAnalysis(
                    status=VisualReadinessStatus.INSUFFICIENT,
                    message="Snippet contains too few distinct academic concepts to construct a connected diagram.",
                    can_generate=False,
                    detected_concepts=unique_concepts[:3],
                    suggested_visual_type=suggested_type,
                    semantic_density_score=round(semantic_density, 2),
                    word_count=num_words
                )

        # Moderate content (12 - 40 words)
        if num_words <= 40:
            if len(unique_concepts) >= 2 or has_academic_signal:
                return ReadinessAnalysis(
                    status=VisualReadinessStatus.LIMITED,
                    message="Sufficient content detected for a compact concept map or process diagram.",
                    can_generate=True,
                    detected_concepts=unique_concepts[:6],
                    suggested_visual_type=suggested_type,
                    semantic_density_score=round(semantic_density, 2),
                    word_count=num_words
                )
            else:
                return ReadinessAnalysis(
                    status=VisualReadinessStatus.INSUFFICIENT,
                    message="Text contains low conceptual density. We recommend selecting a more detailed section.",
                    can_generate=False,
                    detected_concepts=unique_concepts[:3],
                    suggested_visual_type=suggested_type,
                    semantic_density_score=round(semantic_density, 2),
                    word_count=num_words
                )

        # Rich academic content (> 40 words)
        return ReadinessAnalysis(
            status=VisualReadinessStatus.READY,
            message="Rich grounded academic content detected. Full concept mapping is available.",
            can_generate=True,
            detected_concepts=unique_concepts[:10],
            suggested_visual_type=suggested_type,
            semantic_density_score=round(semantic_density, 2),
            word_count=num_words
        )

    @classmethod
    def infer_visual_type(cls, text: str) -> VisualType:
        """
        Determines the most appropriate visual archetype from text syntax and semantic markers.
        """
        lower = text.lower()

        # Check comparison first
        for pat in COMPARISON_PATTERNS:
            if re.search(pat, lower):
                return VisualType.COMPARISON

        # Check process / sequence
        for pat in PROCESS_PATTERNS:
            if re.search(pat, lower):
                return VisualType.PROCESS

        # Check timeline
        for pat in TIMELINE_PATTERNS:
            if re.search(pat, lower):
                return VisualType.TIMELINE

        # Check hierarchy
        for pat in HIERARCHY_PATTERNS:
            if re.search(pat, lower):
                return VisualType.HIERARCHY

        return VisualType.CONCEPT_MAP

    @classmethod
    def analyze_session(cls, session: Any) -> ReadinessAnalysis:
        """
        Evaluates a complete StudySession for visual learning capability.
        Accounts for source type and extraction status.
        """
        if not session:
            return ReadinessAnalysis(
                status=VisualReadinessStatus.ERROR,
                message="Study session could not be retrieved.",
                can_generate=False
            )

        # Check processing status
        status = getattr(session, "processing_status", "READY")
        if status in ["FAILED", "ERROR"]:
            return ReadinessAnalysis(
                status=VisualReadinessStatus.UNAVAILABLE,
                message=f"Document ingestion failed: {getattr(session, 'processing_error', 'Extraction error')}. You can still create a visual manually.",
                can_generate=False
            )

        if status not in ["READY", None]:
            return ReadinessAnalysis(
                status=VisualReadinessStatus.LIMITED,
                message=f"Document is currently {status.lower()}. Visualization will be optimal once processing completes.",
                can_generate=False
            )

        source_type = getattr(session, "source_type", "text")
        content = (getattr(session, "content", "") or "").strip()
        summary = (getattr(session, "summary", "") or "").strip()

        # Audio/Video with no transcript
        if source_type in ["audio", "video", "youtube"] and not content:
            return ReadinessAnalysis(
                status=VisualReadinessStatus.UNAVAILABLE,
                message="No spoken transcript is available for this media. You can create a visual manually or enter notes.",
                can_generate=False
            )

        # Use content if available, else summary
        sample_text = content[:5000] if content else summary[:3000]

        return cls.analyze_text(sample_text, source_type=source_type)
