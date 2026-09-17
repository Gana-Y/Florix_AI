"""
Florix AI — Academic Relevance Reranker & Deduplicator
Filters near-duplicate chunks, rewards academic content-type matches, and selects the
highest-fidelity evidence set for context construction.
Author: Ganesh (Lead Architect)
"""

from typing import List, Set
from .models import RetrievalCandidate, ContentType, QueryIntent


def _jaccard_similarity(text1: str, text2: str) -> float:
    """Computes word-level Jaccard similarity to detect redundant chunks."""
    w1: Set[str] = set(text1.lower().split())
    w2: Set[str] = set(text2.lower().split())
    if not w1 or not w2:
        return 0.0
    intersection = len(w1.intersection(w2))
    union = len(w1.union(w2))
    return intersection / union if union else 0.0


class RelevanceReranker:
    """Reranks and filters candidate chunks for maximum diversity and signal-to-noise ratio."""

    def __init__(self, max_redundancy_threshold: float = 0.70):
        self.redundancy_threshold = max_redundancy_threshold

    def rerank(
        self,
        candidates: List[RetrievalCandidate],
        query: str,
        intent: QueryIntent = QueryIntent.GENERAL,
        top_n: int = 5
    ) -> List[RetrievalCandidate]:
        """
        Reranks candidates:
        1. Boosts candidates matching query intent (e.g. code for coding queries).
        2. Deduplicates overlapping / redundant text.
        3. Returns the Top-N most relevant, diverse chunks.
        """
        if not candidates:
            return []

        # Intent boost
        scored: List[RetrievalCandidate] = []
        for cand in candidates:
            adjusted_score = cand.final_score

            # Boost code chunks for code inquiries
            if intent == QueryIntent.CODE and cand.content_type == ContentType.CODE:
                adjusted_score *= 1.35
            # Boost equations for math/scientific queries
            elif cand.content_type == ContentType.EQUATION:
                adjusted_score *= 1.15
            # Boost definitions for conceptual queries
            elif intent == QueryIntent.CONCEPTUAL and cand.content_type == ContentType.DEFINITION:
                adjusted_score *= 1.25

            cand.final_score = adjusted_score
            scored.append(cand)

        # Sort by adjusted score
        scored.sort(key=lambda c: c.final_score, reverse=True)

        # Diversity & Deduplication filter
        selected: List[RetrievalCandidate] = []
        for cand in scored:
            is_redundant = False
            for existing in selected:
                sim = _jaccard_similarity(cand.text, existing.text)
                if sim >= self.redundancy_threshold:
                    is_redundant = True
                    break
            if not is_redundant:
                selected.append(cand)
            if len(selected) >= top_n:
                break

        return selected
