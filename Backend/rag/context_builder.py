"""
Florix AI — Structured Context Builder
Assembles retrieved academic evidence into structured context with explicit source markers,
enabling precise claim attribution and authoritative citations.
Author: Ganesh (Lead Architect)
"""

from typing import List, Tuple, Optional
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
            is_web = s_type.lower() in ("url", "web")
            is_text = s_type.lower() in ("text", "paste", "notes")

            media_ts_str = None
            source_url_val = None
            sec_info = f', Section "{cand.section_heading}"' if cand.section_heading else ""

            if is_media and (ts_start is not None or ts_str):
                if ts_str:
                    media_ts_str = ts_str
                else:
                    def _fmt_sec(val: Optional[float]) -> str:
                        if val is None:
                            return "00:00"
                        tot = max(0, int(val))
                        m, s = divmod(tot, 60)
                        h, m = divmod(m, 60)
                        if h > 0:
                            return f"{h:02d}:{m:02d}:{s:02d}"
                        return f"{m:02d}:{s:02d}"

                    if ts_end is not None:
                        media_ts_str = f"{_fmt_sec(ts_start)} - {_fmt_sec(ts_end)}"
                    else:
                        media_ts_str = _fmt_sec(ts_start)
                loc_info = f"Timestamp [{media_ts_str}]"
                source_label = s_type.capitalize()
            elif is_web:
                source_url_val = cand_meta.get("url") or cand_meta.get("source_url") or ""
                source_label = "Web Page"
                loc_info = f"URL <{source_url_val}>" if source_url_val else "Online Article"
            elif is_text:
                source_label = "Notes"
                loc_info = "Notes"
            else:
                loc_info = f"Page {cand.page_number}" if cand.page_number else "Page 1"
                source_label = "Document"

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
                page_number=None if (is_web or is_text) else cand.page_number,
                section_heading=cand.section_heading,
                snippet=snippet,
                timestamp_start=ts_start,
                timestamp_end=ts_end,
                source_type=s_type,
                media_timestamp_str=media_ts_str,
                source_url=source_url_val
            ))

        context_string = "\n\n---\n\n".join(source_blocks)
        return context_string, citations
