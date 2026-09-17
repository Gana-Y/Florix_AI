# FLORIX AI V2 — PHASE 3 IMPLEMENTATION PLAN
## Intelligent Learning Engine & Adaptive Study System

**Author**: Ganesh (Engineering Lead)  
**Date**: September 2026  
**Status**: APPROVED FOR EXECUTION  
**Architecture Layer**: Phase 3 (Intelligence Layer atop Phase 2 Knowledge Engine)

---

### 1. Current Architecture Baseline

Florix AI is currently operating with two verified layers:
- **Phase 1 (Stable Application Foundation)**: Multi-tenant FastAPI application, SQLite/PostgreSQL-compatible SQLAlchemy ORM (13 tables), JWT authentication with role-based access control, plan limits (Free, Pro, Premium), document library, and React/Vite/Tailwind frontend.
- **Phase 2 (Academic Knowledge Engine)**: Structural document parser (`Backend/rag/parser.py`), hierarchical semantic chunker (`Backend/rag/chunker.py`), ChromaDB dense vector store + lexical index (`Backend/rag/retriever.py`), Reciprocal Rank Fusion (RRF) hybrid retrieval with cross-encoder re-ranking (`Backend/rag/reranker.py`), deduplicated token-budgeted context assembler (`Backend/rag/context_builder.py`), and grounded generation with bracketed citations (`Backend/rag/generator.py`).

Existing chat and AI assessment endpoints in `Backend/main.py`:
- `/chat` & `/chat/stream`: Consume `retrieve_relevant_chunks`, `ContextBuilder`, and `GroundedGenerator`.
- `/generate_quiz`: Monolithic fallback over raw text (`session.content[:15000]`), lacking chunk attribution, section tracking, or multi-modal question types.
- `/generate_flashcards`: Raw prompt slicing with no topic tagging, difficulty tiers, or source grounding.
- `FlashcardProgress`: Existing SM-2 spaced repetition database entity tracking `card_index`, `ease_factor`, `interval`, `repetitions`, and `next_review`.

---

### 2. Phase 2 Integration Points

Phase 3 strictly consumes and enhances the verified Phase 2 subsystem without replacing it:
1. **Retrieval**: Calls `retrieve_relevant_chunks(session_id, query, db, top_k, user_id)` in `Backend/main.py` which wraps `HybridRetriever`.
2. **Context & Evidence**: Consumes `ContextBuilder.build_context(source_candidates)` returning deduplicated Markdown context and structured `Citation` objects with source page, chunk index, and section heading.
3. **Generation**: Interacts with `GroundedGenerator` and Gemini 2.5 Flash (`gemini-2.5-flash`), extending prompts with pedagogical scaffolding rather than overriding Phase 2 grounding constraints.
4. **Zero Duplication**: No secondary ChromaDB collection, no secondary embedding model, and no secondary chunker will be introduced.

---

### 3. Phase 3 Architecture & Modules (`Backend/intelligence/`)

The intelligence layer is organized into a clean, modular Python package under `Backend/intelligence/`:

```
Backend/intelligence/
├── __init__.py          # Public API exports
├── models.py            # Strongly typed Pydantic & dataclass schemas
├── intent.py            # Deterministic & pattern-based intent & learning mode classifier
├── teaching.py          # Pedagogical scaffolding (Beginner, Intermediate, Advanced, Exam, Revision)
├── assessment.py        # Grounded quiz & flashcard generation tied to source chunks
├── learner.py           # Transparent mastery tracking, weak topic detection, & spaced review
├── validators.py        # Citation integrity, bracket validation, & grounding filters
└── orchestrator.py      # Unified intelligence pipeline orchestrating Intent → RAG → Teaching → Validation
```

#### Detailed Module Specifications:
- **`models.py`**:
  - `LearningIntent`: Enum (`EXPLAIN`, `DEFINE`, `SUMMARIZE`, `COMPARE`, `EXAMPLE`, `PROCEDURE`, `SOLVE`, `QUIZ`, `FLASHCARD`, `REVISION`, `EXAM_PREPARATION`, `DEEP_DIVE`, `CLARIFICATION`, `OUT_OF_SCOPE`).
  - `TeachingMode`: Enum (`BEGINNER`, `INTERMEDIATE`, `ADVANCED`, `EXAM`, `INTERVIEW`, `REVISION`).
  - `QuestionType`: Enum (`MCQ`, `TRUE_FALSE`, `SHORT_ANSWER`, `CONCEPTUAL`, `CODE`, `NUMERICAL`).
  - `GroundedQuizQuestion`: Typed question with `question`, `options`, `answer` (0-indexed int), `explanation`, `question_type`, `difficulty`, `source_chunk_id`, `page_number`, `section_heading`.
  - `GroundedFlashcard`: Typed flashcard with `front`, `back`, `topic`, `difficulty`, `source_chunk_id`, `page_number`.
  - `TopicMasteryRecord`: Transparent mastery record with score (0.0 to 1.0), attempts, correct answers, weak subtopics, and recency.
- **`intent.py`**:
  - Deterministic keyword and regex classifier prioritizing zero latency and cost control.
  - Classifies user queries into intents and maps user goals (e.g. "exam tomorrow", "like a 5 year old", "under the hood") into appropriate `TeachingMode`s.
- **`teaching.py`**:
  - Generates structured prompt injections for the LLM based on mode and intent.
  - Implements Bloom's taxonomy structures:
    - `BEGINNER`: Concept $\to$ Simple Explanation $\to$ Analogy $\to$ Example $\to$ Common Mistake $\to$ Quick Check.
    - `EXAM`: Formal Definition $\to$ Key Examination Points $\to$ Marking Criteria $\to$ Essential Terminology.
    - `ADVANCED`: Formal Specification $\to$ Internal Mechanism $\to$ Trade-offs & Edge Cases $\to$ Concrete Implementation.
  - Concept extraction routines from retrieved Phase 2 chunks (identifying definition, prerequisites, related terms).
- **`assessment.py`**:
  - Transforms retrieved chunks into grounded assessments.
  - Assembles prompt requesting strict JSON adhering to `GroundedQuizQuestion` and `GroundedFlashcard`.
  - Attaches source citations and page numbers directly to each question and flashcard.
- **`learner.py`**:
  - Deterministic explainable mastery formula:
    $$\text{Mastery} = 0.50 \times \text{Accuracy} + 0.25 \times \text{Recency} + 0.15 \times \text{Repetition} + 0.10 \times \text{Difficulty}$$
  - Identifies weak subtopics where accuracy is below 65%.
  - Generates actionable revision recommendations (e.g., "Review 3NF before attempting BCNF").
  - Spaced revision scheduling based on modified SM-2 / Leitner intervals.
- **`validators.py`**:
  - Verifies all bracketed citation numbers (e.g. `[1]`, `[2]`) in AI responses map to valid retrieved chunks.
  - Automatically strips hallucinated or out-of-bounds citation indices.
  - Enforces out-of-scope / no-evidence handling when query cannot be grounded in uploaded documents.
- **`orchestrator.py`**:
  - Coordinates end-to-end request flow:
    `Query` $\to$ `Intent/Mode Classification` $\to$ `Phase 2 Hybrid Retrieval` $\to$ `Teaching Context Assembly` $\to$ `Grounded LLM Call` $\to$ `Citation/Grounding Validation` $\to$ `Learning Event Logging`.

---

### 4. Database Schema Evolution

Additive, non-destructive migration in `Backend/database.py` and `Backend/patch_db_phase3.py`:

```python
class LearnerTopicMastery(Base):
    __tablename__ = "learner_topic_mastery"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("study_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    topic = Column(String, nullable=False, index=True)
    mastery_score = Column(Float, default=0.0) # 0.0 to 1.0
    attempts = Column(Integer, default=0)
    correct = Column(Integer, default=0)
    weak_subtopics = Column(JSON, default=lambda: [])
    last_reviewed = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class LearningEvent(Base):
    __tablename__ = "learning_events"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("study_sessions.id", ondelete="CASCADE"), nullable=True, index=True)
    event_type = Column(String, nullable=False) # 'EXPLAIN', 'QUIZ_ATTEMPT', 'FLASHCARD_REVIEW'
    payload = Column(JSON, default=lambda: {})
    timestamp = Column(DateTime, default=datetime.utcnow)
```

- **Idempotency**: Created via `Base.metadata.create_all(bind=engine)` and verified via SQLite schema pragma.
- **Row Preservation**: Zero modifications or deletions to existing 13 tables (`users`, `study_sessions`, `document_chunks`, `quiz_results`, `flashcard_progress`, etc.).

---

### 5. API Design & Backward Compatibility

Existing endpoints in `Backend/main.py` are preserved with enriched capabilities:
1. **`POST /chat` & `POST /chat/stream`**:
   - Enriched with Phase 3 intent and pedagogical mode detection.
   - Grounded validation filters hallucinated brackets before delivering final text.
   - Backward compatible: maintains existing JSON format for non-streaming and SSE format for streaming.
2. **`POST /generate_quiz`**:
   - Grounded in retrieved chunks rather than raw 15k truncation.
   - Maintains exact JSON output format: `[{"question": "...", "options": ["A", "B", ...], "answer": 0, "explanation": "..."}]` plus optional metadata fields (`topic`, `difficulty`, `source_chunk_id`, `page_number`).
3. **`POST /generate_flashcards`**:
   - Grounded in retrieved chunks.
   - Maintains exact JSON output format: `[{"front": "...", "back": "..."}]` plus optional metadata fields (`topic`, `difficulty`, `page_number`).
4. **New Authenticated Endpoints**:
   - `GET /learning/mastery/{session_id}`: Returns list of topic mastery records for the session. Scoped to `current_user.id`.
   - `GET /learning/weak-topics/{session_id}`: Returns weak subtopics and study recommendations. Scoped to `current_user.id`.
   - `POST /learning/evaluate-answer`: Evaluates student free-form answers against grounded document evidence.

---

### 6. Frontend Integration & Non-Destructive Invariants

- **Zero UI Redesign**: No alterations to colors, layout, typography, navbar, or sidebar.
- **Full Backward Compatibility**: Frontend components (`StudySession.jsx`, `ChatPage.jsx`, `Library.jsx`) receive expected fields without breakage.
- **Verification**: `npm run build` must compile cleanly with 0 errors.

---

### 7. Testing Strategy (`Backend/test_intelligence.py`)

A comprehensive, automated pytest test suite covering:
1. **Deterministic Intent Classification**: All 14 intents tested against representative academic inputs.
2. **Teaching Mode Scaffolding**: Beginner, Exam, and Advanced structured prompts verified.
3. **Grounded Quiz Generation**: Output schema validation, option counts, answer indexing, and chunk attribution.
4. **Grounded Flashcard Generation**: Front/Back formatting, topic tagging, and difficulty tiers.
5. **Mastery Calculation Formula**: Mathematical verification of weights ($0.50A + 0.25R + 0.15N + 0.10D$).
6. **Weak Topic Detection**: Threshold trigger ($< 65\%$) and recommendation string generation.
7. **Citation & Grounding Validator**: Detection and pruning of hallucinated citation indices (`[99]`).
8. **No-Evidence / Out-of-Scope Fallback**: Preservation of non-hallucinatory rejection when material is absent.
9. **Multi-Tenant Security & Isolation**: Verification that User A cannot read or write User B's mastery or quiz data.
10. **LLM Error Handling & Malformed JSON Resilience**: Safe degradation on invalid LLM responses.

---

### 8. Risks & Rollback Considerations

- **Risk 1: LLM Non-Determinism in JSON Generation**:
  - *Mitigation*: Robust regex and json-repair fallbacks in `clean_and_parse_json` and Pydantic validation.
- **Risk 2: Database Schema Migration Issues**:
  - *Mitigation*: Purely additive new tables (`learner_topic_mastery`, `learning_events`). No existing tables, foreign keys, or columns modified.
- **Risk 3: Latency Overhead**:
  - *Mitigation*: 100% deterministic local intent and mode classification (0 ms LLM cost). Only one LLM call for generation.
- **Rollback Plan**:
  - If any issue arises, routing in `main.py` can immediately fallback to previous handler logic, and the new tables can be ignored without affecting existing core operations.
