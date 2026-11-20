# FLORIX AI V2 — PHASE 3 INTELLIGENCE ARCHITECTURE
## Intelligent Learning Engine & Adaptive Study System

**Author**: Ganesh (Engineering Lead)  
**Date**: September 2026  
**Status**: VERIFIED & PRODUCTION HARDENED  
**Target Repository**: Florix AI (`Backend/intelligence/`, `Backend/rag/`, `Backend/main.py`)

---

## 1. Executive Overview

Phase 3 introduces an intelligent, evidence-grounded academic learning layer on top of the verified Phase 2 Academic Knowledge Engine. Florix AI evolves from a document retrieval/Q&A engine into an adaptive study companion that:
1. Understands student query intent (Explain, Define, Compare, Quiz, Flashcard, Revision, Exam Prep, Deep Dive).
2. Dynamically calibrates pedagogical scaffolding (Beginner, Intermediate, Advanced, Exam, Interview, Revision).
3. Synthesizes evidence-grounded quizzes and flashcards linked directly to document source chunks and page numbers.
4. Tracks explainable learner mastery per topic with deterministic multi-signal weighting ($0.50A + 0.25R + 0.15N + 0.10D$).
5. Detects weak topics and generates actionable, evidence-based study recommendations.
6. Enforces strict citation validation, stripping hallucinated bracket indices before responses are delivered.

---

## 2. End-to-End System Architecture & Data Flow

```
Learner Query (Chat / Quiz / Revision)
                  │
                  ▼
   ┌──────────────────────────────┐
   │ Phase 3 Intent Engine        │ ── Deterministic regex & keyword classifier
   │ (detect_learning_intent)     │ ── 0 ms LLM overhead
   └──────────────┬───────────────┘
                  │
                  ├──────────────────────────────┐
                  ▼                              ▼
     ┌──────────────────────────┐   ┌──────────────────────────┐
     │ Teaching Mode & Intent   │   │ Target Topic / Difficulty│
     └────────────┬─────────────┘   └────────────┬─────────────┘
                  │                              │
                  ▼                              ▼
   ┌───────────────────────────────────────────────────────────┐
   │ Phase 2 Knowledge Engine                                  │
   │ HybridRetriever (Dense ChromaDB + BM25 Lexical)           │
   │ RRF (Reciprocal Rank Fusion) + Relevance Reranker         │
   │ ContextBuilder (Token budgeted, deduplicated candidates)  │
   └──────────────────────────────┬────────────────────────────┘
                                  │
                                  ▼
   ┌───────────────────────────────────────────────────────────┐
   │ Pedagogical Context Assembly                              │
   │ TeachingEngine.get_scaffolding_instruction(mode, intent)  │
   │ Injects Bloom's taxonomy: Concept -> Example -> Trap etc. │
   └──────────────────────────────┬────────────────────────────┘
                                  │
                                  ▼
   ┌───────────────────────────────────────────────────────────┐
   │ Grounded Generation (Gemini 2.5 Flash / Fallback)         │
   └──────────────────────────────┬────────────────────────────┘
                                  │
                                  ▼
   ┌───────────────────────────────────────────────────────────┐
   │ GroundingValidator                                        │
   │ Validates citation brackets against retrieved chunks      │
   │ Strips hallucinated/out-of-bounds indices (e.g. [99])     │
   └──────────────────────────────┬────────────────────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
       Final Verified Response         Learning Event Logged
       (reply, citations, intent)      (learner_topic_mastery)
                                                  │
                                                  ▼
                                       Explainable Topic Mastery
                                       & Weak-Topic Recommendations
```

---

## 3. Core Modules & Responsibilities (`Backend/intelligence/`)

### 3.1 `models.py`
- Strongly typed Enums:
  - `LearningIntent`: `EXPLAIN`, `DEFINE`, `SUMMARIZE`, `COMPARE`, `EXAMPLE`, `PROCEDURE`, `SOLVE`, `DEBUG`, `QUIZ`, `FLASHCARD`, `REVISION`, `EXAM_PREPARATION`, `DEEP_DIVE`, `CLARIFICATION`, `OUT_OF_SCOPE`.
  - `TeachingMode`: `BEGINNER`, `INTERMEDIATE`, `ADVANCED`, `EXAM`, `INTERVIEW`, `REVISION`.
  - `QuestionType`: `MCQ`, `TRUE_FALSE`, `SHORT_ANSWER`, `CONCEPTUAL`, `CODE`, `NUMERICAL`.
- Pydantic models:
  - `GroundedQuizQuestion`: Backward-compatible schema containing `question`, `options`, `answer` (int), `explanation`, plus `difficulty`, `topic`, `source_chunk_id`, `page_number`, `section_heading`.
  - `GroundedFlashcard`: `front`, `back`, `topic`, `difficulty`, `page_number`.
  - `TopicMasteryRecord`: `topic`, `mastery_score`, `attempts`, `correct`, `weak_subtopics`, `status`.
  - `IntelligenceResponse`: `reply`, `intent`, `teaching_mode`, `citations`, `is_grounded`, `confidence_level`.

### 3.2 `intent.py`
- Deterministic regex & keyword pattern matcher that classifies inputs into intents and teaching modes with zero LLM latency and zero API cost.
- Prioritizes user intent coupling (e.g. `REVISION` requests trigger `TeachingMode.REVISION`; `EXAM_PREPARATION` queries trigger `TeachingMode.EXAM`).

### 3.3 `teaching.py`
- Implements pedagogical scaffolding structures:
  - `BEGINNER`: Core Concept $	o$ Simple Explanation $	o$ Relatable Analogy $	o$ Concrete Walkthrough $	o$ Common Misconception $	o$ Quick Check.
  - `EXAM`: Formal Definition $	o$ Key Examination Points & Marking Criteria $	o$ Technical Mechanism/Derivation $	o$ Annotated Standard Problem $	o$ Key Terminology $	o$ Exam Trap.
  - `ADVANCED`: Formal Specification & Invariants $	o$ Low-Level Mechanism $	o$ Boundary Conditions $	o$ Trade-offs & Complexity $	o$ Concrete Implementation/Proof.
  - `REVISION`: Core Formulae & Rules $	o$ High-Yield Bullet Points $	o$ Trap Warnings $	o$ Active Recall Prompt.
- `extract_concepts_from_chunks`: Deterministic extraction of terms, definitions, and section headings from Phase 2 chunk text.

### 3.4 `assessment.py`
- `generate_quiz`: Constructs structured prompts for Gemini requiring strict JSON outputs grounded solely in provided chunks. Verifies option indexing, difficulty tags, and attaches chunk IDs and page numbers.
- `generate_flashcards`: Produces high-yield study cards grounded in retrieved evidence.
- Full backward compatibility: Output directly conforms to existing frontend component expectations (`StudySession.jsx`).

### 3.5 `learner.py`
- Explainable, deterministic mastery formula:
  $$\text{Mastery} = 0.50 \times \text{Accuracy} + 0.25 \times \text{Recency} + 0.15 \times \text{Repetition} + 0.10 \times \text{Difficulty}$$
  Where:
  - $\text{Accuracy} = \frac{\text{correct}}{\max(1, \text{attempts})}$
  - $\text{Recency} = e^{-0.10 \times \Delta t}$ (exponential decay over days)
  - $\text{Repetition} = \min(1.0, \frac{\text{attempts}}{10.0})$
  - $\text{Difficulty} = 0.60\text{ (beginner)}, 0.80\text{ (intermediate)}, 1.00\text{ (advanced/exam)}$
- Categorizes mastery status: `mastered` ($\ge 0.85$), `learning` ($\ge 0.65$), `review_needed` ($\ge 0.40$), `struggling` ($< 0.40$).
- Tracks weak subtopics and generates targeted revision prompts ("Strengthen understanding in 'Normalization' (focusing on 3NF Transitive Dependency). Practice 5 focused questions.").

### 3.6 `validators.py`
- `validate_and_clean_citations`: Parses bracketed numbers `[1]`, `[2]`, etc. Checks that indices exist within the retrieved citation pool. Automatically strips out-of-bounds indices (e.g. `[99]`) to eliminate citation hallucination.
- `check_evidence_sufficiency`: Detects when retrieved chunks lack relevant text and triggers a graceful non-hallucinatory rejection.

### 3.7 `orchestrator.py`
- Coordinates end-to-end processing: query classification, evidence validation, pedagogical assembly, grounded generation, and citation post-processing.

---

## 4. Database Schema Additions

Additive and non-destructive tables in `Backend/database.py` applied via `Backend/patch_db_phase3.py`:

```sql
CREATE TABLE learner_topic_mastery (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    session_id INTEGER NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    topic VARCHAR NOT NULL,
    mastery_score FLOAT DEFAULT 0.0,
    attempts INTEGER DEFAULT 0,
    correct INTEGER DEFAULT 0,
    weak_subtopics JSON DEFAULT '[]',
    last_reviewed DATETIME,
    created_at DATETIME,
    updated_at DATETIME
);

CREATE TABLE learning_events (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    session_id INTEGER REFERENCES study_sessions(id) ON DELETE CASCADE,
    event_type VARCHAR NOT NULL,
    payload JSON DEFAULT '{}',
    timestamp DATETIME
);
```

---

## 5. Security & Multi-Tenant Isolation

1. **Session Ownership Enforcement**: Every learner endpoint (`/learning/mastery/{session_id}`, `/learning/weak-topics/{session_id}`, `/learning/evaluate-answer`) verifies that `StudySession.user_id == current_user.id`.
2. **Access Control**: Cross-tenant attempts return an HTTP 404 (or 403), ensuring zero information disclosure across users.
3. **Audit Trail**: Every learning interaction logs an immutable record in `learning_events`.
