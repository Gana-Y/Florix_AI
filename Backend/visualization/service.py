"""
Florix AI — Phase 5 Visual Learning Service
End-to-end orchestration of readiness analysis, RAG retrieval, Gemini generation,
schema validation, deterministic layout, and learner topic mastery overlay.
Author: Ganesh (Lead Architect) & Aria
"""

import json
import logging
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Callable

from fastapi import HTTPException
from sqlalchemy.orm import Session

try:
    from database import (
        StudySession,
        DocumentChunk,
        LearnerTopicMastery,
        LearningEvent,
        VisualArtifact,
    )
except ImportError:
    from Backend.database import (
        StudySession,
        DocumentChunk,
        LearnerTopicMastery,
        LearningEvent,
        VisualArtifact,
    )
from .models import (
    VisualType,
    RelationType,
    VisualReadinessStatus,
    ReadinessAnalysis,
    VisualNode,
    VisualEdge,
    VisualDocument,
    VisualizeRequest,
    VisualArtifactCreate,
    VisualArtifactUpdate
)
from .analyzer import VisualReadinessAnalyzer
from .prompts import (
    SYSTEM_VISUAL_ARCHITECT_PROMPT,
    build_visual_generation_prompt
)
from .validator import (
    VisualValidator,
    sanitize_visual_text,
    normalize_relation_type
)

logger = logging.getLogger(__name__)


def extract_json_object(raw_text: str) -> Optional[Dict[str, Any]]:
    """
    Extracts pure JSON object from LLM response, stripping markdown code blocks.
    """
    if not raw_text or not raw_text.strip():
        return None

    cleaned = raw_text.strip()
    # Strip markdown fence ```json ... ``` or ``` ... ```
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        cleaned = cleaned.strip()

    # Try direct parse
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            return data
    except Exception:
        pass

    # Find outermost matching braces { ... }
    first_brace = cleaned.find("{")
    last_brace = cleaned.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        candidate = cleaned[first_brace : last_brace + 1]
        try:
            data = json.loads(candidate)
            if isinstance(data, dict):
                return data
        except Exception:
            pass

    return None


class VisualLearningService:
    """
    Core service coordinating visual learning capabilities.
    """

    @classmethod
    def analyze_readiness(
        cls,
        text: Optional[str],
        visual_type: VisualType = VisualType.CONCEPT_MAP
    ) -> ReadinessAnalysis:
        """Evaluates whether text has sufficient conceptual density for visual generation."""
        return VisualReadinessAnalyzer.analyze_content(text, visual_type)

    @classmethod
    def generate_grounded_visual(
        cls,
        session_id: int,
        user_id: int,
        request: VisualizeRequest,
        db: Session,
        llm_generate_fn: Callable[[str, str], str],
        retriever_fn: Callable[..., List[Dict[str, Any]]]
    ) -> VisualDocument:
        """
        Generates a grounded academic visual from a snippet, topic, or session context.
        """
        # 1. Authorize session ownership
        session = db.query(StudySession).filter(
            StudySession.id == session_id,
            StudySession.user_id == user_id
        ).first()
        if not session:
            raise HTTPException(status_code=404, detail="Study session not found or unauthorized")

        # 2. Check snippet readiness if snippet was provided
        if request.snippet:
            analysis = cls.analyze_readiness(request.snippet, request.visual_type)
            if not analysis.can_generate and analysis.status in (
                VisualReadinessStatus.INSUFFICIENT,
                VisualReadinessStatus.UNAVAILABLE,
                VisualReadinessStatus.ERROR
            ):
                raise HTTPException(
                    status_code=400,
                    detail=f"Visual generation unavailable: {analysis.message}"
                )

        # 3. Retrieve relevant chunks
        query = (request.topic or request.snippet or session.ai_title or session.filename or "overview").strip()
        chunks = retriever_fn(
            session_id=session_id,
            query=query,
            db=db,
            top_k=8,
            user_id=user_id
        )

        # Fallback to direct session chunks if retriever returns empty
        if not chunks:
            db_chunks = db.query(DocumentChunk).filter(DocumentChunk.session_id == session_id).limit(8).all()
            chunks = [{
                "chunk_index": c.chunk_index,
                "text_content": c.text_content,
                "page_number": c.page_number,
                "section_heading": c.section_heading,
                "content_type": c.content_type
            } for c in db_chunks]

        # If still no chunks, check session.content or session.summary
        if not chunks:
            content_text = session.summary or session.content or ""
            if len(content_text.strip()) > 30:
                chunks = [{
                    "chunk_index": 0,
                    "text_content": content_text[:3000],
                    "page_number": 1,
                    "section_heading": "Overview",
                    "content_type": "text"
                }]

        if not chunks:
            raise HTTPException(
                status_code=400,
                detail="This study session has no readable content to generate visuals from."
            )

        # 4. Build prompt and invoke LLM
        effective_topic = request.topic or session.ai_title or session.filename or "Key Concepts"
        prompt = build_visual_generation_prompt(
            chunks=chunks,
            requested_topic=effective_topic,
            requested_type=request.visual_type,
            selected_text=request.snippet
        )

        raw_llm_response = llm_generate_fn(prompt, SYSTEM_VISUAL_ARCHITECT_PROMPT)
        parsed_data = extract_json_object(raw_llm_response)

        # Check for NOT_FOUND from LLM
        if parsed_data and parsed_data.get("status") == "NOT_FOUND":
            logger.warning("LLM returned NOT_FOUND; falling back to grounded deterministic concept map.")
            parsed_data = None

        # If LLM failed or returned invalid JSON, generate a deterministic grounded fallback
        if not parsed_data or not isinstance(parsed_data.get("nodes"), list) or len(parsed_data["nodes"]) == 0:
            logger.warning("LLM response unparseable or empty; generating deterministic fallback graph.")
            parsed_data = cls._generate_deterministic_fallback(
                chunks=chunks,
                topic=request.topic or (request.snippet[:40] if request.snippet else session.ai_title or "Key Concepts"),
                visual_type=request.visual_type
            )

        # 5. Validate and Layout
        available_cids = [f"chunk_{c.get('chunk_index', idx)}" for idx, c in enumerate(chunks)]
        visual_doc = VisualValidator.validate_and_layout(
            raw_data=parsed_data,
            source_session_id=session_id,
            available_chunk_ids=available_cids,
            is_manual=False
        )

        # 6. Attach rich citation provenance to nodes
        chunk_map = {f"chunk_{c.get('chunk_index', idx)}": c for idx, c in enumerate(chunks)}
        for node in visual_doc.nodes:
            citations = []
            for cid in node.source_chunk_ids:
                if cid in chunk_map:
                    c = chunk_map[cid]
                    citations.append({
                        "chunk_id": cid,
                        "page_number": c.get("page_number"),
                        "section_heading": c.get("section_heading"),
                        "snippet": (c.get("text_content") or "")[:150]
                    })
            node.citations = citations

        # 7. Learner Mastery & Foundation Alert Overlay
        if request.include_mastery:
            cls.apply_mastery_overlay(user_id=user_id, session_id=session_id, visual_doc=visual_doc, db=db)

        # 8. Record LearningEvent
        try:
            evt = LearningEvent(
                user_id=user_id,
                session_id=session_id,
                event_type="VISUAL_GENERATED",
                payload={
                    "visual_type": visual_doc.visual_type.value,
                    "node_count": len(visual_doc.nodes),
                    "edge_count": len(visual_doc.edges),
                    "topic": request.topic or (request.snippet[:50] if request.snippet else "session")
                }
            )
            db.add(evt)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.warning(f"Failed to record VISUAL_GENERATED event: {e}")

        return visual_doc

    @classmethod
    def apply_mastery_overlay(
        cls,
        user_id: int,
        session_id: int,
        visual_doc: VisualDocument,
        db: Session
    ) -> None:
        """
        Enriches VisualDocument nodes with student topic mastery and flags prerequisite foundation alerts.
        """
        masteries = db.query(LearnerTopicMastery).filter(
            LearnerTopicMastery.user_id == user_id
        ).all()

        mastery_map: Dict[str, LearnerTopicMastery] = {}
        for m in masteries:
            mastery_map[m.topic.strip().lower()] = m

        node_map: Dict[str, VisualNode] = {n.id: n for n in visual_doc.nodes}

        # 1. Overlay node mastery
        for node in visual_doc.nodes:
            label_lower = node.label.strip().lower()
            matched_mastery = None

            # Exact or substring match
            if label_lower in mastery_map:
                matched_mastery = mastery_map[label_lower]
            else:
                for top_name, m_obj in mastery_map.items():
                    if top_name in label_lower or label_lower in top_name:
                        matched_mastery = m_obj
                        break

            if matched_mastery:
                node.mastery_score = matched_mastery.mastery_score
                if matched_mastery.mastery_score >= 0.85:
                    node.mastery_status = "mastered"
                elif matched_mastery.mastery_score >= 0.65:
                    node.mastery_status = "learning"
                elif matched_mastery.mastery_score >= 0.40:
                    node.mastery_status = "review_needed"
                else:
                    node.mastery_status = "struggling"
                node.weak_subtopics = matched_mastery.weak_subtopics or []
            else:
                node.mastery_status = "untested"
                node.mastery_score = None

        # 2. Compute Foundation Alerts on Prerequisite Edges
        # If Edge is prerequisite and source (the foundation) is struggling / low mastery, alert student!
        for edge in visual_doc.edges:
            if edge.is_prerequisite:
                src_node = node_map.get(edge.source)
                tgt_node = node_map.get(edge.target)
                if src_node and src_node.mastery_status == "struggling":
                    edge.has_foundation_alert = True
                elif src_node and src_node.mastery_score is not None and src_node.mastery_score < 0.40:
                    edge.has_foundation_alert = True

    @classmethod
    def _generate_deterministic_fallback(
        cls,
        chunks: List[Dict[str, Any]],
        topic: str,
        visual_type: VisualType
    ) -> Dict[str, Any]:
        """
        Constructs a safe, deterministic semantic concept graph from chunk headings
        when the LLM cascade is unavailable.
        """
        clean_topic = sanitize_visual_text(topic, max_len=80) or "Core Subject"
        nodes = [{
            "id": "node_root",
            "label": clean_topic,
            "type": "concept",
            "description": f"Fundamental conceptual anchor for {clean_topic}.",
            "source_chunk_ids": [f"chunk_0"] if chunks else []
        }]
        edges = []

        seen_labels = {clean_topic.lower()}
        for idx, c in enumerate(chunks[:6]):
            heading = (c.get("section_heading") or f"Subtopic {idx+1}").strip()
            heading = sanitize_visual_text(heading, max_len=60)
            if heading.lower() in seen_labels:
                heading = f"{heading} Part {idx+1}"
            seen_labels.add(heading.lower())

            nid = f"node_{idx+1}"
            text_snippet = (c.get("text_content") or "")[:180].strip()
            nodes.append({
                "id": nid,
                "label": heading,
                "type": "definition" if idx % 2 == 0 else "concept",
                "description": text_snippet or f"Key concept related to {clean_topic}.",
                "source_chunk_ids": [f"chunk_{c.get('chunk_index', idx)}"]
            })
            edges.append({
                "id": f"edge_root_{nid}",
                "source": "node_root",
                "target": nid,
                "relation_type": "contains" if idx % 2 == 0 else "leads_to",
                "label": "includes" if idx % 2 == 0 else "develops",
                "is_prerequisite": False
            })

        actual_type = visual_type.value if visual_type != VisualType.AUTO else "concept_map"
        return {
            "title": f"{clean_topic} Concept Map",
            "description": f"Structured conceptual overview derived from study material.",
            "visual_type": actual_type,
            "nodes": nodes,
            "edges": edges,
            "suggested_topics": [n["label"] for n in nodes[1:4]]
        }

    # ============================================================
    # CRUD for Saved Visual Artifacts
    # ============================================================

    @classmethod
    def save_artifact(
        cls,
        session_id: int,
        user_id: int,
        create_data: VisualArtifactCreate,
        db: Session
    ) -> VisualArtifact:
        """Saves a validated visual artifact (AI generated or user-created)."""
        session = db.query(StudySession).filter(
            StudySession.id == session_id,
            StudySession.user_id == user_id
        ).first()
        if not session:
            raise HTTPException(status_code=404, detail="Study session not found or unauthorized")

        # Validate incoming visual data
        validated = VisualValidator.validate_and_layout(
            raw_data=create_data.visual_data,
            source_session_id=session_id,
            is_manual=create_data.is_manual
        )

        artifact = VisualArtifact(
            id=validated.visual_id,
            user_id=user_id,
            session_id=session_id,
            title=sanitize_visual_text(create_data.title, max_len=200) or validated.title,
            visual_type=create_data.visual_type or validated.visual_type.value,
            visual_data=validated.model_dump(),
            is_manual=create_data.is_manual,
            is_modified=False,
            version=1
        )
        db.add(artifact)
        db.commit()
        db.refresh(artifact)

        # Log event
        try:
            evt = LearningEvent(
                user_id=user_id,
                session_id=session_id,
                event_type="VISUAL_SAVED",
                payload={"visual_id": artifact.id, "title": artifact.title, "is_manual": artifact.is_manual}
            )
            db.add(evt)
            db.commit()
        except Exception:
            pass

        return artifact

    @classmethod
    def list_artifacts(
        cls,
        session_id: int,
        user_id: int,
        db: Session
    ) -> List[VisualArtifact]:
        """Lists all saved visual artifacts for a study session."""
        session = db.query(StudySession).filter(
            StudySession.id == session_id,
            StudySession.user_id == user_id
        ).first()
        if not session:
            raise HTTPException(status_code=404, detail="Study session not found or unauthorized")

        return db.query(VisualArtifact).filter(
            VisualArtifact.session_id == session_id,
            VisualArtifact.user_id == user_id
        ).order_by(VisualArtifact.updated_at.desc()).all()

    @classmethod
    def get_artifact(
        cls,
        session_id: int,
        visual_id: str,
        user_id: int,
        db: Session
    ) -> VisualArtifact:
        """Retrieves a single visual artifact with multi-tenant authorization."""
        artifact = db.query(VisualArtifact).filter(
            VisualArtifact.id == visual_id,
            VisualArtifact.session_id == session_id,
            VisualArtifact.user_id == user_id
        ).first()
        if not artifact:
            raise HTTPException(status_code=404, detail="Visual artifact not found or unauthorized")
        return artifact

    @classmethod
    def update_artifact(
        cls,
        session_id: int,
        visual_id: str,
        user_id: int,
        update_data: VisualArtifactUpdate,
        db: Session
    ) -> VisualArtifact:
        """Updates an existing visual artifact (manual edits, title change)."""
        artifact = cls.get_artifact(session_id, visual_id, user_id, db)

        if update_data.title:
            artifact.title = sanitize_visual_text(update_data.title, max_len=200)

        if update_data.visual_data:
            validated = VisualValidator.validate_and_layout(
                raw_data=update_data.visual_data,
                source_session_id=session_id,
                is_manual=True,
                visual_id=artifact.id
            )
            artifact.visual_data = validated.model_dump()
            artifact.is_modified = True
            artifact.version = (artifact.version or 1) + 1

        if update_data.is_manual is not None:
            artifact.is_manual = update_data.is_manual

        artifact.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(artifact)
        return artifact

    @classmethod
    def delete_artifact(
        cls,
        session_id: int,
        visual_id: str,
        user_id: int,
        db: Session
    ) -> bool:
        """Deletes a visual artifact with multi-tenant verification."""
        artifact = cls.get_artifact(session_id, visual_id, user_id, db)
        db.delete(artifact)
        db.commit()
        return True
