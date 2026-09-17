"""
Florix AI — Academic Semantic Chunker
Transforms structured document sections into rich, context-aware semantic chunks.
Preserves code blocks, mathematical equations, tables, and definitions without fragmentation.
Author: Ganesh (Lead Architect)
"""

import re
from typing import List, Tuple, Optional
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
            sentences = re.split(r"(?<=[.!?])\s+", para_clean)
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


def build_semantic_chunks(
    pages_or_text: List[Tuple[int, str]] | str,
    chunk_size: int = 800,
    overlap: int = 150
) -> List[EnrichedChunk]:
    """
    Primary chunking entry point. Accepts either:
    1. A list of (page_number, text) tuples from PDF extraction.
    2. A single raw text string (from web scrape, YouTube transcript, or notes).

    Produces a flat list of EnrichedChunks with continuous indices, page numbers,
    structural headings, and detected content types.
    """
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
