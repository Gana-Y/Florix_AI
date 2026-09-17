"""
Florix AI — Multimodal Content Normalizer
Transforms heterogeneous educational inputs (PDF, plain text, audio transcripts,
video transcripts, YouTube captions, web articles) into canonical NormalizedContent.
Author: Ganesh (Lead Architect)
"""

import hashlib
import re
import logging
from typing import List, Tuple, Dict, Any, Optional, Union

from .models import MediaType, ContentSegment, NormalizedContent
from rag.models import ContentType
from rag.parser import detect_content_type

logger = logging.getLogger("florix.content.normalizer")


def compute_sha256(content: Union[str, bytes]) -> str:
    """Computes SHA-256 hash for deduplication and provenance tracking."""
    if isinstance(content, str):
        content = content.encode("utf-8", errors="replace")
    return hashlib.sha256(content).hexdigest()


class ContentNormalizer:
    """
    Master content normalization engine.
    Ensures that every document or media stream entering Florix AI conforms to
    a strict canonical schema with complete provenance and structural boundaries.
    """

    @classmethod
    def normalize_pdf(
        cls,
        pages_data: List[Tuple[int, str]],
        title: str = "Academic Document",
        metadata: Optional[Dict[str, Any]] = None
    ) -> NormalizedContent:
        """
        Normalizes multi-page PDF documents.
        Each page is represented as structured segments preserving page numbers.
        """
        meta = metadata or {}
        segments: List[ContentSegment] = []
        full_text_parts: List[str] = []
        seg_idx = 1

        for page_num, page_text in pages_data:
            clean_text = page_text.strip()
            if not clean_text:
                continue
            full_text_parts.append(f"[Page {page_num}]\n{clean_text}")

            # Split page into logical paragraphs
            paras = re.split(r"\n{2,}", clean_text)
            for p in paras:
                p_clean = p.strip()
                if not p_clean:
                    continue
                c_type = detect_content_type(p_clean)
                segments.append(ContentSegment(
                    segment_id=seg_idx,
                    text=p_clean,
                    page_number=page_num,
                    content_type=c_type,
                    metadata={"page": page_num}
                ))
                seg_idx += 1

        raw_text = "\n\n".join(full_text_parts)
        content_hash = compute_sha256(raw_text)

        meta.update({
            "total_pages": len(pages_data),
            "segment_count": len(segments),
        })

        return NormalizedContent(
            title=title,
            media_type=MediaType.PDF,
            content_hash=content_hash,
            raw_text=raw_text,
            segments=segments,
            metadata=meta
        )

    @classmethod
    def normalize_text(
        cls,
        text: str,
        title: str = "Notes / Document",
        metadata: Optional[Dict[str, Any]] = None
    ) -> NormalizedContent:
        """
        Normalizes plain text, Markdown notes, or direct student pastes.
        """
        meta = metadata or {}
        clean_text = text.strip()
        segments: List[ContentSegment] = []

        paras = re.split(r"\n{2,}", clean_text)
        for idx, p in enumerate(paras, start=1):
            p_clean = p.strip()
            if not p_clean:
                continue
            c_type = detect_content_type(p_clean)
            segments.append(ContentSegment(
                segment_id=idx,
                text=p_clean,
                page_number=1,
                content_type=c_type
            ))

        content_hash = compute_sha256(clean_text)
        meta.update({"segment_count": len(segments)})

        return NormalizedContent(
            title=title,
            media_type=MediaType.TEXT,
            content_hash=content_hash,
            raw_text=clean_text,
            segments=segments,
            metadata=meta
        )

    @classmethod
    def normalize_youtube(
        cls,
        transcript_items: List[Dict[str, Any]],
        title: str = "YouTube Lecture",
        video_id: str = "",
        metadata: Optional[Dict[str, Any]] = None
    ) -> NormalizedContent:
        """
        Normalizes YouTube captions while rigorously preserving exact start & duration timestamps.
        transcript_items format: [{'text': '...', 'start': 0.0, 'duration': 4.2}, ...]
        """
        meta = metadata or {}
        segments: List[ContentSegment] = []
        text_parts: List[str] = []

        for idx, item in enumerate(transcript_items, start=1):
            t_text = item.get("text", "").strip()
            if not t_text:
                continue
            t_start = float(item.get("start", 0.0))
            duration = float(item.get("duration", 0.0))
            t_end = t_start + duration

            segments.append(ContentSegment(
                segment_id=idx,
                text=t_text,
                timestamp_start=t_start,
                timestamp_end=t_end,
                content_type=ContentType.TEXT,
                metadata={"start": t_start, "duration": duration, "video_id": video_id}
            ))
            text_parts.append(t_text)

        consolidated_text = " ".join(text_parts)
        content_hash = compute_sha256(consolidated_text)
        total_duration = segments[-1].timestamp_end if segments else 0.0

        meta.update({
            "video_id": video_id,
            "total_duration_seconds": total_duration,
            "caption_count": len(segments),
        })

        return NormalizedContent(
            title=title,
            media_type=MediaType.YOUTUBE,
            content_hash=content_hash,
            raw_text=consolidated_text,
            segments=segments,
            metadata=meta
        )

    @classmethod
    def normalize_audio(
        cls,
        segments: List[ContentSegment],
        title: str = "Audio Recording",
        raw_text: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> NormalizedContent:
        """
        Normalizes audio lecture transcripts with preserved timestamps and speaker turns.
        """
        meta = metadata or {}
        text = raw_text if raw_text is not None else "\n\n".join(s.text for s in segments)
        content_hash = compute_sha256(text)
        total_duration = segments[-1].timestamp_end if segments and segments[-1].timestamp_end else 0.0

        meta.update({
            "duration_seconds": total_duration,
            "segment_count": len(segments),
        })

        return NormalizedContent(
            title=title,
            media_type=MediaType.AUDIO,
            content_hash=content_hash,
            raw_text=text,
            segments=segments,
            metadata=meta
        )

    @classmethod
    def normalize_video(
        cls,
        segments: List[ContentSegment],
        title: str = "Video Lecture",
        raw_text: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> NormalizedContent:
        """
        Normalizes video lecture transcripts with preserved timestamps and visual context.
        """
        meta = metadata or {}
        text = raw_text if raw_text is not None else "\n\n".join(s.text for s in segments)
        content_hash = compute_sha256(text)
        total_duration = segments[-1].timestamp_end if segments and segments[-1].timestamp_end else 0.0

        meta.update({
            "duration_seconds": total_duration,
            "segment_count": len(segments),
        })

        return NormalizedContent(
            title=title,
            media_type=MediaType.VIDEO,
            content_hash=content_hash,
            raw_text=text,
            segments=segments,
            metadata=meta
        )

    @classmethod
    def normalize_web(
        cls,
        text_or_html: str,
        title: str = "Web Article",
        url: str = "",
        metadata: Optional[Dict[str, Any]] = None
    ) -> NormalizedContent:
        """
        Normalizes extracted web article text.
        """
        meta = metadata or {}
        clean_text = text_or_html.strip()
        content_hash = compute_sha256(clean_text)

        paras = [p.strip() for p in re.split(r"\n{2,}", clean_text) if p.strip()]
        segments: List[ContentSegment] = []
        for idx, p in enumerate(paras, start=1):
            segments.append(ContentSegment(
                segment_id=idx,
                text=p,
                page_number=1,
                content_type=detect_content_type(p)
            ))

        meta.update({
            "url": url,
            "segment_count": len(segments)
        })

        return NormalizedContent(
            title=title,
            media_type=MediaType.WEB,
            content_hash=content_hash,
            raw_text=clean_text,
            segments=segments,
            metadata=meta
        )

    @classmethod
    def normalize_any(
        cls,
        source_type: str,
        data: Any,
        title: str = "Academic Content",
        metadata: Optional[Dict[str, Any]] = None
    ) -> NormalizedContent:
        """
        Universal dispatch entry point for normalizing any supported content type.
        """
        st = source_type.lower()
        meta = metadata or {}

        if st == "pdf":
            if isinstance(data, list):
                return cls.normalize_pdf(data, title=title, metadata=meta)
            else:
                return cls.normalize_pdf([(1, str(data))], title=title, metadata=meta)
        elif st in ("youtube", "yt"):
            vid = meta.get("video_id", "")
            if isinstance(data, list):
                if data and isinstance(data[0], ContentSegment):
                    for s in data:
                        if hasattr(s, "metadata") and isinstance(s.metadata, dict):
                            s.metadata.setdefault("source_type", "youtube")
                            if vid:
                                s.metadata.setdefault("video_id", vid)
                    raw = " ".join(s.text for s in data)
                    return NormalizedContent(
                        title=title,
                        media_type=MediaType.YOUTUBE,
                        content_hash=compute_sha256(raw),
                        raw_text=raw,
                        segments=data,
                        metadata=meta
                    )
                else:
                    return cls.normalize_youtube(data, title=title, video_id=vid, metadata=meta)
            else:
                from .transcription import extract_timestamped_segments
                segs = extract_timestamped_segments(str(data))
                if segs and any(getattr(s, "timestamp_start", None) is not None for s in segs):
                    for s in segs:
                        if hasattr(s, "metadata") and isinstance(s.metadata, dict):
                            s.metadata["source_type"] = "youtube"
                            if vid:
                                s.metadata["video_id"] = vid
                    raw = str(data)
                    return NormalizedContent(
                        title=title,
                        media_type=MediaType.YOUTUBE,
                        content_hash=compute_sha256(raw),
                        raw_text=raw,
                        segments=segs,
                        metadata=meta
                    )
                else:
                    return cls.normalize_text(str(data), title=title, metadata=meta)
        elif st == "audio":
            if isinstance(data, list) and data and isinstance(data[0], ContentSegment):
                return cls.normalize_audio(data, title=title, metadata=meta)
            else:
                from .transcription import extract_timestamped_segments
                segs = extract_timestamped_segments(str(data))
                return cls.normalize_audio(segs, title=title, raw_text=str(data), metadata=meta)
        elif st == "video":
            if isinstance(data, list) and data and isinstance(data[0], ContentSegment):
                return cls.normalize_video(data, title=title, metadata=meta)
            else:
                from .transcription import extract_timestamped_segments
                segs = extract_timestamped_segments(str(data))
                return cls.normalize_video(segs, title=title, raw_text=str(data), metadata=meta)
        elif st in ("web", "url"):
            return cls.normalize_web(str(data), title=title, url=meta.get("url", ""), metadata=meta)
        else:
            return cls.normalize_text(str(data), title=title, metadata=meta)
