"""
Florix AI — Academic RAG Engine Data Models
Defines canonical internal document models, processing states, chunk representations,
and citation structures.
Author: Ganesh (Lead Architect)
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any
from datetime import datetime


class ProcessingStatus(str, Enum):
    """Document lifecycle states during ingestion and indexing."""
    UPLOADED = "UPLOADED"
    QUEUED = "QUEUED"
    EXTRACTING = "EXTRACTING"
    CHUNKING = "CHUNKING"
    EMBEDDING = "EMBEDDING"
    INDEXING = "INDEXING"
    READY = "READY"
    FAILED = "FAILED"


class ContentType(str, Enum):
    """Semantic classification for extracted academic content fragments."""
    TEXT = "text"
    CODE = "code"
    TABLE = "table"
    EQUATION = "equation"
    DEFINITION = "definition"
    HEADING = "heading"
    LIST = "list"


class QueryIntent(str, Enum):
    """Intent classification for student queries."""
    CONCEPTUAL = "conceptual"
    COMPARISON = "comparison"
    TARGETED = "targeted"
    CODE = "code"
    ASSESSMENT = "assessment"
    GENERAL = "general"


@dataclass
class ParsedSection:
    """Represents a structural document section before chunking."""
    title: str
    content: str
    page_number: Optional[int] = None
    content_type: ContentType = ContentType.TEXT
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EnrichedChunk:
    """An enriched semantic chunk ready for embedding and storage."""
    text: str
    chunk_index: int
    page_number: Optional[int] = 1
    section_heading: str = ""
    content_type: ContentType = ContentType.TEXT
    token_count: int = 0
    char_start: int = 0
    char_end: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_index": self.chunk_index,
            "text": self.text,
            "page_number": self.page_number,
            "section_heading": self.section_heading,
            "content_type": self.content_type.value if isinstance(self.content_type, ContentType) else str(self.content_type),
            "token_count": self.token_count,
            "char_start": self.char_start,
            "char_end": self.char_end,
            "metadata": self.metadata
        }


@dataclass
class RetrievalCandidate:
    """A retrieved chunk candidate scored via hybrid dense + lexical matching."""
    chunk_id: str
    session_id: int
    user_id: int
    text: str
    page_number: Optional[int] = 1
    section_heading: str = ""
    content_type: ContentType = ContentType.TEXT
    dense_score: float = 0.0
    lexical_score: float = 0.0
    final_score: float = 0.0
    source_type: str = "pdf"
    document_title: str = "Untitled Document"
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "session_id": self.session_id,
            "user_id": self.user_id,
            "text": self.text,
            "page_number": self.page_number,
            "section_heading": self.section_heading,
            "content_type": self.content_type.value if isinstance(self.content_type, ContentType) else str(self.content_type),
            "dense_score": round(self.dense_score, 4),
            "lexical_score": round(self.lexical_score, 4),
            "score": round(self.final_score, 4),
            "source_type": self.source_type,
            "document_title": self.document_title,
        }


@dataclass
class Citation:
    """An authoritative source citation linking an answer claim to verified material."""
    source_index: int  # 1, 2, 3...
    document_title: str
    session_id: int
    page_number: Optional[int] = None
    section_heading: str = ""
    snippet: str = ""
    timestamp_start: Optional[float] = None
    timestamp_end: Optional[float] = None
    source_type: Optional[str] = None
    media_timestamp_str: Optional[str] = None
    source_url: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data = {
            "source_index": self.source_index,
            "document_title": self.document_title,
            "session_id": self.session_id,
            "section_heading": self.section_heading,
            "snippet": self.snippet
        }
        if self.page_number is not None:
            data["page_number"] = self.page_number
        if self.timestamp_start is not None:
            data["timestamp_start"] = self.timestamp_start
        if self.timestamp_end is not None:
            data["timestamp_end"] = self.timestamp_end
        if self.source_type is not None:
            data["source_type"] = self.source_type
        if self.media_timestamp_str is not None:
            data["media_timestamp_str"] = self.media_timestamp_str
        if self.source_url is not None:
            data["source_url"] = self.source_url
        return data


@dataclass
class GroundedResponse:
    """The synthesized response grounded in source material."""
    reply: str
    citations: List[Citation] = field(default_factory=list)
    confidence_score: float = 1.0
    query_intent: QueryIntent = QueryIntent.GENERAL
    sources_used: int = 0
    is_grounded: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "reply": self.reply,
            "citations": [c.to_dict() for c in self.citations],
            "confidence_score": round(self.confidence_score, 2),
            "query_intent": self.query_intent.value if isinstance(self.query_intent, QueryIntent) else str(self.query_intent),
            "sources_used": self.sources_used,
            "is_grounded": self.is_grounded
        }
