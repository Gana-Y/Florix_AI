"""
Florix AI — Multimodal Content Models
Defines canonical data structures for normalized multimodal educational content,
including atomic segments with page numbers and timestamp spans.
Author: Ganesh (Lead Architect)
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any
from rag.models import ContentType


class MediaType(str, Enum):
    """Supported multimodal academic content modalities."""
    PDF = "pdf"
    AUDIO = "audio"
    VIDEO = "video"
    YOUTUBE = "youtube"
    TEXT = "text"
    WEB = "web"
    IMAGE = "image"


@dataclass
class ContentSegment:
    """
    Canonical atomic segment extracted from any content modality.
    Preserves exact provenance (page number for documents, timestamp spans for media).
    """
    segment_id: int
    text: str
    page_number: Optional[int] = None
    timestamp_start: Optional[float] = None  # in seconds
    timestamp_end: Optional[float] = None    # in seconds
    speaker: Optional[str] = None
    heading: Optional[str] = None
    content_type: ContentType = ContentType.TEXT
    metadata: Dict[str, Any] = field(default_factory=dict)

    def format_timestamp(self) -> Optional[str]:
        """Formats timestamp range as [MM:SS - MM:SS] if available."""
        if self.timestamp_start is None:
            return None
        s_min, s_sec = divmod(int(self.timestamp_start), 60)
        s_str = f"{s_min:02d}:{s_sec:02d}"
        if self.timestamp_end is not None:
            e_min, e_sec = divmod(int(self.timestamp_end), 60)
            e_str = f"{e_min:02d}:{e_sec:02d}"
            return f"{s_str} - {e_str}"
        return s_str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "segment_id": self.segment_id,
            "text": self.text,
            "page_number": self.page_number,
            "timestamp_start": self.timestamp_start,
            "timestamp_end": self.timestamp_end,
            "timestamp_str": self.format_timestamp(),
            "speaker": self.speaker,
            "heading": self.heading,
            "content_type": self.content_type.value if hasattr(self.content_type, "value") else str(self.content_type),
            "metadata": self.metadata,
        }


@dataclass
class NormalizedContent:
    """
    Canonical structured representation of multimodal academic input.
    Guarantees consistent schema regardless of original file format or source.
    """
    title: str
    media_type: MediaType
    content_hash: str
    raw_text: str
    segments: List[ContentSegment] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "media_type": self.media_type.value if hasattr(self.media_type, "value") else str(self.media_type),
            "content_hash": self.content_hash,
            "raw_text_length": len(self.raw_text),
            "segment_count": len(self.segments),
            "segments": [s.to_dict() for s in self.segments],
            "metadata": self.metadata,
        }

    def get_full_text(self) -> str:
        """Returns consolidated text from segments if raw_text is empty."""
        if self.raw_text and self.raw_text.strip():
            return self.raw_text
        return "\n\n".join(s.text for s in self.segments if s.text.strip())
