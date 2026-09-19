"""
Florix AI — Hybrid Retrieval Engine
Combines ChromaDB dense vector search with exact lexical keyword matching via
Reciprocal Rank Fusion (RRF). Enforces strict multi-tenant user isolation.
Author: Ganesh (Lead Architect)
"""

import re
import math
import logging
from typing import List, Dict, Any, Optional, Set
from sqlalchemy.orm import Session
from sqlalchemy import or_

from .models import RetrievalCandidate, ContentType, QueryIntent

logger = logging.getLogger("florix.rag.retriever")


def classify_query_intent(query: str) -> QueryIntent:
    """Classifies student query to guide retrieval weighting."""
    q_lower = query.lower().strip()

    if any(term in q_lower for term in ["difference", "vs", "versus", "compare", "contrast"]):
        return QueryIntent.COMPARISON
    if any(term in q_lower for term in ["page ", "section ", "chapter ", "paragraph ", "according to"]):
        return QueryIntent.TARGETED
    if any(term in q_lower for term in ["code", "function", "syntax", "implement", "program", "class", "method"]):
        return QueryIntent.CODE
    if any(term in q_lower for term in ["quiz", "question", "test me", "flashcard", "exam"]):
        return QueryIntent.ASSESSMENT
    if any(term in q_lower for term in ["what is", "define", "explain", "how does", "why is"]):
        return QueryIntent.CONCEPTUAL

    return QueryIntent.GENERAL


def extract_key_tokens(query: str) -> List[str]:
    """Extracts distinctive academic terms (keywords, acronyms, code identifiers)."""
    # Remove common English stop words
    stop_words = {
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "with",
        "about", "is", "are", "was", "were", "what", "how", "why", "who", "which",
        "where", "when", "can", "could", "should", "would", "do", "does", "did",
        "this", "that", "these", "those", "from", "by", "of", "it", "my", "your",
        "tell", "me", "give", "explain", "describe", "show"
    }
    tokens = re.findall(r"\b[A-Za-z0-9_\-\.\$\(\)]+\b", query)
    meaningful = [t for t in tokens if t.lower() not in stop_words and len(t) > 1]
    return meaningful


def compute_lexical_score(query_tokens: List[str], chunk_text: str) -> float:
    """Computes a normalized BM25-inspired lexical overlap score."""
    if not query_tokens or not chunk_text:
        return 0.0

    text_lower = chunk_text.lower()
    score = 0.0
    text_len = max(1, len(chunk_text.split()))

    for token in query_tokens:
        tok_lower = token.lower()
        count = text_lower.count(tok_lower)
        if count > 0:
            # Exact case match bonus (for acronyms like 3NF, ACID, TCP)
            case_multiplier = 1.5 if token in chunk_text and (token.isupper() or len(token) <= 4) else 1.0
            # Term frequency saturation
            tf = (count * 2.2) / (count + 1.2 * (0.25 + 0.75 * (text_len / 150.0)))
            score += tf * case_multiplier

    return min(1.0, score / max(1.0, len(query_tokens) * 1.5))


def reciprocal_rank_fusion(
    dense_candidates: List[RetrievalCandidate],
    lexical_candidates: List[RetrievalCandidate],
    k: int = 60,
    dense_weight: float = 0.65,
    lexical_weight: float = 0.35
) -> List[RetrievalCandidate]:
    """
    Combines dense semantic and lexical candidate lists using weighted RRF.
    """
    scores: Dict[str, float] = {}
    candidate_map: Dict[str, RetrievalCandidate] = {}

    for rank, cand in enumerate(dense_candidates):
        cid = cand.chunk_id
        candidate_map[cid] = cand
        rrf_contrib = dense_weight * (1.0 / (k + rank + 1))
        scores[cid] = scores.get(cid, 0.0) + rrf_contrib

    for rank, cand in enumerate(lexical_candidates):
        cid = cand.chunk_id
        if cid not in candidate_map:
            candidate_map[cid] = cand
        rrf_contrib = lexical_weight * (1.0 / (k + rank + 1))
        scores[cid] = scores.get(cid, 0.0) + rrf_contrib

    # Assign fused scores and sort
    sorted_candidates: List[RetrievalCandidate] = []
    for cid, fused_score in sorted(scores.items(), key=lambda x: x[1], reverse=True):
        cand = candidate_map[cid]
        cand.final_score = fused_score
        sorted_candidates.append(cand)

    return sorted_candidates


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Calculates cosine similarity between two float vectors."""
    dot = sum(a * b for a, b in zip(v1, v2))
    mag1 = math.sqrt(sum(a * a for a in v1))
    mag2 = math.sqrt(sum(b * b for b in v2))
    if not mag1 or not mag2:
        return 0.0
    return dot / (mag1 * mag2)


class HybridRetriever:
    """Production hybrid retrieval manager with strict user tenant isolation."""

    def __init__(self, chroma_collection=None, gemini_client=None):
        self.collection = chroma_collection
        self.gemini_client = gemini_client

    def retrieve(
        self,
        query: str,
        user_id: int,
        session_id: int,
        db: Session,
        top_k: int = 5,
        session_model=None,
        chunk_model=None
    ) -> List[RetrievalCandidate]:
        """
        Executes hybrid retrieval:
        1. Embeds query via Gemini Embedding.
        2. Queries ChromaDB for top dense candidates with session_id scoping.
        3. Scans SQLite chunks for exact keyword matches.
        4. Fuses via RRF and returns Top-K candidates.
        """
        intent = classify_query_intent(query)
        query_tokens = extract_key_tokens(query)
        dense_candidates: List[RetrievalCandidate] = []
        lexical_candidates: List[RetrievalCandidate] = []

        # 1. Dense Semantic Retrieval via ChromaDB
        if self.collection is not None and self.gemini_client is not None:
            try:
                emb_res = self.gemini_client.models.embed_content(
                    model="models/gemini-embedding-2",
                    contents=query
                )
                query_embedding = emb_res.embeddings[0].values

                # Query ChromaDB with session_id filter
                results = self.collection.query(
                    query_embeddings=[query_embedding],
                    n_results=min(top_k * 3, 25),
                    where={"session_id": session_id},
                    include=["documents", "metadatas", "distances"]
                )

                if results and results.get("documents") and results["documents"][0]:
                    docs = results["documents"][0]
                    metas = results["metadatas"][0]
                    dists = results["distances"][0] if "distances" in results else [0.5] * len(docs)

                    for idx, (doc, meta, dist) in enumerate(zip(docs, metas, dists)):
                        # Security Check: If user_id exists in metadata, verify it!
                        if "user_id" in meta and meta["user_id"] != user_id:
                            logger.warning(f"🔒 Security Alert: Blocked cross-user chunk access (Owner: {meta.get('user_id')}, Request: {user_id})")
                            continue

                        sim_score = max(0.0, 1.0 - dist)
                        cid = f"sess_{session_id}_chunk_{meta.get('chunk_index', idx)}"
                        is_web_cand = meta.get("source_type") in ("url", "web")
                        dense_candidates.append(RetrievalCandidate(
                            chunk_id=cid,
                            session_id=session_id,
                            user_id=user_id,
                            text=doc,
                            page_number=None if is_web_cand else meta.get("page_number", meta.get("page", 1)),
                            section_heading=meta.get("section_heading", meta.get("heading", "")),
                            content_type=ContentType(meta.get("content_type", "text")),
                            dense_score=sim_score,
                            final_score=sim_score,
                            source_type=meta.get("source_type", "pdf"),
                            metadata=meta
                        ))
            except Exception as e:
                logger.error(f"⚠️ Dense retrieval failed, will rely on lexical/SQLite: {e}")

        # 2. Lexical Keyword Matching (from SQLite chunks)
        if chunk_model is not None:
            try:
                db_chunks = db.query(chunk_model).filter(chunk_model.session_id == session_id).all()
                for c in db_chunks:
                    score = compute_lexical_score(query_tokens, c.text_content)
                    if score > 0.05:
                        cid = f"sess_{session_id}_chunk_{c.chunk_index}"
                        c_meta = getattr(c, "chunk_metadata", None) or {}
                        c_source = c_meta.get("source_type", "url" if "url" in c_meta else "pdf")
                        is_web_cand = c_source in ("url", "web")
                        lexical_candidates.append(RetrievalCandidate(
                            chunk_id=cid,
                            session_id=session_id,
                            user_id=user_id,
                            text=c.text_content,
                            page_number=None if is_web_cand else (getattr(c, "page_number", 1) or 1),
                            section_heading=getattr(c, "section_heading", "") or "",
                            content_type=ContentType(getattr(c, "content_type", "text") or "text"),
                            lexical_score=score,
                            final_score=score,
                            source_type=c_source,
                            metadata=c_meta
                        ))
                lexical_candidates.sort(key=lambda x: x.lexical_score, reverse=True)
            except Exception as e:
                logger.error(f"⚠️ Lexical matching failed: {e}")

        # 3. Fuse Candidates
        if dense_candidates and lexical_candidates:
            # Adjust weights based on query intent
            if intent in (QueryIntent.CODE, QueryIntent.TARGETED):
                dense_w, lex_w = 0.45, 0.55
            else:
                dense_w, lex_w = 0.70, 0.30
            fused = reciprocal_rank_fusion(dense_candidates, lexical_candidates, k=60, dense_weight=dense_w, lexical_weight=lex_w)
            return fused[:top_k]
        elif dense_candidates:
            dense_candidates.sort(key=lambda x: x.dense_score, reverse=True)
            return dense_candidates[:top_k]
        elif lexical_candidates:
            return lexical_candidates[:top_k]

        return []
