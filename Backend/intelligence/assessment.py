"""
Phase 3 Assessment Engine
Evidence-grounded generation of multi-modal quizzes and spaced-repetition flashcards.
Strictly consumes Phase 2 document chunks and preserves 100% backward compatibility.
"""

import json
import re
import logging
from typing import List, Dict, Any, Optional
from .models import GroundedQuizQuestion, GroundedFlashcard, QuestionType

logger = logging.getLogger(__name__)


def clean_json_string(raw: str) -> str:
    """Strips markdown code blocks, backticks, and whitespace."""
    text = raw.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        text = match.group(1).strip()
    return text


class AssessmentEngine:
    """
    Constructs evidence-grounded quizzes and flashcards from Phase 2 RAG chunks.
    """

    @classmethod
    def generate_quiz(
        cls,
        chunks: List[Dict[str, Any]],
        num_questions: int = 5,
        difficulty: str = "intermediate",
        topic: Optional[str] = None,
        gemini_client: Any = None,
        model_name: str = "gemini-2.5-flash",
        generate_fallback_fn: Any = None
    ) -> List[Dict[str, Any]]:
        """
        Generates grounded quiz questions from retrieved chunks.
        Returns a list of dictionaries with full backward compatibility:
        [{question, options, answer, explanation, difficulty, page_number, topic, ...}]
        """
        num_questions = max(1, min(num_questions, 20))
        
        # Build evidence context from chunks
        evidence_text = ""
        chunk_map = {}
        for idx, c in enumerate(chunks[:8]):
            cid = f"chunk_{c.get('chunk_index', idx)}"
            chunk_map[cid] = c
            p = c.get("page_number")
            sec = c.get("section_heading", "General")
            txt = c.get("text_content", "") or c.get("text", "")
            page_label = f"Page {p}" if p is not None else "N/A"
            evidence_text += f"\n--- SOURCE CHUNK [{cid}] ({page_label}, Section: {sec}) ---\n{txt}\n"

        if not evidence_text.strip():
            logger.warning("No evidence chunks available for grounded quiz generation.")
            return []

        topic_clause = f"TARGET TOPIC: {topic}\n" if topic else ""
        prompt = f"""You are an expert academic examiner.
Generate exactly {num_questions} high-quality, evidence-grounded questions based SOLELY on the study context below.

DIFFICULTY LEVEL: {difficulty.upper()}
{topic_clause}
STRICT GROUNDING INSTRUCTIONS:
1. Every question and answer MUST be directly supported by facts in the provided chunks.
2. DO NOT make up questions about concepts not mentioned in the source context.
3. For each question, link the exact source chunk ID, page number (integer for PDF, null if N/A), and section heading where the answer is verified.
4. "answer" must be the 0-based integer index of the correct option in the "options" list.
5. Provide a clear, educational "explanation" citing the source evidence.

Return ONLY a valid JSON array of objects with no surrounding markdown or conversational text:
[
  {{
    "question": "Clear question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": 0,
    "explanation": "Why this option is correct based on the text.",
    "question_type": "MCQ",
    "difficulty": "{difficulty}",
    "topic": "{topic or 'Core Subject'}",
    "source_chunk_id": "chunk_0",
    "page_number": null,
    "section_heading": "Heading Name"
  }}
]

--- STUDY CONTEXT ---
{evidence_text}
"""

        raw_response = ""
        try:
            if gemini_client and hasattr(gemini_client, "models"):
                res = gemini_client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                raw_response = res.text or ""
            elif generate_fallback_fn:
                raw_response = generate_fallback_fn(evidence_text, prompt)
            else:
                logger.error("No generator available for quiz generation.")
                return []
        except Exception as e:
            logger.error(f"Failed to generate quiz via LLM: {e}")
            return []

        cleaned = clean_json_string(raw_response)
        parsed_data = []
        try:
            parsed_data = json.loads(cleaned)
        except Exception as parse_err:
            logger.warning(f"Initial JSON parse failed: {parse_err}. Attempting regex recovery.")
            # Use greedy match to capture the outermost [...] array, not inner brackets
            arr_match = re.search(r"\[([\s\S]*)\]", cleaned)
            if arr_match:
                try:
                    parsed_data = json.loads(f"[{arr_match.group(1)}]")
                except Exception:
                    pass

        # Validate and enforce backward compatibility schema
        validated_quiz = []
        if isinstance(parsed_data, list):
            for item in parsed_data:
                if not isinstance(item, dict):
                    continue
                q = item.get("question", "").strip()
                opts = item.get("options", [])
                ans = item.get("answer", 0)
                exp = item.get("explanation", "").strip()

                if not q or not isinstance(opts, list) or len(opts) < 2:
                    continue

                # Ensure integer answer index
                try:
                    ans_idx = int(ans)
                    if ans_idx < 0 or ans_idx >= len(opts):
                        ans_idx = 0
                except (ValueError, TypeError):
                    ans_idx = 0

                cid = item.get("source_chunk_id")
                matched_chunk = chunk_map.get(cid, {}) if cid else {}
                # Ground truth: if chunk is known, its page_number is authoritative.
                # If chunk is unknown but document is paginated, fallback to item.page_number.
                # For unpaginated sources (audio/video/web/text), strictly enforce None.
                if matched_chunk:
                    raw_page = matched_chunk.get("page_number")
                elif has_pages:
                    raw_page = item.get("page_number")
                else:
                    raw_page = None
                sec = item.get("section_heading") or matched_chunk.get("section_heading", "")

                validated_quiz.append({
                    "question": q,
                    "options": [str(o).strip() for o in opts],
                    "answer": ans_idx,
                    "explanation": exp or "Based on retrieved document evidence.",
                    "question_type": item.get("question_type", "MCQ"),
                    "difficulty": item.get("difficulty", difficulty),
                    "topic": item.get("topic") or topic or "General",
                    "source_chunk_id": cid or (f"chunk_{matched_chunk.get('chunk_index', 0)}" if matched_chunk else None),
                    "page_number": int(raw_page) if raw_page is not None else None,
                    "section_heading": sec or ""
                })

        return validated_quiz[:num_questions]

    @classmethod
    def generate_flashcards(
        cls,
        chunks: List[Dict[str, Any]],
        num_cards: int = 6,
        difficulty: str = "intermediate",
        topic: Optional[str] = None,
        gemini_client: Any = None,
        model_name: str = "gemini-2.5-flash",
        generate_fallback_fn: Any = None
    ) -> List[Dict[str, Any]]:
        """
        Generates grounded flashcards from retrieved chunks.
        Returns a list of dictionaries with full backward compatibility:
        [{front, back, topic, difficulty, page_number, ...}]
        """
        num_cards = max(1, min(num_cards, 30))

        evidence_text = ""
        for idx, c in enumerate(chunks[:8]):
            p = c.get("page_number")
            sec = c.get("section_heading", "General")
            txt = c.get("text_content", "") or c.get("text", "")
            page_label = f"Page {p}" if p is not None else "N/A"
            evidence_text += f"\n--- SOURCE CHUNK [{idx}] ({page_label}, Section: {sec}) ---\n{txt}\n"

        if not evidence_text.strip():
            logger.warning("No evidence chunks available for flashcard generation.")
            return []

        topic_clause = f"TARGET TOPIC: {topic}\n" if topic else ""
        prompt = f"""Create exactly {num_cards} high-yield academic study flashcards based SOLELY on the study context below.

DIFFICULTY LEVEL: {difficulty.upper()}
{topic_clause}
STRICT GROUNDING INSTRUCTIONS:
1. Every card MUST test a concrete concept, formula, rule, or definition present in the text.
2. "front": Concise prompt, question, or term (maximum 15 words).
3. "back": Crisp, accurate answer or definition (maximum 40 words).
4. Tag each card with its topic, difficulty level, and page number (integer for PDF, null if N/A).

Return ONLY a valid JSON array of objects with no markdown wrapping:
[
  {{
    "front": "Concise question or term?",
    "back": "Clear definition or answer grounded in the material.",
    "topic": "{topic or 'Core Subject'}",
    "difficulty": "{difficulty}",
    "page_number": null
  }}
]

--- STUDY CONTEXT ---
{evidence_text}
"""

        raw_response = ""
        try:
            if gemini_client and hasattr(gemini_client, "models"):
                res = gemini_client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                raw_response = res.text or ""
            elif generate_fallback_fn:
                raw_response = generate_fallback_fn(evidence_text, prompt)
        except Exception as e:
            logger.error(f"Failed to generate flashcards via LLM: {e}")
            return []

        cleaned = clean_json_string(raw_response)
        parsed_data = []
        try:
            parsed_data = json.loads(cleaned)
        except Exception as parse_err:
            logger.warning(f"Flashcard JSON parse failed: {parse_err}. Attempting regex recovery.")
            arr_match = re.search(r"\[([\s\S]*)\]", cleaned)
            if arr_match:
                try:
                    parsed_data = json.loads(f"[{arr_match.group(1)}]")
                except Exception:
                    pass

        validated_cards = []
        if isinstance(parsed_data, list):
            for item in parsed_data:
                if not isinstance(item, dict):
                    continue
                front = item.get("front", "").strip()
                back = item.get("back", "").strip()
                if not front or not back:
                    continue

                raw_page = item.get("page_number") if has_pages else None
                validated_cards.append({
                    "front": front,
                    "back": back,
                    "topic": item.get("topic") or topic or "General",
                    "difficulty": item.get("difficulty", difficulty),
                    "page_number": int(raw_page) if raw_page is not None else None
                })

        return validated_cards[:num_cards]
