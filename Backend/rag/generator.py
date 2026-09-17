"""
Florix AI — Grounded Answer Generator & Citation Mapper
Orchestrates LLM inference with bounded exponential backoff retries, parses claim citations,
and returns validated GroundedResponse structures.
Author: Ganesh (Lead Architect)
"""

import re
import time
import json
import logging
from typing import List, Dict, Any, Optional, AsyncGenerator
from .models import GroundedResponse, Citation, QueryIntent
from .prompts import build_grounded_rag_prompt

logger = logging.getLogger("florix.rag.generator")


class GroundedGenerator:
    """Generates cited, grounded answers using Google Gemini with resilience fallbacks."""

    def __init__(self, gemini_client, model_name: str = "gemini-1.5-flash"):
        self.client = gemini_client
        self.model_name = model_name

    def generate(
        self,
        query: str,
        context: str,
        citations: List[Citation],
        response_style: str = "balanced",
        history: Optional[List[Dict[str, str]]] = None,
        intent: QueryIntent = QueryIntent.GENERAL,
        max_retries: int = 3
    ) -> GroundedResponse:
        """
        Executes grounded generation with exponential backoff:
        1. Formats prompt with strict citation and grounding rules.
        2. Calls Gemini API.
        3. Parses citations used in text and matches with citation metadata.
        """
        prompt = build_grounded_rag_prompt(
            query=query,
            context=context,
            response_style=response_style,
            history=history
        )

        response_text = ""
        last_error = None

        for attempt in range(max_retries):
            try:
                res = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt
                )
                if res and res.text:
                    response_text = res.text.strip()
                    break
            except Exception as e:
                last_error = e
                wait_time = (2 ** attempt) + 0.5
                logger.warning(f"⚠️ Gemini generate attempt {attempt + 1} failed: {e}. Retrying in {wait_time:.1f}s...")
                time.sleep(wait_time)

        if not response_text:
            if last_error:
                logger.error(f"❌ All Gemini generation attempts failed: {last_error}")
            return GroundedResponse(
                reply="I encountered a temporary issue while connecting to the AI knowledge engine. Please try asking your question again.",
                citations=[],
                confidence_score=0.0,
                query_intent=intent,
                sources_used=0,
                is_grounded=False
            )

        # Extract citation numbers used in response: e.g. [1], [2]
        used_indices = set(int(m) for m in re.findall(r"\[(\d+)\]", response_text))
        active_citations = [c for c in citations if c.source_index in used_indices]

        # If model didn't cite specifically but context was provided, include top citation
        if not active_citations and citations:
            active_citations = citations[:2]

        is_grounded = bool(context.strip()) and not ("not covered" in response_text.lower() and len(active_citations) == 0)

        return GroundedResponse(
            reply=response_text,
            citations=active_citations,
            confidence_score=0.95 if is_grounded else 0.70,
            query_intent=intent,
            sources_used=len(active_citations),
            is_grounded=is_grounded
        )

    async def generate_stream(
        self,
        query: str,
        context: str,
        citations: List[Citation],
        response_style: str = "balanced",
        history: Optional[List[Dict[str, str]]] = None
    ) -> AsyncGenerator[str, None]:
        """
        Server-Sent Events (SSE) streaming generator yielding tokens and citation payloads.
        """
        prompt = build_grounded_rag_prompt(
            query=query,
            context=context,
            response_style=response_style,
            history=history
        )

        safety_settings = [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]

        try:
            for chunk in self.client.models.generate_content_stream(
                model=self.model_name,
                contents=prompt,
                config={"safety_settings": safety_settings}
            ):
                if chunk and chunk.text:
                    yield f"data: {json.dumps({'token': chunk.text})}\n\n"

            # Send citation metadata packet right before [DONE]
            if citations:
                citation_payload = {
                    "citations": [c.to_dict() for c in citations]
                }
                yield f"data: {json.dumps(citation_payload)}\n\n"

            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"❌ Error during RAG streaming: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"
