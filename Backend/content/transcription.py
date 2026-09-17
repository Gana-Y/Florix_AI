"""
Florix AI — Multimodal Audio & Video Transcription Layer
Provides modular transcription interfaces with timestamp extraction, speaker identification,
and resilient parsing for educational media.
Author: Ganesh (Lead Architect)
"""

import re
import json
import logging
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any

from .models import ContentSegment, ContentType

logger = logging.getLogger("florix.content.transcription")


def parse_timestamp_str(ts_str: str) -> float:
    """
    Parses timestamp string (e.g. '01:23', '00:01:23', '12.5') into seconds float.
    """
    ts_str = ts_str.strip()
    try:
        parts = [float(p) for p in ts_str.split(":")]
        if len(parts) == 3:
            return parts[0] * 3600 + parts[1] * 60 + parts[2]
        elif len(parts) == 2:
            return parts[0] * 60 + parts[1]
        elif len(parts) == 1:
            return parts[0]
    except Exception:
        pass
    return 0.0


def extract_timestamped_segments(raw_text: str) -> List[ContentSegment]:
    """
    Parses timestamp markers from raw LLM transcription output.
    Supports formats:
    - [00:15 - 00:45] Speaker: text
    - [01:23] text
    - [01:23 - 02:45] text
    - JSON segment blocks
    """
    segments: List[ContentSegment] = []
    if not raw_text or not raw_text.strip():
        return segments

    # Try JSON array first
    json_match = re.search(r"```json\s*(\[.*?\])\s*```", raw_text, re.DOTALL)
    if not json_match:
        # Check if entire text or bracketed portion is JSON
        bracket_match = re.search(r"(\[\s*\{.*\}\s*\])", raw_text, re.DOTALL)
        if bracket_match:
            try:
                data = json.loads(bracket_match.group(1))
                if isinstance(data, list) and data and isinstance(data[0], dict):
                    for idx, item in enumerate(data, start=1):
                        t_start = float(item.get("start", item.get("timestamp_start", 0.0)))
                        t_end = float(item.get("end", item.get("timestamp_end", t_start + 15.0)))
                        speaker = item.get("speaker")
                        text = item.get("text", "").strip()
                        if text:
                            segments.append(ContentSegment(
                                segment_id=idx,
                                text=text,
                                timestamp_start=t_start,
                                timestamp_end=t_end,
                                speaker=speaker,
                                content_type=ContentType.TEXT
                            ))
                    if segments:
                        return segments
            except Exception:
                pass

    # Pattern for timestamp brackets: [MM:SS - MM:SS] or [MM:SS]
    pattern = re.compile(
        r"\[(\d{1,2}:\d{2}(?::\d{2})?)(?:\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?))?\]\s*(?:([A-Za-z0-9\s]+):)?\s*(.*?)(?=(?:\[\d{1,2}:\d{2}|$))",
        re.DOTALL
    )

    matches = list(pattern.finditer(raw_text))
    if matches:
        for idx, match in enumerate(matches, start=1):
            start_str = match.group(1)
            end_str = match.group(2)
            speaker_str = match.group(3)
            content_text = match.group(4).strip()

            t_start = parse_timestamp_str(start_str)
            t_end = parse_timestamp_str(end_str) if end_str else t_start + 30.0
            if t_end < t_start:
                t_end = t_start + 15.0

            speaker = speaker_str.strip() if speaker_str else None

            if content_text:
                segments.append(ContentSegment(
                    segment_id=idx,
                    text=content_text,
                    timestamp_start=t_start,
                    timestamp_end=t_end,
                    speaker=speaker,
                    content_type=ContentType.TEXT
                ))

    # Fallback if no timestamps were matched: split into paragraphs with estimated synthetic timeline
    if not segments:
        paragraphs = [p.strip() for p in raw_text.split("\n\n") if p.strip()]
        current_time = 0.0
        for idx, p in enumerate(paragraphs, start=1):
            # Estimate ~150 words per minute -> 2.5 words per second
            word_count = len(p.split())
            duration = max(5.0, word_count / 2.5)
            segments.append(ContentSegment(
                segment_id=idx,
                text=p,
                timestamp_start=current_time,
                timestamp_end=current_time + duration,
                content_type=ContentType.TEXT
            ))
            current_time += duration

    return segments


class TranscriptionProvider(ABC):
    """Abstract interface for audio/video transcription services."""

    @abstractmethod
    def transcribe(
        self,
        file_path: str,
        mime_type: str,
        prompt: Optional[str] = None
    ) -> List[ContentSegment]:
        """Transcribes media file into timestamped content segments."""
        pass


class GeminiTranscriptionProvider(TranscriptionProvider):
    """
    Google Gemini Multimodal Transcription Provider.
    Uploads audio/video via GenAI client and prompts for high-fidelity timestamped segments.
    """

    def __init__(self, gemini_client, model_name: str = "gemini-1.5-flash"):
        self.client = gemini_client
        self.model_name = model_name

    def transcribe(
        self,
        file_path: str,
        mime_type: str,
        prompt: Optional[str] = None
    ) -> List[ContentSegment]:
        if self.client is None:
            logger.warning("Gemini client unavailable; returning empty transcription segments.")
            return []

        default_instruction = (
            "You are a precise academic transcription engine. Transcribe this audio/video with exact timestamps.\n"
            "Format your transcription strictly as a sequence of timestamped blocks in this format:\n"
            "[MM:SS - MM:SS] Speaker: Spoken transcript content\n\n"
            "Ensure timestamps reflect the exact speech timing."
        )
        instruction = prompt or default_instruction

        try:
            with open(file_path, "rb") as media_f:
                uploaded_media = self.client.files.upload(
                    file=media_f,
                    config={"mime_type": mime_type}
                )

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[instruction, uploaded_media]
            )

            response_text = response.text if response and response.text else ""
            return extract_timestamped_segments(response_text)
        except Exception as e:
            logger.error(f"❌ Gemini transcription error: {e}")
            return []


class MockTranscriptionProvider(TranscriptionProvider):
    """
    Deterministic transcription provider for automated testing and offline development.
    """

    def __init__(self, mock_segments: Optional[List[ContentSegment]] = None):
        self.mock_segments = mock_segments

    def transcribe(
        self,
        file_path: str,
        mime_type: str,
        prompt: Optional[str] = None
    ) -> List[ContentSegment]:
        if self.mock_segments:
            return self.mock_segments

        # Default deterministic segments
        return [
            ContentSegment(
                segment_id=1,
                text="Welcome to the lecture on Artificial Intelligence and Neural Networks.",
                timestamp_start=0.0,
                timestamp_end=15.0,
                speaker="Instructor",
                heading="Introduction"
            ),
            ContentSegment(
                segment_id=2,
                text="Today we explore gradient descent, backpropagation, and loss surfaces.",
                timestamp_start=15.0,
                timestamp_end=45.0,
                speaker="Instructor",
                heading="Core Concepts"
            ),
            ContentSegment(
                segment_id=3,
                text="In gradient descent, we calculate the partial derivatives of the loss function with respect to weights.",
                timestamp_start=45.0,
                timestamp_end=90.0,
                speaker="Instructor",
                heading="Mathematical Formulation"
            )
        ]
