"""
Phase 3 Intelligence Orchestrator
Unified entry point binding Intent Detection -> Phase 2 RAG Retrieval ->
Adaptive Teaching Scaffolding -> Grounded Generation -> Citation Validation.
"""

import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from .models import LearningIntent, TeachingMode, IntelligenceResponse
from .intent import detect_learning_intent
from .teaching import TeachingEngine
from .validators import GroundingValidator

logger = logging.getLogger(__name__)


class IntelligenceOrchestrator:
    """
    Coordinates end-to-end intelligent study assistance.
    """

    def __init__(self, gemini_client: Any = None, model_name: str = "gemini-2.5-flash"):
        self.gemini_client = gemini_client
        self.model_name = model_name

    def process_query(
        self,
        query: str,
        retrieved_chunks: List[Any],
        doc_context: str,
        citations: List[Any],
        response_style: Optional[str] = None,
        generator_fn: Optional[Any] = None
    ) -> IntelligenceResponse:
        """
        Processes learner query through Phase 3 intelligence pipeline.
        """
        # 1. Intent & Mode Detection
        intent, mode = detect_learning_intent(query)
        logger.info(f"Phase 3 Intent: {intent.value} | Mode: {mode.value}")

        # 2. Check Evidence Sufficiency
        is_sufficient, fallback_msg = GroundingValidator.check_evidence_sufficiency(
            query, retrieved_chunks
        )
        if not is_sufficient:
            logger.warning("Insufficient evidence in retrieved chunks. Triggering no-evidence response.")
            return IntelligenceResponse(
                reply=fallback_msg or "The uploaded study material does not contain sufficient information.",
                intent=intent,
                teaching_mode=mode,
                citations=[],
                is_grounded=False,
                sources_used=0,
                confidence_level="NO_EVIDENCE",
                warnings=["Insufficient evidence in uploaded material."]
            )

        # 3. Assemble Pedagogical Instruction Scaffolding
        scaffold = TeachingEngine.get_scaffolding_instruction(mode, intent)
        enhanced_context = f"{scaffold}\n\n--- GROUNDED DOCUMENT CONTEXT ---\n{doc_context}"

        # 4. Generate Grounded Reply
        raw_reply = ""
        used_citations = citations
        if generator_fn:
            grounded_res = generator_fn(
                query=query,
                context=enhanced_context,
                citations=citations,
                response_style=response_style or "balanced"
            )
            raw_reply = getattr(grounded_res, "reply", str(grounded_res))
            if hasattr(grounded_res, "citations"):
                used_citations = grounded_res.citations
        else:
            raw_reply = "Response generated."

        # 5. Validate & Clean Citations
        cleaned_reply, valid_indices, warnings = GroundingValidator.validate_and_clean_citations(
            reply=raw_reply,
            available_citations=used_citations
        )

        citation_dicts = []
        for c in used_citations:
            if hasattr(c, "to_dict"):
                citation_dicts.append(c.to_dict())
            elif isinstance(c, dict):
                citation_dicts.append(c)

        # Filter citations list to those actually referenced, or return available
        referenced_citations = [
            citation_dicts[i - 1] for i in valid_indices if 0 <= (i - 1) < len(citation_dicts)
        ] if valid_indices else citation_dicts

        return IntelligenceResponse(
            reply=cleaned_reply,
            intent=intent,
            teaching_mode=mode,
            citations=referenced_citations,
            is_grounded=len(referenced_citations) > 0,
            sources_used=len(referenced_citations),
            confidence_level="HIGH" if len(valid_indices) > 0 else "MEDIUM",
            warnings=warnings
        )
