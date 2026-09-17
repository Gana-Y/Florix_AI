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
            cand_meta = cand.metadata or {}
            ts_start = cand_meta.get("timestamp_start")
            ts_end = cand_meta.get("timestamp_end")
            ts_str = cand_meta.get("timestamp_str")
            s_type = cand.source_type or cand_meta.get("source_type", "pdf")

            is_media = s_type.lower() in ("audio", "video", "youtube") or (ts_start is not None)

            media_ts_str = None
            if is_media and (ts_start is not None or ts_str):
                if ts_str:
                    media_ts_str = ts_str
                else:
                    s_m, s_s = divmod(int(ts_start or 0), 60)
                    if ts_end is not None:
                        e_m, e_s = divmod(int(ts_end), 60)
                        media_ts_str = f"{s_m:02d}:{s_s:02d} - {e_m:02d}:{e_s:02d}"
                    else:
                        media_ts_str = f"{s_m:02d}:{s_s:02d}"
                loc_info = f"Timestamp [{media_ts_str}]"
                source_label = s_type.capitalize()
            else:
                loc_info = f"Page {cand.page_number}" if cand.page_number else "Page 1"
                source_label = "Document"

            sec_info = f", Section \"{cand.section_heading}\"" if cand.section_heading else ""
            header = f"[SOURCE {idx}: {source_label} \"{cand.document_title}\", {loc_info}{sec_info}]"

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
                snippet=snippet,
                timestamp_start=ts_start,
                timestamp_end=ts_end,
                source_type=s_type,
                media_timestamp_str=media_ts_str
            ))

        context_string = "\n\n---\n\n".join(source_blocks)
        return context_string, citations
