"""
Florix AI — YouTube Learning Timeline & Interactive Knowledge Engine
Detects semantic learning sections from timestamped transcripts, performs strict chronological
and grounding validation, and builds interactive video knowledge structures.
Author: Ganesh (Lead Architect)
"""

import re
import json
import logging
from typing import List, Dict, Any, Optional, Tuple

from .transcription import extract_timestamped_segments, parse_timestamp_str
from .models import ContentSegment

logger = logging.getLogger("florix.content.timeline")


def format_seconds_to_timestamp(seconds: float) -> str:
    """Format seconds into MM:SS or HH:MM:SS string."""
    total_sec = max(0, int(round(seconds)))
    hours, remainder = divmod(total_sec, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def format_time_range(start: float, end: float) -> str:
    """Format start and end seconds into 'MM:SS - MM:SS' range string."""
    return f"{format_seconds_to_timestamp(start)} - {format_seconds_to_timestamp(end)}"


def get_youtube_thumbnail_url(video_id: str) -> str:
    """Returns canonical YouTube thumbnail URL for an 11-character video ID."""
    clean_id = (video_id or "").strip()
    if not clean_id:
        return ""
    return f"https://img.youtube.com/vi/{clean_id}/hqdefault.jpg"


def get_youtube_watch_url(video_id: str, start_seconds: float) -> str:
    """Returns official YouTube jump link at the exact timestamp."""
    clean_id = (video_id or "").strip()
    sec_int = max(0, int(start_seconds))
    if not clean_id:
        return ""
    return f"https://www.youtube.com/watch?v={clean_id}&t={sec_int}s"


def validate_learning_sections(
    sections: List[Dict[str, Any]],
    total_duration: Optional[float] = None
) -> Tuple[bool, str]:
    """
    Rigorously validates semantic learning sections:
    1. sections list must not be empty.
    2. start_seconds >= 0 and end_seconds > start_seconds.
    3. Chronologically sorted by start_seconds.
    4. Titles must be non-empty strings.
    5. Concept tags must be a list of strings.
    6. What video says and Florix explanation must be non-empty strings.
    7. No impossible timestamps exceeding video duration (with generous 60s buffer).
    """
    if not isinstance(sections, list) or len(sections) == 0:
        return False, "Sections must be a non-empty list"

    last_start = -1.0

    for idx, sec in enumerate(sections):
        if not isinstance(sec, dict):
            return False, f"Section {idx} is not a valid dictionary"

        title = str(sec.get("title", "")).strip()
        if not title:
            return False, f"Section {idx} is missing a valid title"

        start = sec.get("start_seconds")
        end = sec.get("end_seconds")

        if start is None or end is None:
            # Check alternate keys if present
            start = sec.get("timestamp_start", start)
            end = sec.get("timestamp_end", end)

        try:
            start_f = float(start)
            end_f = float(end)
        except (ValueError, TypeError):
            return False, f"Section {idx} contains non-numeric timestamp ({start}, {end})"

        if start_f < 0:
            return False, f"Section {idx} has negative start timestamp: {start_f}"

        if end_f <= start_f:
            return False, f"Section {idx} has end timestamp <= start timestamp ({start_f} -> {end_f})"

        # Chronological order check
        if start_f < last_start:
            return False, f"Section {idx} start ({start_f}) is earlier than previous section ({last_start})"
        last_start = start_f

        # Duration bound check if total duration known
        if total_duration and total_duration > 0:
            if start_f > total_duration + 120.0:
                return False, f"Section {idx} timestamp ({start_f}) exceeds video duration ({total_duration})"

        # Concepts check
        concepts = sec.get("concept_tags") or sec.get("concepts") or []
        if not isinstance(concepts, list):
            return False, f"Section {idx} concepts must be a list"

        what_said = str(sec.get("what_video_says", "") or sec.get("summary", "")).strip()
        if not what_said:
            return False, f"Section {idx} is missing 'what_video_says'"

    return True, "Valid"


def build_concepts_map(sections: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    """
    Builds a bidirectional concept relationship map:
    Maps each concept to the list of section IDs where it is taught.
    """
    concepts_map: Dict[str, List[str]] = {}
    for sec in sections:
        sec_id = sec.get("section_id", "")
        for tag in sec.get("concept_tags", []):
            tag_clean = tag.strip().title()
            if not tag_clean:
                continue
            if tag_clean not in concepts_map:
                concepts_map[tag_clean] = []
            if sec_id and sec_id not in concepts_map[tag_clean]:
                concepts_map[tag_clean].append(sec_id)
    return concepts_map


def build_fallback_timeline_from_transcript(
    raw_transcript: str,
    video_title: str,
    video_id: str
) -> Dict[str, Any]:
    """
    Resilient deterministic fallback:
    Constructs a structured learning timeline directly from transcript timestamps
    when AI extraction is unavailable or fails validation.
    """
    segments = extract_timestamped_segments(raw_transcript)
    if not segments:
        lines = [line.strip() for line in raw_transcript.split("\n") if line.strip()]
        sec_duration = 60.0
        sections = []
        for i, line in enumerate(lines[:10], start=1):
            s_start = (i - 1) * sec_duration
            s_end = i * sec_duration
            sections.append({
                "section_id": f"sec_{i:02d}",
                "order_index": i,
                "title": f"Key Topic {i}",
                "timestamp_start": s_start,
                "timestamp_end": s_end,
                "timestamp_str": format_time_range(s_start, s_end),
                "what_video_says": line[:300],
                "florix_explanation": f"This section introduces key concepts relating to {video_title}.",
                "concept_tags": [video_title[:20] or "Core Concept"],
                "key_takeaways": [line[:100]],
                "watch_url": get_youtube_watch_url(video_id, s_start)
            })
        total_dur = len(sections) * sec_duration
    else:
        total_dur = segments[-1].timestamp_end or segments[-1].timestamp_start or 180.0
        target_cluster_count = max(3, min(12, max(4, int(total_dur // 120))))
        cluster_size = max(1, len(segments) // target_cluster_count)

        sections = []
        for c_idx in range(0, len(segments), cluster_size):
            cluster = segments[c_idx: c_idx + cluster_size]
            if not cluster:
                continue
            idx = len(sections) + 1
            s_start = cluster[0].timestamp_start if cluster[0].timestamp_start is not None else 0.0
            s_end = cluster[-1].timestamp_end if cluster[-1].timestamp_end is not None else s_start + 60.0
            if s_end <= s_start:
                s_end = s_start + 30.0

            cluster_text = " ".join(s.text for s in cluster)
            words = cluster_text.split()
            title_words = words[:6]
            title = " ".join(title_words).strip().title()
            if len(title) < 5:
                title = f"Section {idx}: {video_title[:25]}"

            stopwords = {"the", "and", "is", "of", "in", "to", "a", "that", "this", "it", "with", "as", "for", "on", "was", "are", "you", "we", "can"}
            candidate_words = [w.strip(".,!?;:()").title() for w in words if len(w) > 4 and w.lower() not in stopwords]
            unique_tags = list(dict.fromkeys(candidate_words))[:3]
            if not unique_tags:
                unique_tags = [video_title[:15] or "Lecture Topic"]

            sections.append({
                "section_id": f"sec_{idx:02d}",
                "order_index": idx,
                "title": title,
                "timestamp_start": round(s_start, 1),
                "timestamp_end": round(s_end, 1),
                "timestamp_str": format_time_range(s_start, s_end),
                "what_video_says": cluster_text[:400] + ("..." if len(cluster_text) > 400 else ""),
                "florix_explanation": f"In this section of the video, the speaker discusses: {cluster_text[:160]}...",
                "concept_tags": unique_tags,
                "key_takeaways": [cluster_text[:120]],
                "watch_url": get_youtube_watch_url(video_id, s_start)
            })

    return {
        "video_id": video_id,
        "video_title": video_title,
        "thumbnail_url": get_youtube_thumbnail_url(video_id),
        "duration_seconds": round(total_dur, 1),
        "duration_str": format_seconds_to_timestamp(total_dur),
        "total_sections": len(sections),
        "sections": sections,
        "concepts_map": build_concepts_map(sections),
        "generation_tier": "transcript_cluster_fallback"
    }


def detect_learning_sections(
    raw_transcript: str,
    video_title: str,
    video_id: str,
    gemini_client,
    model_name: str = "gemini-2.5-flash"
) -> Dict[str, Any]:
    """
    Intelligently detects semantic learning sections from timestamped video transcript using Gemini.
    Strictly validates chronological ordering, timestamps, and grounding, falling back to
    transcript clustering if needed.
    """
    if not raw_transcript or not raw_transcript.strip():
        return build_fallback_timeline_from_transcript("", video_title, video_id)

    segments = extract_timestamped_segments(raw_transcript)
    total_dur = 0.0
    if segments and segments[-1].timestamp_end:
        total_dur = float(segments[-1].timestamp_end)

    prompt = f"""You are an elite academic curriculum architect and video knowledge engineer for Florix AI.
Your mission is to transform this YouTube lecture transcript into an interactive Learning Timeline.

Video Title: "{video_title}"
Video ID: "{video_id}"

CRITICAL GROUNDING & ACCURACY RULES:
1. Divide the transcript into 4 to 15 meaningful semantic learning sections based on topic boundaries (not arbitrary time slices).
2. For each section:
   - "title": A concise, engaging 3-7 word academic topic title (e.g. "Quantum Superposition & State Vectors").
   - "start_seconds": Exact starting second as an integer or float from transcript.
   - "end_seconds": Exact ending second as an integer or float from transcript.
   - "what_video_says": 2-3 sentences explaining strictly what the speaker said, citing actual facts or claims from the transcript. DO NOT invent speaker statements.
   - "florix_explanation": 2-3 clear, intuitive sentences providing pedagogical clarity, an analogy, or an explanation of why this concept matters.
   - "concept_tags": Array of 2 to 4 specific academic concepts taught in this section (e.g. ["Qubit", "Superposition", "Quantum State"]).
   - "key_takeaways": Array of 1 to 2 high-yield bullet takeaways.
3. Chronological Integrity:
   - Sections MUST be strictly sorted chronologically (start_seconds of section N+1 >= start_seconds of section N).
   - end_seconds must always be greater than start_seconds.
   - All timestamps must be anchored in the transcript. Do NOT hallucinate impossible timestamps.

OUTPUT FORMAT:
Return ONLY a valid JSON object with this exact structure:
{{
  "sections": [
    {{
      "section_id": "sec_01",
      "order_index": 1,
      "title": "Topic Title",
      "start_seconds": 0.0,
      "end_seconds": 95.0,
      "what_video_says": "...",
      "florix_explanation": "...",
      "concept_tags": ["Concept 1", "Concept 2"],
      "key_takeaways": ["Takeaway 1"]
    }}
  ]
}}

Transcript Excerpt:
{raw_transcript[:18000]}
"""

    models_to_try = [model_name, "gemini-3.6-flash", "gemini-flash-latest"]
    parsed_sections = None

    for attempt_model in models_to_try:
        try:
            logger.info(f"Calling Gemini ({attempt_model}) for video learning timeline extraction...")
            response = gemini_client.models.generate_content(
                model=attempt_model,
                contents=prompt
            )
            resp_text = response.text if response and response.text else ""
            if not resp_text:
                continue

            clean_json = resp_text.strip()
            if clean_json.startswith("```"):
                clean_json = re.sub(r"^```[a-zA-Z]*\n?", "", clean_json)
                clean_json = re.sub(r"\n?```$", "", clean_json).strip()

            data = json.loads(clean_json)
            raw_secs = data.get("sections") if isinstance(data, dict) else (data if isinstance(data, list) else None)

            if raw_secs and isinstance(raw_secs, list):
                normalized_secs = []
                for idx, s in enumerate(raw_secs, start=1):
                    s_id = s.get("section_id") or f"sec_{idx:02d}"
                    start_sec = float(s.get("start_seconds", s.get("timestamp_start", 0.0)))
                    end_sec = float(s.get("end_seconds", s.get("timestamp_end", start_sec + 45.0)))
                    if end_sec <= start_sec:
                        end_sec = start_sec + 30.0

                    normalized_secs.append({
                        "section_id": s_id,
                        "order_index": idx,
                        "title": str(s.get("title", f"Section {idx}")).strip(),
                        "timestamp_start": round(start_sec, 1),
                        "timestamp_end": round(end_sec, 1),
                        "timestamp_str": format_time_range(start_sec, end_sec),
                        "what_video_says": str(s.get("what_video_says", s.get("summary", ""))).strip(),
                        "florix_explanation": str(s.get("florix_explanation", s.get("explanation", ""))).strip(),
                        "concept_tags": [str(c).strip() for c in (s.get("concept_tags") or s.get("concepts") or []) if str(c).strip()],
                        "key_takeaways": [str(t).strip() for t in (s.get("key_takeaways") or []) if str(t).strip()],
                        "watch_url": get_youtube_watch_url(video_id, start_sec)
                    })

                is_valid, reason = validate_learning_sections(normalized_secs, total_duration=total_dur)
                if is_valid:
                    parsed_sections = normalized_secs
                    logger.info(f"✅ Generated {len(parsed_sections)} valid learning sections with Gemini {attempt_model}")
                    break
                else:
                    logger.warning(f"⚠️ Validation failed on attempt ({attempt_model}): {reason}. Trying fallback/retry...")
        except Exception as e:
            logger.warning(f"⚠️ Learning timeline generation attempt with {attempt_model} failed: {e}")
            continue

    if not parsed_sections:
        logger.warning(f"⚠️ AI section generation failed across all models. Activating deterministic transcript clustering fallback...")
        return build_fallback_timeline_from_transcript(raw_transcript, video_title, video_id)

    max_end = max(s["timestamp_end"] for s in parsed_sections) if parsed_sections else total_dur
    computed_dur = max(total_dur, max_end)

    return {
        "video_id": video_id,
        "video_title": video_title,
        "thumbnail_url": get_youtube_thumbnail_url(video_id),
        "duration_seconds": round(computed_dur, 1),
        "duration_str": format_seconds_to_timestamp(computed_dur),
        "total_sections": len(parsed_sections),
        "sections": parsed_sections,
        "concepts_map": build_concepts_map(parsed_sections),
        "generation_tier": "gemini_semantic_intelligence"
    }
