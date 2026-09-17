"""
Florix AI — Academic Knowledge Engine & RAG Subsystem
Exposes canonical data models, structural parsers, semantic chunkers, hybrid retrievers,
rerankers, context builders, and grounded generators.
Author: Ganesh (Lead Architect)
"""

from .models import (
    ProcessingStatus,
    ContentType,
    QueryIntent,
    ParsedSection,
    EnrichedChunk,
    RetrievalCandidate,
    Citation,
    GroundedResponse,
)
from .parser import (
    parse_pdf_pages,
    detect_content_type,
    extract_structural_sections,
)
from .chunker import (
    build_semantic_chunks,
    chunk_section,
)
from .retriever import (
    HybridRetriever,
    classify_query_intent,
    extract_key_tokens,
    reciprocal_rank_fusion,
)
from .reranker import RelevanceReranker
from .context_builder import ContextBuilder
from .prompts import (
    build_grounded_rag_prompt,
    build_query_rewrite_prompt,
    SYSTEM_GROUNDED_TUTOR_PROMPT,
)
from .generator import GroundedGenerator

__all__ = [
    "ProcessingStatus",
    "ContentType",
    "QueryIntent",
    "ParsedSection",
    "EnrichedChunk",
    "RetrievalCandidate",
    "Citation",
    "GroundedResponse",
    "parse_pdf_pages",
    "detect_content_type",
    "extract_structural_sections",
    "build_semantic_chunks",
    "chunk_section",
    "HybridRetriever",
    "classify_query_intent",
    "extract_key_tokens",
    "reciprocal_rank_fusion",
    "RelevanceReranker",
    "ContextBuilder",
    "build_grounded_rag_prompt",
    "build_query_rewrite_prompt",
    "SYSTEM_GROUNDED_TUTOR_PROMPT",
    "GroundedGenerator",
]
