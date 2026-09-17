"""
Phase 3 Grounding & Citation Validation Layer
Verifies citation indices, strips hallucinated citation references,
and prevents hallucinated responses when evidence is missing.
"""

import re
import logging
from typing import List, Dict, Any, Tuple, Optional

logger = logging.getLogger(__name__)


class GroundingValidator:
    """
    Validates grounded LLM answers and post-processes citations.
    """

    @staticmethod
    def validate_and_clean_citations(
        reply: str,
        available_citations: List[Any]
    ) -> Tuple[str, List[int], List[str]]:
        """
        Scans reply for citation brackets (e.g. [1], [2], [99]).
        - Validates that the index exists in available_citations (1-indexed).
        - Strips hallucinated/out-of-bounds citation indices.
        - Returns (cleaned_reply, valid_indices_used, warnings).
        """
        if not available_citations:
            # If no citations were provided, strip all bracketed citation numbers
            cleaned = re.sub(r"\[\s*\d+\s*\]", "", reply)
            # Clean up potential double spaces left behind
            cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()
            return cleaned, [], ["No citations provided; all bracketed numbers stripped."]

        max_valid_idx = len(available_citations)
        valid_indices = set()
        warnings = []

        def replace_citation(match: re.Match) -> str:
            full_match = match.group(0)
            inner = match.group(1).strip()
            try:
                idx = int(inner)
                if 1 <= idx <= max_valid_idx:
                    valid_indices.add(idx)
                    return f"[{idx}]"
                else:
                    warnings.append(f"Stripped out-of-bounds citation index [{idx}] (max valid: {max_valid_idx})")
                    return ""
            except ValueError:
                return full_match

        # Matches [1], [ 2 ], [12], etc.
        cleaned_reply = re.sub(r"\[\s*(\d+)\s*\]", replace_citation, reply)
        # Clean double spaces
        cleaned_reply = re.sub(r"  +", " ", cleaned_reply).strip()

        return cleaned_reply, sorted(list(valid_indices)), warnings

    @staticmethod
    def check_evidence_sufficiency(
        query: str,
        retrieved_chunks: List[Any],
        min_relevance_score: float = 0.01
    ) -> Tuple[bool, Optional[str]]:
        """
        Determines if retrieved evidence is sufficient to ground the query.
        Returns (is_sufficient, fallback_message).
        """
        if not retrieved_chunks:
            return (
                False,
                "The uploaded study material does not contain sufficient information to answer this question. "
                "Please verify that your document covers this topic or ask a question related to the uploaded content."
            )

        # Check if chunks contain actual text
        has_content = False
        for c in retrieved_chunks:
            txt = c.get("text_content", "") if isinstance(c, dict) else getattr(c, "text", "")
            if len(txt.strip()) > 30:
                has_content = True
                break

        if not has_content:
            return (
                False,
                "The uploaded study material does not contain sufficient text for this topic."
            )

        return True, None
