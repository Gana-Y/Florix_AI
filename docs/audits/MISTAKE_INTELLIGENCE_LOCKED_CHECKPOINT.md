# FLORIX AI — MISTAKE INTELLIGENCE / METACOGNITIVE DEBUGGER LOCKED CHECKPOINT

**Phase / Capability**: Mistake Intelligence & Metacognitive Debugger  
**Status**: 🔒 **LOCKED & VERIFIED**  
**Author**: Ganesh (Lead Architect) & Aria  
**Date**: October 2026  
**Commitment**: Production Foundation Checkpoint  

---

## 1. CAPABILITY PURPOSE & CHARTER

Florix AI is an academic mastery and research-grounded platform. Its architectural chain transforms:
$$\text{Input} \longrightarrow \text{Understanding} \longrightarrow \text{Questioning} \longrightarrow \text{Visualization} \longrightarrow \text{Practice} \longrightarrow \text{Feedback} \longrightarrow \text{Mastery} \longrightarrow \text{Next Steps}$$

The **Mistake Intelligence / Metacognitive Debugger** answers the foundational question:
> **"Why was my answer wrong?"**

Rather than treating learner errors as simple binary penalties (0 points vs 1 point), the Metacognitive Debugger deconstructs the exact cognitive failure mechanism behind each error. It identifies misconceptions, maps root causes to an authoritative 10-tier academic taxonomy, traces recurring error patterns across time, surfaces prerequisite concept blockers, and generates source-grounded targeted remediation without altering foundational learning loops.

---

## 2. SYSTEM LOCKED STATE HIERARCHY

| Milestone / Subsystem | Status | Scope & Boundary |
|---|---|---|
| **Phase 1** (Core Foundation & Ingestion) | 🔒 **LOCKED** | Multi-format ingestion, chunking, metadata preservation |
| **Phase 2** (Multimodal RAG & Citations) | 🔒 **LOCKED** | Hybrid retrieval, citation provenance, zero hallucinated pages |
| **Phase 3** (Diagnostic Quizzes & Intelligence) | 🔒 **LOCKED** | Assessment engine, learner topic mastery, learning events |
| **Phase 4** (SM-2 Spaced Repetition Loop) | 🔒 **LOCKED** | Spaced repetition scheduler, flashcard intervals (read-only) |
| **Phase 5** (Visual Learning & Concept Mapping) | 🔒 **LOCKED** | Visual artifacts, concept map DAGs, visual mastery overlays |
| **Revision Notification Infrastructure** | 🔒 **LOCKED** | Quiet hours, notification center, reminder scheduling |
| **Adaptive Study Planner** | 🔒 **LOCKED** | Horizon scheduling, daily plans, weak-area task prioritization |
| **Exam / Mock Exam Engine** | 🔒 **LOCKED** | Exam blueprints, active attempts, server timer, anti-leakage |
| **Mistake Intelligence / Debugger** | 🔒 **LOCKED** | Metacognitive diagnosis, 10-tier taxonomy, longitudinal patterns, prerequisite gaps, targeted practice |
| *Viva / Oral Examination Mode* | ⏳ *NOT STARTED* | Awaiting explicit project owner authorization |
| *Collaborative Study Rooms* | ⏳ *NOT STARTED* | Awaiting explicit project owner authorization |
| *Learning Analytics Expansion* | ⏳ *NOT STARTED* | Future phase |

---

## 3. ARCHITECTURAL SUMMARY & SPECIFICATION

### Backend Subsystem (`Backend/mistake/`, `Backend/database.py`, `Backend/main.py`)
1. **Authoritative 10-Tier Error Taxonomy (`Backend/mistake/taxonomy.py`)**:
   - `CONCEPTUAL_MISUNDERSTANDING`: Fundamental error in principle or scientific theory.
   - `PARTIAL_UNDERSTANDING`: Core concept grasp present but incomplete or imprecise.
   - `PROCEDURAL_ERROR`: Algorithmic step omitted, inverted, or executed out of sequence.
   - `CALCULATION_ERROR`: Arithmetic, algebraic, or dimensional calculation mistake.
   - `CARELESS_ERROR`: Transcription slip, sign flip, or minor mechanical error.
   - `MISREAD_QUESTION`: Misinterpreted constraints, missed negatives (e.g., "NOT"), or wrong variable.
   - `MEMORY_RECALL_FAILURE`: Inability to recall exact formula, constant, or factual property.
   - `PREREQUISITE_GAP`: Blocker caused by a fundamental prior dependency.
   - `CONFUSION_BETWEEN_CONCEPTS`: Conflation of two distinct terms, models, or formulas.
   - `INCORRECT_APPLICATION`: Correct theoretical knowledge applied under invalid conditions.
   - Strict fallback to `UNKNOWN` with robust fuzzy string matching (`normalize_category`).

2. **Longitudinal Pattern Engine (`analyzer.py`)**:
   - Calculates error frequency and progression across historical `LearningEvent` records for `(user_id, topic)`:
     - `ISOLATED`: 1 mistake in the past 14 days.
     - `RECURRING`: 2–3 mistakes in the past 14 days.
     - `PERSISTENT`: $\ge 4$ mistakes in the past 14 days (escalated to high priority).
     - `IMPROVING`: Error occurred previously but recent topic quiz/exam performance $\ge 70\%$.
     - `RESOLVED`: Explicitly passed targeted practice or marked resolved by user.

3. **Prerequisite Gap Detection (`analyzer.py`)**:
   - Inspects Phase 5 `VisualArtifact` knowledge graphs associated with the current study session.
   - Queries dependency edges (`prerequisite_of`, `depends_on`) where target node is the tested topic.
   - Verifies whether upstream prerequisite nodes have low topic mastery ($< 60\%$) in `LearnerTopicMastery`.
   - Generates prerequisite alerts recommending foundational review before re-attempting advanced questions.

4. **Database Persistence & Schemas (`Backend/database.py`)**:
   - Additive table: `MistakeRecord`:
     - Keys: `id`, `user_id` (FK to `users.id`), `session_id` (FK to `study_sessions.id`).
     - Core Attributes: `question_text`, `user_answer`, `correct_answer`, `topic`, `source_type`.
     - Diagnostic Fields: `error_category` (Taxonomy enum), `misconception_analysis`, `correct_reasoning`, `key_takeaway`.
     - Provenance: `source_chunk_id`, `page_number`, `citation_excerpt`, `confidence_score`.
     - Longitudinal & Remediation: `pattern_state`, `prerequisite_gap_topic`, `is_resolved`, `resolved_at`, `options`.
     - Compound Indexes: `(user_id, topic)`, `(user_id, error_category)`, `(user_id, pattern_state)`.

5. **Strict Multi-Tenant Security & IDOR Defense (`service.py`, `main.py`)**:
   - All 9 REST endpoints verify ownership: `MistakeRecord.user_id == current_user.id`.
   - Session access checked: `StudySession.user_id == current_user.id`.
   - Cross-tenant access triggers immediate HTTP 404/403 errors with zero information leakage.

6. **Subscription Entitlements (`PLAN_LIMITS` in `main.py`)**:
   - Additive plan limits configured and enforced via `check_plan_limit`:
     - `mistake_analyses_per_day`: Free = 10, Pro = 100, Premium/Admin = Unlimited (-1).
     - `ai_practice_generations_per_day`: Free = 5, Pro = 50, Premium/Admin = Unlimited (-1).

7. **Zero-Duplication Invariants**:
   - **Mastery**: Single source of truth remains `LearnerTopicMastery`. Successful remediation logs `record_topic_interaction(score=100.0)`.
   - **SM-2**: Flashcard intervals, repetitions, and ease factors in `FlashcardProgress` are completely untouched and read-only.
   - **Adaptive Study Planner**: Integration uses existing `StudyPlanTask(task_type="practice_weak_area")` without duplicate schedulers.
   - **Notification Center**: Reminders use existing `NotificationService` and `Reminder` schema without duplicate tables.

---

## 4. REST API ROUTES (9 ENDPOINTS)

All endpoints registered under the `"Mistake Intelligence"` tag in [`Backend/main.py`](file:///C:/Users/ganes/OneDrive/Desktop/Coding%20Materials/Florix_AI/Backend/main.py):

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/mistakes/analyze` | User | Grounded diagnosis of learner mistake, taxonomy assignment, pattern detection |
| `GET` | `/mistakes` | User | List user mistake bank records with topic, category, and resolved filters |
| `GET` | `/mistakes/{id}` | User | Retrieve detailed mistake diagnosis and citations |
| `POST` | `/mistakes/{id}/resolve` | User | Mark mistake record resolved manually or via practice |
| `DELETE` | `/mistakes/{id}` | User | Delete mistake record with tenant isolation |
| `POST` | `/mistakes/{id}/practice` | User | Generate source-grounded targeted remediation questions |
| `POST` | `/mistakes/{id}/practice/submit` | User | Submit practice answers, grade deterministically, update mastery |
| `POST` | `/mistakes/{id}/plan` | User | Schedule targeted weak-area remediation task in Adaptive Study Planner |
| `POST` | `/mistakes/{id}/remind` | User | Schedule revision reminder via Notification Center |

---

## 5. FRONTEND INTEGRATION

1. **Mistake Bank Hub (`Frontend/src/components/MetacognitiveDebugger.jsx`)**:
   - Comprehensive learner dashboard displaying 4 KPI metrics:
     - Total Mistakes Analyzed
     - Successfully Resolved
     - Prerequisite Blockers
     - Cognitive Recovery Rate (%)
   - Search and filtering by Topic, Error Category, Pattern State, and Resolution status.
   - History card list with color-coded category badges, citation excerpts, and direct actions.

2. **Interactive Metacognitive Debugger Modal (`MetacognitiveDebuggerModal`)**:
   - Misconception diagnosis banner: "What went wrong" vs "Why it went wrong".
   - Grounded evidence drawer: Source page citation, textbook excerpt, and key takeaway.
   - Prerequisite dependency banner highlighting upstream conceptual gaps.
   - Integrated targeted practice runner: live multi-question interactive remediation with instant explanation and mastery feedback.
   - Actions to add directly to Adaptive Study Plan or Notification Center reminders.

3. **Contextual In-Flow Touchpoints**:
   - **Diagnostic Quizzes (`Frontend/src/components/StudySession.jsx`)**: Added *"Why was I wrong?"* diagnostic button next to every incorrect question review.
   - **Exam Review (`Frontend/src/components/ExamWorkspace.jsx`)**: Added *"Debug Mistake"* trigger button for incorrect questions in post-exam scorecard review.
   - **Navigation & Dashboard (`Sidebar.jsx`, `Dashboard.jsx`)**: Added `"Mistake Bank"` sidebar tab mounted as a primary academic workspace.

---

## 6. VERIFICATION & QUALITY AUDIT EVIDENCE

| Verification Gate | Result | Notes |
|---|---|---|
| **Dedicated Mistake Intelligence Test Suite** | 🔒 **16 / 16 PASSED (100%)** | `pytest Backend/test_mistake_intelligence.py -v` (31.51s) |
| **Exam / Mock Exam Engine Regression Suite** | 🔒 **20 / 20 PASSED (100%)** | `pytest Backend/test_exam_engine.py -q` (136.62s) |
| **Adaptive Study Planner Regression Suite** | 🔒 **17 / 17 PASSED (100%)** | `pytest Backend/test_adaptive_study_planner.py -q` (10.08s) |
| **Revision Notification Regression Suite** | 🔒 **28 / 28 PASSED (100%)** | `pytest Backend/test_revision_notifications.py -q` (13.35s) |
| **Phase 5 Visual Learning Test Suite** | 🔒 **16 / 17 PASSED (94.1%)** | 16/16 unit tests passed; 1 transient live Gemini API 503 capacity limit |
| **Database Integrity & Foreign Keys** | 🔒 **0 VIOLATIONS** | `PRAGMA integrity_check` = `ok`; `PRAGMA foreign_key_check` = `0` on `Backend/florix.db` |
| **Runtime Database Hygiene** | 🔒 **0 TEST ARTIFACTS** | `SELECT count(*) FROM mistake_records` = 0 in production DB |
| **Legacy Database Safety** | 🔒 **UNTOUCHED** | Root `florix.db` preserved as untouched legacy artifact |
| **Frontend Production Build** | 🔒 **0 ERRORS** | `npm run build` in `Frontend/` (Built cleanly in 17.54s) |
| **Backend Whitespace & Formatting** | 🔒 **0 ERRORS** | `git diff --check Backend/` exited with code 0 |

---

## 7. LOCK DIRECTIVE

The **Mistake Intelligence / Metacognitive Debugger** subsystem is hereby formally **LOCKED**.

No code modifications, architectural changes, UI redesigns, or speculative extensions may be made to this capability without explicit project owner authorization.

Future capabilities remain strictly **NOT STARTED**:
- Viva / Oral Examination Mode: **NOT STARTED**
- Collaborative Study Rooms: **NOT STARTED**
- Learning Analytics Expansion: **NOT STARTED**
