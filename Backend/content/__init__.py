"""
Florix AI — Multimodal Content Ingestion & Normalization Package
Exports canonical models, normalizer engine, and transcription interfaces.
Author: Ganesh (Lead Architect)
"""

from .models import MediaType, ContentSegment, NormalizedContent
from .normalizer import ContentNormalizer, compute_sha256
from .transcription import (
    TranscriptionProvider,
    GeminiTranscriptionProvider,
    MockTranscriptionProvider,
    extract_timestamped_segments,
    parse_timestamp_str,
)

__all__ = [
    "MediaType",
    "ContentSegment",
    "NormalizedContent",
    "ContentNormalizer",
    "compute_sha256",
    "TranscriptionProvider",
    "GeminiTranscriptionProvider",
    "MockTranscriptionProvider",
    "extract_timestamped_segments",
    "parse_timestamp_str",
]
