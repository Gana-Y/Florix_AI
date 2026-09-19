"""
Florix AI — Academic Semantic Chunker
Transforms structured document sections into rich, context-aware semantic chunks.
Preserves code blocks, mathematical equations, tables, and definitions without fragmentation.
Author: Ganesh (Lead Architect)
"""

import re
from typing import List, Tuple, Optional, Any, Union, Dict
from .models import EnrichedChunk, ContentType, ParsedSection
from .parser import detect_content_type, extract_structural_sections


def _approx_token_count(text: str) -> int:
    """Rough approximation of tokens based on whitespace and punctuation."""
    return max(1, len(re.findall(r"\w+|[^\w\s]", text)))


def chunk_section(
    section: ParsedSection,
    chunk_size: int = 800,
    overlap: int = 150,
    start_chunk_index: int = 0
) -> List[EnrichedChunk]:
    """
    Chunks a single structural section while respecting atomic units:
    code blocks, tables, formulas, and paragraphs.
    """
    text = section.content.strip()
    if not text:
        return []

    # If section is small enough, return as a single atomic chunk
    if len(text) <= chunk_size:
        return [EnrichedChunk(
            text=text,
            chunk_index=start_chunk_index,
            page_number=section.page_number,
            section_heading=section.title,
            content_type=section.content_type,
            token_count=_approx_token_count(text),
            char_start=0,
            char_end=len(text),
            metadata={"heading": section.title, "page": section.page_number}
        )]

    # If section is code or table, avoid fracturing unless extremely large
    if section.content_type in (ContentType.CODE, ContentType.TABLE, ContentType.EQUATION):
        if len(text) <= chunk_size * 2:
            return [EnrichedChunk(
                text=text,
                chunk_index=start_chunk_index,
                page_number=section.page_number,
                section_heading=section.title,
                content_type=section.content_type,
                token_count=_approx_token_count(text),
                char_start=0,
                char_end=len(text),
                metadata={"heading": section.title, "page": section.page_number, "atomic": True}
            )]

    # Split into paragraphs/logical blocks
    paragraphs = re.split(r"\n{2,}", text)
    chunks: List[EnrichedChunk] = []
    current_paras: List[str] = []
    current_length = 0
    current_idx = start_chunk_index

    for para in paragraphs:
        para_clean = para.strip()
        if not para_clean:
            continue

        para_len = len(para_clean)

        # If a single paragraph is larger than chunk_size, split by sentences
        if para_len > chunk_size:
            if current_paras:
                chunk_text = "\n\n".join(current_paras).strip()
                chunks.append(EnrichedChunk(
                    text=chunk_text,
                    chunk_index=current_idx,
                    page_number=section.page_number,
                    section_heading=section.title,
                    content_type=detect_content_type(chunk_text),
                    token_count=_approx_token_count(chunk_text),
                    metadata={"heading": section.title, "page": section.page_number}
                ))
                current_idx += 1
                current_paras = []
                current_length = 0

            # Sentence splitting for oversized paragraph
            raw_sentences = re.split(r"(?<=[.!?])\s+", para_clean)
            sentences = []
            for raw_s in raw_sentences:
                raw_s = raw_s.strip()
                if not raw_s:
                    continue
                if len(raw_s) > chunk_size:
                    # Break oversized sentence/line by words so chunks never exceed chunk_size
                    words = raw_s.split(" ")
                    curr_w: List[str] = []
                    curr_w_len = 0
                    for w in words:
                        if len(w) > chunk_size:
                            # Hard split oversized single word/token (e.g. minified code, base64, unbroken repetition)
                            if curr_w:
                                sentences.append(" ".join(curr_w))
                                curr_w = []
                                curr_w_len = 0
                            for i in range(0, len(w), chunk_size):
                                part = w[i:i + chunk_size]
                                if part:
                                    sentences.append(part)
                        elif curr_w_len + len(w) + 1 > chunk_size and curr_w:
                            sentences.append(" ".join(curr_w))
                            curr_w = [w]
                            curr_w_len = len(w)
                        else:
                            curr_w.append(w)
                            curr_w_len += len(w) + 1
                    if curr_w:
                        sentences.append(" ".join(curr_w))
                else:
                    sentences.append(raw_s)

            sub_chunk = []
            sub_len = 0
            for sent in sentences:
                sent = sent.strip()
                if not sent:
                    continue
                if sub_len + len(sent) + 1 > chunk_size and sub_chunk:
                    sent_text = " ".join(sub_chunk)
                    chunks.append(EnrichedChunk(
                        text=sent_text,
                        chunk_index=current_idx,
                        page_number=section.page_number,
                        section_heading=section.title,
                        content_type=detect_content_type(sent_text),
                        token_count=_approx_token_count(sent_text),
                        metadata={"heading": section.title, "page": section.page_number}
                    ))
                    current_idx += 1
                    # Sliding overlap
                    overlap_chunk = []
                    overlap_len = 0
                    for prev in reversed(sub_chunk):
                        if overlap_len + len(prev) + 1 < overlap:
                            overlap_chunk.insert(0, prev)
                            overlap_len += len(prev) + 1
                        else:
                            break
                    sub_chunk = overlap_chunk + [sent]
                    sub_len = sum(len(s) + 1 for s in sub_chunk)
                else:
                    sub_chunk.append(sent)
                    sub_len += len(sent) + 1

            if sub_chunk:
                sent_text = " ".join(sub_chunk)
                chunks.append(EnrichedChunk(
                    text=sent_text,
                    chunk_index=current_idx,
                    page_number=section.page_number,
                    section_heading=section.title,
                    content_type=detect_content_type(sent_text),
                    token_count=_approx_token_count(sent_text),
                    metadata={"heading": section.title, "page": section.page_number}
                ))
                current_idx += 1
            continue

        if current_length + para_len + 2 > chunk_size:
            chunk_text = "\n\n".join(current_paras).strip()
            chunks.append(EnrichedChunk(
                text=chunk_text,
                chunk_index=current_idx,
                page_number=section.page_number,
                section_heading=section.title,
                content_type=detect_content_type(chunk_text),
                token_count=_approx_token_count(chunk_text),
                metadata={"heading": section.title, "page": section.page_number}
            ))
            current_idx += 1

            # Build overlap from the last paragraph
            last_para = current_paras[-1] if current_paras else ""
            if len(last_para) < overlap:
                current_paras = [last_para, para_clean]
                current_length = len(last_para) + len(para_clean) + 2
            else:
                current_paras = [para_clean]
                current_length = para_len
        else:
            current_paras.append(para_clean)
            current_length += para_len + 2

    if current_paras:
        chunk_text = "\n\n".join(current_paras).strip()
        chunks.append(EnrichedChunk(
            text=chunk_text,
            chunk_index=current_idx,
            page_number=section.page_number,
            section_heading=section.title,
            content_type=detect_content_type(chunk_text),
            token_count=_approx_token_count(chunk_text),
            metadata={"heading": section.title, "page": section.page_number}
        ))

    return chunks


def _format_seconds_ts(sec: float) -> str:
    total = max(0, int(sec))
    m, s = divmod(total, 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


def _format_ts_span(t_start: Optional[float], t_end: Optional[float]) -> Optional[str]:
    """Formats start and end seconds into [MM:SS - MM:SS] or [HH:MM:SS - HH:MM:SS] representation."""
    if t_start is None:
        return None
    s_str = _format_seconds_ts(t_start)
    if t_end is not None:
        e_str = _format_seconds_ts(t_end)
        return f"{s_str} - {e_str}"
    return s_str


def _create_media_chunk(
    segs: List[Any],
    chunk_index: int,
    source_type: str = "media"
) -> EnrichedChunk:
    """Combines media segments into a single enriched chunk with consolidated timestamp boundaries."""
    combined_text = " ".join(s.text.strip() for s in segs if s.text.strip())
    ts_starts = [s.timestamp_start for s in segs if getattr(s, "timestamp_start", None) is not None]
    ts_ends = [s.timestamp_end for s in segs if getattr(s, "timestamp_end", None) is not None]

    t_start = min(ts_starts) if ts_starts else None
    t_end = max(ts_ends) if ts_ends else None
    ts_str = _format_ts_span(t_start, t_end)

    speakers = list(dict.fromkeys(s.speaker for s in segs if getattr(s, "speaker", None) and s.speaker))
    speaker = speakers[0] if len(speakers) == 1 else (", ".join(speakers) if len(speakers) > 1 else None)

    heading = f"[{ts_str}]" if ts_str else ""
    if speaker:
        heading = f"{heading} {speaker}".strip()

    metadata = {
        "source_type": source_type,
        "timestamp_start": t_start,
        "timestamp_end": t_end,
        "timestamp_str": ts_str,
        "speaker": speaker
    }

    return EnrichedChunk(
        text=combined_text,
        chunk_index=chunk_index,
        page_number=1,
        section_heading=heading,
        content_type=ContentType.TEXT,
        token_count=_approx_token_count(combined_text),
        char_start=0,
        char_end=len(combined_text),
        metadata=metadata
    )


def _create_media_chunk_from_text(
    text: str,
    chunk_index: int,
    t_start: Optional[float],
    t_end: Optional[float],
    speaker: Optional[str],
    source_type: str = "media"
) -> EnrichedChunk:
    """Creates a media chunk from sub-split text with interpolated timestamps."""
    ts_str = _format_ts_span(t_start, t_end)
    heading = f"[{ts_str}]" if ts_str else ""
    if speaker:
        heading = f"{heading} {speaker}".strip()

    metadata = {
        "source_type": source_type,
        "timestamp_start": t_start,
        "timestamp_end": t_end,
        "timestamp_str": ts_str,
        "speaker": speaker
    }

    return EnrichedChunk(
        text=text,
        chunk_index=chunk_index,
        page_number=1,
        section_heading=heading,
        content_type=ContentType.TEXT,
        token_count=_approx_token_count(text),
        char_start=0,
        char_end=len(text),
        metadata=metadata
    )


def chunk_normalized_content(
    normalized: Any,
    chunk_size: int = 800,
    overlap: int = 150
) -> List[EnrichedChunk]:
    """
    Chunks NormalizedContent into semantic EnrichedChunks preserving timestamps
    for audio/video/YouTube and page numbers for document formats.
    """
    segments = getattr(normalized, "segments", [])
    if not segments:
        return []

    media_type_val = normalized.media_type.value if hasattr(normalized.media_type, "value") else str(getattr(normalized, "media_type", "text"))
    has_timestamps = any(getattr(s, "timestamp_start", None) is not None for s in segments)

    # If content has timestamps (Audio, Video, YouTube), preserve temporal spans
    if has_timestamps or media_type_val in ("audio", "video", "youtube"):
        chunks: List[EnrichedChunk] = []
        curr_segs: List[Any] = []
        curr_len = 0
        curr_idx = 0

        for seg in segments:
            seg_text = seg.text.strip()
            if not seg_text:
                continue

            # If single segment is oversized, split by sentences with timestamp interpolation
            if len(seg_text) > chunk_size:
                if curr_segs:
                    chunks.append(_create_media_chunk(curr_segs, curr_idx, media_type_val))
                    curr_idx += 1
                    curr_segs = []
                    curr_len = 0

                raw_sentences = re.split(r"(?<=[.!?])\s+", seg_text)
                sentences = []
                for raw_s in raw_sentences:
                    raw_s = raw_s.strip()
                    if not raw_s:
                        continue
                    if len(raw_s) > chunk_size:
                        # Break oversized speech block by words so chunks never exceed chunk_size
                        words = raw_s.split(" ")
                        curr_w: List[str] = []
                        curr_w_len = 0
                        for w in words:
                            if curr_w_len + len(w) + 1 > chunk_size and curr_w:
                                sentences.append(" ".join(curr_w))
                                curr_w = [w]
                                curr_w_len = len(w)
                            else:
                                curr_w.append(w)
                                curr_w_len += len(w) + 1
                        if curr_w:
                            sentences.append(" ".join(curr_w))
                    else:
                        sentences.append(raw_s)
                sub_texts = []
                sub_len = 0
                s_start = getattr(seg, "timestamp_start", 0.0) or 0.0
                s_end = getattr(seg, "timestamp_end", s_start + 30.0) or (s_start + 30.0)
                seg_dur = max(1.0, s_end - s_start)
                tot_chars = max(1, len(seg_text))

                char_acc = 0
                for sent in sentences:
                    sent = sent.strip()
                    if not sent:
                        continue
                    if sub_len + len(sent) > chunk_size and sub_texts:
                        c_text = " ".join(sub_texts)
                        t_s = s_start + ((char_acc - sub_len) / tot_chars) * seg_dur
                        t_e = s_start + (char_acc / tot_chars) * seg_dur
                        chunks.append(_create_media_chunk_from_text(
                            c_text, curr_idx, t_s, t_e, getattr(seg, "speaker", None), media_type_val
                        ))
                        curr_idx += 1
                        sub_texts = [sent]
                        sub_len = len(sent)
                    else:
                        sub_texts.append(sent)
                        sub_len += len(sent) + 1
                    char_acc += len(sent) + 1

                if sub_texts:
                    c_text = " ".join(sub_texts)
                    t_s = s_start + (max(0, tot_chars - sub_len) / tot_chars) * seg_dur
                    t_e = s_end
                    chunks.append(_create_media_chunk_from_text(
                        c_text, curr_idx, t_s, t_e, getattr(seg, "speaker", None), media_type_val
                    ))
                    curr_idx += 1
                continue

            if curr_len + len(seg_text) > chunk_size and curr_segs:
                chunks.append(_create_media_chunk(curr_segs, curr_idx, media_type_val))
                curr_idx += 1

                # Overlap handling
                if len(curr_segs[-1].text) <= overlap:
                    curr_segs = [curr_segs[-1], seg]
                    curr_len = len(curr_segs[0].text) + len(seg_text) + 1
                else:
                    curr_segs = [seg]
                    curr_len = len(seg_text)
            else:
                curr_segs.append(seg)
                curr_len += len(seg_text) + 1

        if curr_segs:
            chunks.append(_create_media_chunk(curr_segs, curr_idx, media_type_val))
            curr_idx += 1

        return chunks

    # For web, text/notes, or non-paged content without timestamps, preserve page_number=None
    if media_type_val in ("web", "url", "text", "notes") or all(getattr(s, "page_number", None) is None for s in segments):
        source_url_val = (
            getattr(normalized, "metadata", {}).get("source_url")
            or getattr(normalized, "metadata", {}).get("url")
        )
        full_text = "\n\n".join(s.text for s in segments if s.text.strip())
        sections = extract_structural_sections(full_text, page_number=None)
        if not sections:
            sections = [ParsedSection(title=getattr(normalized, "title", "Study Material"), page_number=None, content=full_text)]
        chunks: List[EnrichedChunk] = []
        current_idx = 0
        for sec in sections:
            sec_chunks = chunk_section(sec, chunk_size=chunk_size, overlap=overlap, start_chunk_index=current_idx)
            for c in sec_chunks:
                c.page_number = None
                if source_url_val:
                    c.metadata["source_url"] = source_url_val
                    c.metadata["url"] = source_url_val
                if media_type_val in ("text", "notes"):
                    c.metadata["source_type"] = "text"
                chunks.append(c)
                current_idx += 1
        return chunks

    # Otherwise: group by page_number for documents
    page_dict: Dict[int, List[str]] = {}
    for s in segments:
        p_num = getattr(s, "page_number", 1) or 1
        page_dict.setdefault(p_num, []).append(s.text)

    pages_data = [(p_num, "\n\n".join(texts)) for p_num, texts in sorted(page_dict.items())]
    return build_semantic_chunks(pages_data, chunk_size, overlap)


def build_semantic_chunks(
    pages_or_text: Union[List[Tuple[int, str]], str, Any],
    chunk_size: int = 800,
    overlap: int = 150
) -> List[EnrichedChunk]:
    """
    Primary chunking entry point. Accepts:
    1. A NormalizedContent object (preserves timestamps/pages).
    2. A list of (page_number, text) tuples from PDF extraction.
    3. A single raw text string (from web scrape, YouTube transcript, or notes).

    Produces a flat list of EnrichedChunks with continuous indices, page numbers,
    structural headings, timestamps (if media), and detected content types.
    """
    if hasattr(pages_or_text, "segments"):
        return chunk_normalized_content(pages_or_text, chunk_size, overlap)

    if isinstance(pages_or_text, str):
        pages_data = [(1, pages_or_text)]
    else:
        pages_data = pages_or_text

    all_chunks: List[EnrichedChunk] = []
    current_global_index = 0

    for page_num, page_content in pages_data:
        sections = extract_structural_sections(page_content, page_number=page_num)
        if not sections:
            continue

        for sec in sections:
            sec_chunks = chunk_section(
                sec,
                chunk_size=chunk_size,
                overlap=overlap,
                start_chunk_index=current_global_index
            )
            for chk in sec_chunks:
                chk.chunk_index = current_global_index
                all_chunks.append(chk)
                current_global_index += 1

    return all_chunks
