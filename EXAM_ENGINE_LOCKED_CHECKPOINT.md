# FLORIX AI — EXAM / MOCK EXAM ENGINE LOCKED CHECKPOINT

**Phase / Capability**: Exam / Mock Exam Engine  
**Status**: 🔒 **LOCKED & VERIFIED**  
**Author**: Ganesh (Lead Architect) & Aria  
**Date**: October 2026  
**Commitment**: Production Foundation Checkpoint  

---

## 1. CAPABILITY PURPOSE & CHARTER

Florix AI is an academic mastery and research-grounded platform. Its architectural chain transforms:
$$\text{Input} \longrightarrow \text{Understanding} \longrightarrow \text{Questioning} \longrightarrow \text{Visualization} \longrightarrow \text{Practice} \longrightarrow \text{Feedback} \longrightarrow \text{Mastery} \longrightarrow \text{Next Steps}$$

The **Exam / Mock Exam Engine** is the evaluative assessment layer answering:
> **"Is this learner actually ready for the target subject, topic, syllabus, or exam?"**

It transitions formative study sessions into realistic, timed academic examinations with server-authoritative timer controls, deterministic grading, anti-leakage defenses, and closed-loop mastery updates.

---

## 2. SYSTEM LOCKED STATE HIERARCHY

| Milestone / Subsystem | Status | Scope & Boundary |
|---|---|---|
| **Phase 1** (Core Foundation & Ingestion) | 🔒 **LOCKED** | Document processing, chunking, extraction |
| **Phase 2** (Multimodal RAG & Citations) | 🔒 **LOCKED** | Hybrid retrieval, vector store, citation integrity |
| **Phase 3** (Diagnostic Quizzes & Intelligence) | 🔒 **LOCKED** | Assessment prompts, learner topic mastery, learning events |
| **Phase 4** (SM-2 Spaced Repetition Loop) | 🔒 **LOCKED** | Flashcards, SM-2 scheduling (untouched) |
| **Phase 5** (Visual Learning & Concept Mapping) | 🔒 **LOCKED** | Visual artifacts, graph layouts, mastery overlays |
| **Revision Notification Infrastructure** | 🔒 **LOCKED** | Reminders, quiet hours, notification center |
| **Adaptive Study Planner** | 🔒 **LOCKED** | Task prioritization, study plans, deadline horizons |
| **Exam / Mock Exam Engine** | 🔒 **LOCKED** | Exam blueprints, active attempts, server timer, deterministic scoring, review |
| *Mistake Intelligence / Metacognitive Debugger* | ⏳ *NOT STARTED* | Awaiting explicit project owner authorization |
| *Viva / Oral Examination Mode* | ⏳ *NOT STARTED* | Future phase |
| *Collaborative Study Rooms* | ⏳ *NOT STARTED* | Future phase |

---

## 3. IMPLEMENTATION SUMMARY

### Backend Architecture (`Backend/exam/`, `Backend/database.py`, `Backend/main.py`)
1. **Additive Database Models**:
   - `Exam`: Blueprint defining mode (`practice`, `mock`, `topic`, `full_syllabus`), difficulty, duration, passing score, question count, and topics.
   - `ExamQuestion`: Grounded question bank storing options, integer correct answer, explanation, topic, section heading, page number, and source chunk ID.
   - `ExamAttempt`: State machine (`in_progress` $\rightarrow$ `submitted` / `timed_out` / `graded`) with server-authoritative timestamps, score, percentage, and topic scores.
   - `ExamAnswer`: Per-attempt answer ledger with review flags (`is_marked_for_review`), correctness, and response times.
2. **Three-Tier Resilient Generation Cascade**:
   - **Tier 1**: Source-grounded question synthesis via `AssessmentEngine.generate_quiz` using vector-retrieved `DocumentChunk`s.
   - **Tier 2**: Session text fallback via `generate_fallback_fn`.
   - **Tier 3**: Deterministic grounded extraction from source text and chunks, guaranteeing 100% reliability in offline or LLM rate-limited (429) environments.
3. **Anti-Leakage Defense**:
   - Active attempts return `ExamQuestionSanitizedResponse` (withholding answers and explanations).
   - Post-submission review endpoint reveals answers, explanations, and citations only after attempt completion.
4. **Server-Authoritative Timing**:
   - `started_at`, `duration_minutes`, and `expires_at` are persisted on the server.
   - Auto-submits automatically upon expiration (+15s network grace period). Client timer manipulation is rejected.
5. **Deterministic Scoring & Idempotent Submission**:
   - Graded strictly via `evaluate_answer(user_answer, correct_answer)` where `None != correct`.
   - Multiple submission requests return the existing graded attempt idempotently without duplicate scoring or duplicate event logging.
6. **Mastery & Planner Integration**:
   - Submissions update `LearnerEngine.record_topic_interaction` per tested topic.
   - Emits persistent `LearningEvent(event_type="EXAM_SUBMISSION")` for downstream ingestion by the **Adaptive Study Planner**.
   - Zero mutation or bypass of Phase 4 SM-2 parameters (`ease_factor`, `interval`, `repetitions`, `next_review`).
7. **Subscription Entitlements**:
   - Additive plan limits (`exams_per_day`, `max_exam_questions`, `allowed_exam_modes`) enforced in `check_plan_limit` on the backend.
8. **Notification Integration**:
   - Reuses existing `NotificationService` and `Reminder` infrastructure for exam revision alerts (`POST /exams/{id}/remind`).

---

## 4. REST API ROUTES (10 ENDPOINTS)

All endpoints registered under the `"Exam Engine"` tag in [`Backend/main.py`](file:///C:/Users/ganes/OneDrive/Desktop/Coding%20Materials/Florix_AI/Backend/main.py):

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/exams` | User | Create exam blueprint (enforces tier limits) |
| `GET` | `/exams` | User | List user exams with attempt counts and best scores |
| `GET` | `/exams/{exam_id}` | User | Retrieve exam blueprint details (isolated) |
| `DELETE` | `/exams/{exam_id}` | User | Cascade-delete exam and all associated data |
| `POST` | `/exams/{exam_id}/start` | User | Start or resume active attempt (server timer) |
| `GET` | `/exams/attempts/{attempt_id}` | User | Get sanitized active attempt (answers withheld) |
| `PUT` | `/exams/attempts/{attempt_id}/answers` | User | Auto-save answers and review flags |
| `POST` | `/exams/attempts/{attempt_id}/submit` | User | Deterministic grade, update mastery, idempotent |
| `GET` | `/exams/attempts/{attempt_id}/review` | User | Post-exam review with answers and citations |
| `POST` | `/exams/{exam_id}/remind` | User | Schedule exam reminder via `NotificationService` |

---

## 5. FRONTEND INTEGRATION (`Frontend/src/components/ExamWorkspace.jsx`)

1. **Exam Bank Hub**: Displays exam blueprints, mode badges, durations, question counts, and scorecard metrics.
2. **Configurator Modal**: Exam mode selection (`practice`, `mock`, `topic`, `full_syllabus`), question sliders, duration inputs, and topic selection.
3. **Question Navigator Palette**: Interactive 1..N grid with real-time indicators (Answered, Current, Marked for Review, Unanswered).
4. **Server-Authoritative Countdown Timer**: Visual warnings when $< 5$ minutes remain, auto-submitting on expiration.
5. **Pre-Submit Confirmation Modal**: Summarizes answered vs unanswered vs flagged counts.
6. **Scorecard Hero & Mistake Review**: Hero banner displaying score/pass-fail status, topic performance progress bars, recommendations, and question review with source page/section citations.
7. Mounted in [`Frontend/src/pages/Dashboard.jsx`](file:///C:/Users/ganes/OneDrive/Desktop/Coding%20Materials/Florix_AI/Frontend/src/pages/Dashboard.jsx) under the `"Exams & Mocks"` sidebar tab in [`Frontend/src/components/Sidebar.jsx`](file:///C:/Users/ganes/OneDrive/Desktop/Coding%20Materials/Florix_AI/Frontend/src/components/Sidebar.jsx).

---

## 6. VERIFICATION & QUALITY AUDIT EVIDENCE

| Verification Gate | Result | Notes |
|---|---|---|
| **Dedicated Exam Engine Test Suite** |  **20 / 20 PASSED (100%)** | `pytest Backend/test_exam_engine.py -v` |
| **Phase 5 Visual Learning Test Suite** |  **17 / 17 PASSED (100%)** | `pytest Backend/test_visual_learning.py -v` |
| **Adaptive Study Planner Test Suite** |  **17 / 17 PASSED (100%)** | `pytest Backend/test_adaptive_study_planner.py -v` |
| **Revision Notification Test Suite** |  **28 / 28 PASSED (100%)** | `pytest Backend/test_revision_notifications.py -v` |
| **Full Backend Regression Suite** |  **731 PASSED (99.9%)** | `pytest Backend -v -m "not slow"` (1 transient live API quota limit on Gemini) |
| **Database Integrity & Foreign Keys** |  **0 VIOLATIONS** | `PRAGMA integrity_check` = `ok`; `PRAGMA foreign_key_check` = `0` on `Backend/florix.db` |
| **Frontend Production Build** |  **0 ERRORS** | `npm run build` in `Frontend/` (Built cleanly in 14.34s) |
| **Whitespace & Formatting Audit** |  **0 ERRORS** | `git diff --check` exited with code 0 |

---

## 7. ARCHITECTURAL INVARIANTS & INTEGRATION GUARANTEES

- **Zero Duplication**: Reuses Phase 2 RAG, Phase 3 Intelligence, Phase 4 SM-2 (read-only), Revision Notifications, and Subscriptions.
- **SM-2 Invariant**: Spaced repetition intervals, repetitions, and ease factors are strictly preserved.
- **Mastery Invariant**: Existing `LearnerTopicMastery` remains the single source of truth for learner competency.
- **Authoritative Database**: `Backend/florix.db` verified as the authoritative production database. Root `florix.db` is an untouched legacy test artifact.
- **Multi-Tenant Security**: 100% IDOR/BOLA protection verified across all exam routes.

---

## 8. LOCK VERIFICATION

The Exam / Mock Exam Engine is hereby formally **LOCKED**.
No further modifications may be made to this capability without explicit project owner authorization.
Future capabilities (Mistake Intelligence, Viva Mode, Collaborative Study Rooms) remain unstarted.
