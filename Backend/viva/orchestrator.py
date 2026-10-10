"""Orchestration Engine for Viva / Oral Examination Mode.

Handles:
- Grounded viva question synthesis from RAG chunks
- Pedagogical alignment with TeachingMode and VivaMode
- Adaptive follow-up question sequencing with strict boundary limits
- Comprehensive post-viva performance synthesis
"""

import json
import logging
import re
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from database import DocumentChunk, StudySession
from .models import VivaMode, FollowUpType

logger = logging.getLogger("florix.viva.orchestrator")


class VivaOrchestrator:
    """Manages question synthesis, follow-up branching, and performance synthesis."""

    @classmethod
    def generate_questions(
        cls,
        topic: str,
        viva_mode: str,
        teaching_mode: str,
        difficulty: str,
        num_questions: int,
        chunks: List[Any],
        session: Optional[StudySession] = None,
        gemini_client: Any = None,
        model_name: str = "gemini-3.6-flash",
        generate_fallback_fn: Any = None,
    ) -> List[Dict[str, Any]]:
        """Synthesizes grounded viva oral questions using a resilient 3-tier cascade."""
        # Tier 1: Grounded LLM Generation
        if gemini_client and hasattr(gemini_client, "models") and chunks:
            try:
                llm_qs = cls._generate_with_gemini(
                    topic=topic,
                    viva_mode=viva_mode,
                    teaching_mode=teaching_mode,
                    difficulty=difficulty,
                    num_questions=num_questions,
                    chunks=chunks,
                    session=session,
                    gemini_client=gemini_client,
                    model_name=model_name
                )
                if llm_qs and len(llm_qs) >= 1:
                    return llm_qs[:num_questions]
            except Exception as e:
                logger.warning(f"⚠️ Gemini viva question generation failed ({e}). Cascading to fallback.")

        # Tier 2: Custom fallback function if provided
        if generate_fallback_fn:
            try:
                custom_qs = generate_fallback_fn(topic, num_questions, chunks)
                if custom_qs and len(custom_qs) >= 1:
                    return custom_qs[:num_questions]
            except Exception as fe:
                logger.warning(f"Custom viva question fallback error: {fe}")

        # Tier 3: Deterministic Grounded Generation from Document Chunks
        return cls._generate_deterministic_questions(
            topic=topic,
            num_questions=num_questions,
            chunks=chunks,
            session=session,
            difficulty=difficulty
        )

    @classmethod
    def _generate_with_gemini(
        cls,
        topic: str,
        viva_mode: str,
        teaching_mode: str,
        difficulty: str,
        num_questions: int,
        chunks: List[Any],
        session: Optional[StudySession],
        gemini_client: Any,
        model_name: str
    ) -> Optional[List[Dict[str, Any]]]:
        """Queries Gemini for deep, grounded viva questions requiring oral explanation."""
        chunk_contexts = []
        is_pdf = session and session.source_type == "pdf"

        for idx, c in enumerate(chunks[:8]):
            c_id = getattr(c, "id", getattr(c, "chunk_index", idx))
            c_text = getattr(c, "text_content", getattr(c, "text", ""))
            c_page = getattr(c, "page_number", None) if is_pdf else None
            c_heading = getattr(c, "section_heading", "General")
            chunk_contexts.append(
                f"[Chunk {c_id} | Page: {c_page or 'N/A'} | Section: {c_heading}]\n{c_text[:800]}"
            )

        context_blob = "\n\n".join(chunk_contexts)

        prompt = f"""You are a distinguished University Professor conducting an oral viva examination on the subject '{topic}'.
Mode: {viva_mode}
Teaching Rigor: {teaching_mode}
Difficulty: {difficulty}

Generate exactly {num_questions} oral viva questions that probe conceptual depth, mechanisms, and real-world application.
Rules:
1. Every question MUST be grounded in the provided source chunks. Do not invent non-existent concepts.
2. Questions must be open-ended suitable for spoken/verbal examination (avoid simple yes/no or multiple-choice formats).
3. Types to use: conceptual, why_how, application, definition, comparison, scenario.
4. For each question, extract 3-5 specific 'expected_concepts' (technical keywords or mechanisms the student must verbalize).
5. Link each question to the source chunk index and page number if available.

SOURCE CONTEXT:
{context_blob}

Output ONLY valid JSON matching this schema:
{{
  "questions": [
    {{
      "question_text": "<open-ended oral examination question>",
      "question_type": "<conceptual | why_how | application | definition | comparison | scenario>",
      "expected_concepts": ["<keyword 1>", "<keyword 2>", "<keyword 3>"],
      "topic": "{topic}",
      "difficulty": "{difficulty}",
      "source_chunk_id": "<chunk index>",
      "page_number": <number or null>,
      "citation_excerpt": "<1-2 sentence excerpt from chunk justifying this question>"
    }}
  ]
}}"""

        response = gemini_client.models.generate_content(
            model=model_name,
            contents=prompt
        )

        if not response or not response.text:
            return None

        raw = response.text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
        raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE).strip()

        data = json.loads(raw)
        qs = data.get("questions", [])

        results = []
        for q in qs:
            results.append({
                "question_text": q.get("question_text", "Explain the fundamental mechanism."),
                "question_type": q.get("question_type", "conceptual"),
                "expected_concepts": q.get("expected_concepts", [topic]),
                "topic": q.get("topic", topic),
                "difficulty": difficulty,
                "source_chunk_id": str(q.get("source_chunk_id", "0")),
                "page_number": q.get("page_number") if is_pdf else None,
                "citation_excerpt": q.get("citation_excerpt", ""),
                "is_follow_up": False,
                "max_follow_ups": 2 if viva_mode == "EXAM_PREPARATION_VIVA" else 1,
            })

        return results

    @classmethod
    def _generate_deterministic_questions(
        cls,
        topic: str,
        num_questions: int,
        chunks: List[Any],
        session: Optional[StudySession],
        difficulty: str
    ) -> List[Dict[str, Any]]:
        """Deterministic question synthesis based on available source chunks."""
        is_pdf = session and session.source_type == "pdf"
        questions = []

        templates = [
            ("conceptual", "Can you explain the foundational principles governing {topic} as detailed in the course material?"),
            ("why_how", "In detail, how does {topic} operate under practical constraints, and why is this architectural design chosen?"),
            ("application", "Suppose you are tasked with implementing {topic} in a real-world scenario. What edge cases must you handle?"),
            ("comparison", "How does {topic} compare with alternative approaches in terms of efficiency, scalability, and trade-offs?"),
            ("definition", "Provide a formal academic definition of {topic} and identify its essential operational prerequisites."),
            ("scenario", "Walk me through what happens when an unexpected failure occurs within the workflow of {topic}."),
        ]

        for i in range(num_questions):
            tmpl_type, tmpl_text = templates[i % len(templates)]
            chunk = chunks[i % len(chunks)] if chunks else None

            chunk_id = getattr(chunk, "id", getattr(chunk, "chunk_index", i)) if chunk else str(i)
            chunk_page = getattr(chunk, "page_number", None) if is_pdf else None
            chunk_text = getattr(chunk, "text_content", getattr(chunk, "text", "")) if chunk else ""
            excerpt = chunk_text[:160] + "..." if len(chunk_text) > 160 else chunk_text

            # Extract key terms for expected concepts
            words = [w for w in re.findall(r"\b[a-zA-Z]{5,}\b", chunk_text) if w.lower() not in {"which", "their", "there", "about", "could", "would"}]
            expected = words[:4] if words else [w for w in re.findall(r"\b[a-zA-Z]{3,}\b", topic)]

            questions.append({
                "question_text": tmpl_text.format(topic=topic),
                "question_type": tmpl_type,
                "expected_concepts": expected,
                "topic": topic,
                "difficulty": difficulty,
                "source_chunk_id": str(chunk_id),
                "page_number": chunk_page,
                "citation_excerpt": excerpt or f"Fundamental curriculum overview of {topic}.",
                "is_follow_up": False,
                "max_follow_ups": 1,
            })

        return questions

    @classmethod
    def generate_follow_up(
        cls,
        parent_question: Any,
        user_answer: str,
        eval_result: Dict[str, Any],
        source_context: str = "",
        gemini_client: Any = None,
        model_name: str = "gemini-3.6-flash",
    ) -> Optional[Dict[str, Any]]:
        """Generates a bounded, probing follow-up question when understanding is incomplete."""
        if parent_question.follow_up_count >= parent_question.max_follow_ups:
            return None

        # Check if evaluator suggested a prompt
        suggested = eval_result.get("follow_up_prompt")
        f_type = eval_result.get("follow_up_type", "CLARIFICATION")

        if suggested and suggested.strip():
            return {
                "question_text": suggested.strip(),
                "question_type": "follow_up",
                "expected_concepts": eval_result.get("missing_concepts", [parent_question.topic]),
                "topic": parent_question.topic,
                "difficulty": parent_question.difficulty,
                "source_chunk_id": parent_question.source_chunk_id,
                "page_number": parent_question.page_number,
                "citation_excerpt": parent_question.citation_excerpt,
                "is_follow_up": True,
                "parent_question_id": parent_question.id,
                "follow_up_count": parent_question.follow_up_count + 1,
                "max_follow_ups": parent_question.max_follow_ups,
            }

        # Deterministic targeted follow-up fallback
        missing = eval_result.get("missing_concepts", [])
        target_concept = missing[0] if missing else parent_question.topic

        text = f"You touched on the core idea, but could you elaborate more deeply on how '{target_concept}' functions here?"

        return {
            "question_text": text,
            "question_type": "follow_up",
            "expected_concepts": [target_concept],
            "topic": parent_question.topic,
            "difficulty": parent_question.difficulty,
            "source_chunk_id": parent_question.source_chunk_id,
            "page_number": parent_question.page_number,
            "citation_excerpt": parent_question.citation_excerpt,
            "is_follow_up": True,
            "parent_question_id": parent_question.id,
            "follow_up_count": parent_question.follow_up_count + 1,
            "max_follow_ups": parent_question.max_follow_ups,
        }

    @classmethod
    def synthesize_results(cls, session_obj: Any, turns: List[Any]) -> Dict[str, Any]:
        """Computes comprehensive oral exam synthesis from all turns."""
        if not turns:
            return {
                "overall_score": 0.0,
                "passed": False,
                "proficiency_level": "Needs Review",
                "overall_feedback": "Viva session concluded without submitted answers.",
                "strong_areas": [],
                "weak_areas": [session_obj.topic],
            }

        scores = [t.overall_score for t in turns]
        avg_score = round(sum(scores) / len(scores), 1)
        passed = avg_score >= 60.0

        if avg_score >= 88.0:
            level = "Exceptional Mastery"
        elif avg_score >= 75.0:
            level = "Proficient Understanding"
        elif avg_score >= 60.0:
            level = "Developing Competency"
        else:
            level = "Needs Foundational Review"

        # Topic aggregation
        strong = []
        weak = []
        for t in turns:
            q_topic = getattr(t.question, "topic", session_obj.topic) if hasattr(t, "question") else session_obj.topic
            if t.overall_score >= 75.0 and q_topic not in strong:
                strong.append(q_topic)
            elif t.overall_score < 65.0 and q_topic not in weak:
                weak.append(q_topic)

        feedback = (
            f"Oral examination completed with an average score of {avg_score}%. "
            f"Demonstrated {level.lower()} in {session_obj.topic}. "
        )
        if strong:
            feedback += f"Strong conceptual clarity in: {', '.join(strong)}. "
        if weak:
            feedback += f"Recommend revisiting foundational mechanics in: {', '.join(weak)}."

        return {
            "overall_score": avg_score,
            "passed": passed,
            "proficiency_level": level,
            "overall_feedback": feedback,
            "strong_areas": strong,
            "weak_areas": weak or ([session_obj.topic] if not passed else []),
        }
