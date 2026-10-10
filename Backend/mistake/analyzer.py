"""Core analysis engine for Mistake Intelligence & Metacognitive Debugging.

Orchestrates:
- Evidence retrieval via existing RAG DocumentChunks
- Pedagogical classification against controlled MistakeCategory taxonomy
- Misconception diagnosis adapting to Phase 3 TeachingMode
- Longitudinal PatternState detection from real assessment history
- Prerequisite gap resolution from existing session structure & Phase 5 visuals
- Strict hallucination safeguards & Tier-3 deterministic fallback
"""

import json
import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session

from database import (
    StudySession,
    DocumentChunk,
    LearningEvent,
    LearnerTopicMastery,
    VisualArtifact,
    QuizResult,
    ExamAnswer,
    ExamQuestion,
    ExamAttempt
)
from intelligence.assessment import clean_json_string
from .taxonomy import (
    MistakeCategory,
    PatternState,
    CATEGORY_METADATA,
    normalize_category
)

logger = logging.getLogger("florix.mistake.analyzer")

MISTAKE_DEBUGGER_SYSTEM_PROMPT = """You are Florix AI's Metacognitive Debugger and Senior Academic Tutor.
Your mission is NOT just to state the correct answer, but to understand WHY the student made this mistake.

Analyze the question, the student's chosen answer, the correct answer, and the verified source evidence.

Identify:
1. The exact ERROR CATEGORY from this strict list:
   - CONCEPTUAL_MISUNDERSTANDING: Fundamental flaw in theory or definition.
   - PARTIAL_UNDERSTANDING: Grasps general idea but misses edge cases, conditions, or nuance.
   - PROCEDURAL_ERROR: Erred in step-by-step methodology or algorithm trace.
   - CALCULATION_ERROR: Numerical/arithmetic/indexing mistake.
   - CARELESS_ERROR: Overlooked explicit details or hasty pick.
   - MISREAD_QUESTION: Misinterpreted prompt wording (e.g., missed NOT, EXCEPT, FALSE).
   - MEMORY_RECALL_FAILURE: Inability to recall memorized standard terms or formulas.
   - PREREQUISITE_GAP: Lacks foundational concept needed to solve this.
   - CONFUSION_BETWEEN_CONCEPTS: Conflated two distinct but related concepts.
   - INCORRECT_APPLICATION: Understood rule correctly but misapplied it to this scenario.
   - UNKNOWN: Insufficient evidence to classify definitively.

2. MISCONCEPTION: A concise 1-sentence description of the mental flaw (e.g. "Confusing 2NF partial dependencies with 3NF transitive dependencies").
3. WHY_INCORRECT: A clear, empathetic explanation of why the student's answer does NOT hold, grounded in the source text.
4. CORRECT_REASONING: The exact deductive or conceptual steps that lead directly to the correct answer.
5. PREREQUISITE_CONCEPT: Foundational prerequisite topic if a gap is suspected.

CRITICAL INSTRUCTIONS:
- You must ground your explanation strictly in the provided verified evidence.
- NEVER invent citations, page numbers, or uncited facts.
- Return ONLY a valid JSON object matching the requested schema.
"""


def resolve_answer_text(answer_val: Any, options: Optional[List[str]] = None) -> str:
    """Converts an answer index or string into clean display text."""
    if answer_val is None:
        return "Unanswered"
    if options and isinstance(answer_val, int) and 0 <= answer_val < len(options):
        return options[answer_val]
    # Check if answer_val is a stringified int or option label
    if options and isinstance(answer_val, str):
        s_val = answer_val.strip()
        if s_val.isdigit():
            idx = int(s_val)
            if 0 <= idx < len(options):
                return options[idx]
        elif len(s_val) == 1 and s_val.upper() in ["A", "B", "C", "D", "E"]:
            idx = ord(s_val.upper()) - 65
            if 0 <= idx < len(options):
                return options[idx]
        elif s_val.lower().startswith("option ") and s_val[7:].strip().isdigit():
            idx = int(s_val[7:].strip()) - 1
            if 0 <= idx < len(options):
                return options[idx]
    return str(answer_val).strip()


class MistakeAnalyzer:
    """Metacognitive diagnostic engine."""

    @classmethod
    def detect_pattern_state(
        cls,
        db: Session,
        user_id: int,
        topic: str,
        session_id: Optional[int] = None
    ) -> PatternState:
        """Determines longitudinal pattern state by evaluating real historical correctness on this topic."""
        clean_topic = (topic or "General").strip().lower()

        # Gather recent interactions from LearningEvents
        event_query = db.query(LearningEvent).filter(
            LearningEvent.user_id == user_id,
            LearningEvent.event_type.in_(["QUIZ_INTERACTION", "QUIZ_ANSWER", "EXAM_SUBMISSION", "MISTAKE_PRACTICE"])
        )

        if session_id:
            event_query = event_query.filter(LearningEvent.session_id == session_id)

        events = event_query.order_by(LearningEvent.id.desc()).limit(20).all()
        topic_history: List[bool] = []

        for ev in events:
            p = ev.payload or {}
            ev_topic = str(p.get("topic", "")).strip().lower()
            if ev_topic == clean_topic or clean_topic in ev_topic:
                is_corr = bool(p.get("is_correct", False))
                topic_history.append(is_corr)

        # If no history or only 1 error
        if not topic_history or len(topic_history) <= 1:
            return PatternState.ISOLATED

        # Evaluate streak of errors (history is newest to oldest)
        recent_err_streak = 0
        for is_corr in topic_history:
            if not is_corr:
                recent_err_streak += 1
            else:
                break

        if recent_err_streak >= 3:
            return PatternState.PERSISTENT
        elif recent_err_streak == 2:
            return PatternState.RECURRING

        # Check if recent was correct after prior errors
        if topic_history[0] is True and any(h is False for h in topic_history[1:]):
            if topic_history[:2] == [True, True]:
                return PatternState.RESOLVED
            return PatternState.IMPROVING

        return PatternState.ISOLATED

    @classmethod
    def detect_prerequisites(
        cls,
        db: Session,
        session: Any,
        topic: str
    ) -> Optional[str]:
        """Resolves prerequisite concepts from existing session structure or Phase 5 Visual Artifacts."""
        if not session:
            return None

        session_id = session.id if hasattr(session, "id") else session

        clean_topic = (topic or "").strip().lower()

        # 1. Check Phase 5 Visual Artifacts for explicit prerequisite edges
        visual = db.query(VisualArtifact).filter(
            VisualArtifact.session_id == session_id
        ).first()

        if visual and visual.visual_data and isinstance(visual.visual_data, dict):
            edges = visual.visual_data.get("edges", [])
            nodes = visual.visual_data.get("nodes", [])
            node_map = {n.get("id"): n.get("label", "") for n in nodes if isinstance(n, dict)}

            for edge in edges:
                if not isinstance(edge, dict):
                    continue
                rel = str(edge.get("relation_type") or edge.get("relation") or "").lower()
                target_label = str(node_map.get(edge.get("target"), "")).lower()
                source_label = str(node_map.get(edge.get("source"), "")).strip()

                if clean_topic in target_label and rel in ["prerequisite", "leads_to", "part_of"]:
                    if source_label:
                        return source_label

        # 2. Check session chunks for earlier foundational headings
        chunks = db.query(DocumentChunk).filter(
            DocumentChunk.session_id == session_id
        ).order_by(DocumentChunk.chunk_index).all()

        for c in chunks[:3]:
            h = (c.section_heading or "").strip()
            if h and clean_topic not in h.lower() and h.lower() not in ["overview", "introduction", "general"]:
                return h

        return None

    @classmethod
    def analyze(
        cls,
        db: Session,
        user_id: int,
        question_text: str,
        user_answer_raw: Any,
        correct_answer_raw: Any,
        options: Optional[List[str]] = None,
        topic: str = "General",
        subtopic: Optional[str] = None,
        difficulty: str = "intermediate",
        session_id: Optional[int] = None,
        section_heading: Optional[str] = None,
        page_number: Optional[int] = None,
        teaching_mode: str = "INTERMEDIATE",
        gemini_client: Any = None,
        model_name: str = "gemini-3.6-flash",
        generate_fallback_fn: Any = None,
        retriever_fn: Any = None
    ) -> Dict[str, Any]:
        """Generates grounded mistake intelligence analysis with multi-tier fallback."""
        user_ans_str = resolve_answer_text(user_answer_raw, options)
        corr_ans_str = resolve_answer_text(correct_answer_raw, options)
        session = db.query(StudySession).filter(StudySession.id == session_id).first() if session_id else None

        # 1. Retrieve grounded evidence from existing RAG
        evidence_chunks = []
        if retriever_fn and session_id:
            query = f"{topic} {question_text[:100]}"
            evidence_chunks = retriever_fn(
                session_id=session_id,
                query=query,
                db=db,
                top_k=4,
                user_id=user_id
            )

        if not evidence_chunks and session_id:
            db_chunks = db.query(DocumentChunk).filter(
                DocumentChunk.session_id == session_id
            ).limit(4).all()
            evidence_chunks = [
                {
                    "chunk_index": c.chunk_index,
                    "text_content": c.text_content,
                    "page_number": c.page_number,
                    "section_heading": c.section_heading
                }
                for c in db_chunks
            ]

        # 2. Detect longitudinal pattern state & prerequisite
        pattern_state = cls.detect_pattern_state(db, user_id, topic, session_id)
        prerequisite = cls.detect_prerequisites(db, session, topic)

        # 3. Format grounded evidence context
        evidence_text = ""
        citation_items = []
        for c in evidence_chunks:
            p_num = c.get("page_number")
            sec_h = c.get("section_heading") or "General"
            txt = c.get("text_content", "")[:600]
            evidence_text += f"\n[Chunk {c.get('chunk_index')} | Page {p_num} | {sec_h}]:\n{txt}\n"
            citation_items.append({
                "chunk_index": c.get("chunk_index"),
                "page_number": p_num,
                "section_heading": sec_h,
                "snippet": txt[:180]
            })

        # 4. Construct AI Prompt
        prompt = (
            f"STUDY TOPIC: {topic}\n"
            f"DIFFICULTY: {difficulty.upper()}\n"
            f"TEACHING MODE: {teaching_mode.upper()}\n"
            f"QUESTION:\n{question_text}\n\n"
            f"OPTIONS:\n{json.dumps(options or [], indent=2)}\n\n"
            f"STUDENT'S ANSWER: {user_ans_str}\n"
            f"CORRECT ANSWER: {corr_ans_str}\n\n"
            f"VERIFIED SOURCE EVIDENCE:\n{evidence_text or 'No direct source chunks retrieved; rely on verified domain principles.'}\n\n"
            "Return JSON matching:\n"
            "{\n"
            '  "error_category": "CONCEPTUAL_MISUNDERSTANDING | PARTIAL_UNDERSTANDING | PROCEDURAL_ERROR | CALCULATION_ERROR | CARELESS_ERROR | MISREAD_QUESTION | MEMORY_RECALL_FAILURE | PREREQUISITE_GAP | CONFUSION_BETWEEN_CONCEPTS | INCORRECT_APPLICATION | UNKNOWN",\n'
            '  "misconception": "1-sentence description of the mental model gap",\n'
            '  "why_incorrect": "Empathetic, clear explanation of why the student answer is wrong",\n'
            '  "correct_reasoning": "Step-by-step logic leading directly to the correct answer",\n'
            '  "prerequisite_concept": "Foundational topic name or null"\n'
            "}"
        )

        parsed_data = None

        # Try Gemini client
        try:
            if gemini_client and hasattr(gemini_client, "models"):
                res = gemini_client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                raw_text = res.text or ""
                parsed_data = json.loads(clean_json_string(raw_text))
            elif generate_fallback_fn:
                raw_text = generate_fallback_fn(prompt, MISTAKE_DEBUGGER_SYSTEM_PROMPT)
                parsed_data = json.loads(clean_json_string(raw_text))
        except Exception as e:
            logger.warning(f"LLM mistake analysis failed: {e}")

        # 5. Fallback if JSON parsing failed or response is invalid
        if not isinstance(parsed_data, dict) or not parsed_data.get("why_incorrect"):
            logger.info("Engaging Tier-3 deterministic grounded fallback for mistake analysis.")
            parsed_data = cls._generate_deterministic_fallback(
                question_text=question_text,
                user_ans=user_ans_str,
                corr_ans=corr_ans_str,
                topic=topic,
                evidence_chunks=evidence_chunks,
                prerequisite=prerequisite
            )

        cat = normalize_category(parsed_data.get("error_category", "UNKNOWN"))
        cat_meta = CATEGORY_METADATA.get(cat.value, CATEGORY_METADATA["UNKNOWN"])

        return {
            "error_category": cat.value,
            "category_label": cat_meta["label"],
            "misconception": str(parsed_data.get("misconception") or f"Misunderstanding regarding core rules of {topic}.").strip(),
            "why_incorrect": str(parsed_data.get("why_incorrect") or f"Your answer '{user_ans_str}' does not satisfy the requirements of {topic}.").strip(),
            "correct_reasoning": str(parsed_data.get("correct_reasoning") or f"The verified correct answer is '{corr_ans_str}', which adheres to the fundamental principles established in the study material.").strip(),
            "prerequisite_concept": parsed_data.get("prerequisite_concept") or prerequisite,
            "pattern_state": pattern_state.value,
            "citations": citation_items[:3],
            "teaching_mode": teaching_mode.upper(),
            "recommended_remediation": cat_meta["remediation"]
        }

    @classmethod
    def _generate_deterministic_fallback(
        cls,
        question_text: str,
        user_ans: str,
        corr_ans: str,
        topic: str,
        evidence_chunks: List[Dict[str, Any]],
        prerequisite: Optional[str] = None
    ) -> Dict[str, Any]:
        """Deterministic, grounded fallback providing vetted pedagogical explanations."""
        chunk_evidence = ""
        if evidence_chunks:
            chunk_evidence = evidence_chunks[0].get("text_content", "")[:250].strip()

        # Heuristic category determination
        category = MistakeCategory.CONCEPTUAL_MISUNDERSTANDING.value
        misconception = f"Incomplete grasp of the distinguishing properties of {topic}."

        if prerequisite:
            category = MistakeCategory.PREREQUISITE_GAP.value
            misconception = f"Gap in prerequisite concept '{prerequisite}', which is required to evaluate {topic}."
        elif "not" in question_text.lower() or "except" in question_text.lower():
            category = MistakeCategory.MISREAD_QUESTION.value
            misconception = "Overlooking qualifying negative condition ('NOT' or 'EXCEPT') in the question stem."

        why_incorrect = (
            f"Selecting '{user_ans}' contradicts the verified rules of {topic}. "
            f"In academic testing, this option represents an inaccurate condition."
        )
        if chunk_evidence:
            why_incorrect += f" As verified in the source text: \"{chunk_evidence}\""

        correct_reasoning = (
            f"The correct option is '{corr_ans}'. This accurately satisfies the definition and "
            f"constraints specified for {topic} in the verified study material."
        )

        return {
            "error_category": category,
            "misconception": misconception,
            "why_incorrect": why_incorrect,
            "correct_reasoning": correct_reasoning,
            "prerequisite_concept": prerequisite
        }
