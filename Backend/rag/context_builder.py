"""
Florix AI — Structured Context Builder
Assembles retrieved academic evidence into structured context with explicit source markers,
enabling precise claim attribution and authoritative citations.
Author: Ganesh (Lead Architect)
"""

from typing import List, Tuple
from .models import RetrievalCandidate, Citation


class ContextBuilder:
    """Constructs structured evidence blocks with source attribution maps."""

    @staticmethod
    def build_context(
        candidates: List[RetrievalCandidate],
        max_context_chars: int = 12000
    ) -> Tuple[str, List[Citation]]:
        """
        Assembles candidates into structured source blocks:
        [SOURCE 1: Document "...", Page X, Section "..."]
        ...

        Returns:
            context_string: Formatted string ready for LLM prompt injection.
            citations: List of authoritative Citation objects mapping to source indices.
        """
        if not candidates:
            return "", []

        source_blocks: List[str] = []
        citations: List[Citation] = []
        current_chars = 0

        for idx, cand in enumerate(candidates, start=1):
            page_info = f"Page {cand.page_number}" if cand.page_number else "Page 1"
            sec_info = f", Section \"{cand.section_heading}\"" if cand.section_heading else ""
            header = f"[SOURCE {idx}: Document \"{cand.document_title}\", {page_info}{sec_info}]"

            block = f"{header}\n{cand.text.strip()}\n"
            block_len = len(block)

            if current_chars + block_len > max_context_chars and source_blocks:
                break

            source_blocks.append(block)
            current_chars += block_len

            # Build Citation object
            snippet = cand.text.strip()
            if len(snippet) > 200:
                snippet = snippet[:197] + "..."

            citations.append(Citation(
                source_index=idx,
                document_title=cand.document_title,
                session_id=cand.session_id,
                page_number=cand.page_number,
                section_heading=cand.section_heading,
                snippet=snippet
            ))

        context_string = "\n\n---\n\n".join(source_blocks)
        return context_string, citations
