# MISTAKE INTELLIGENCE & METACOGNITIVE DEBUGGER ARCHITECTURE

## 1. System Mission & Product Purpose
Florix AI’s Mistake Intelligence / Metacognitive Debugger addresses the core pedagogical question:
> **"Why was my answer wrong, and what foundational misunderstanding caused it?"**

Instead of merely revealing answer keys, the Metacognitive Debugger diagnoses cognitive failure points, classifies errors across a controlled 10-tier pedagogical taxonomy, monitors longitudinal pattern states, detects prerequisite gaps using the Phase 5 Knowledge Graph, and orchestrates targeted remediation without duplicating any existing platform subsystems.

---

## 2. Locked Subsystem Invariants & Zero-Duplication

| Existing System | Integration Mode | Invariant Enforced |
| :--- | :--- | :--- |
| **Phase 2 Academic RAG** | Reused directly | Sources chunks (`DocumentChunk`), citations (`CitationItem`), and relevance reranking; no parallel vector index. |
| **Phase 3 Intelligence** | Reused directly | Uses `AssessmentEngine.generate_quiz` for targeted practice; updates `LearnerEngine.record_topic_interaction` and emits `LearningEvent(event_type="MISTAKE_PRACTICE")`. |
| **Phase 3 SM-2 Engine** | Read-only | `FlashcardProgress` remains untouched; mistake debugger never alters intervals or repetitions directly. |
| **Phase 5 Visual Knowledge Graph** | Inspected directly | Traverses `VisualArtifact.visual_data` edges (`prerequisite`, `leads_to`, `part_of`) to surface conceptual gaps. |
| **Adaptive Study Planner** | Reused directly | Spawns `StudyPlanTask(task_type="practice_weak_area")` with priority scores tied to mistake pattern severity. |
| **Notification Infrastructure** | Reused directly | Schedules revision reminders via `NotificationService.create_manual_reminder` targeting `mistake:{id}`. |
| **Subscription Limits** | Extended additively | Reuses existing `PLAN_LIMITS` and `check_plan_limit` architecture with additive quotas. |

---

## 3. Controlled Error Taxonomy

Every error is categorized strictly into one of the following 10 controlled categories (or `UNKNOWN`):

1. `CONCEPTUAL_MISUNDERSTANDING`: Deep flaw in theoretical comprehension or core definitions.
2. `PARTIAL_UNDERSTANDING`: Grasps the general rule but fails on boundary conditions or edge cases.
3. `PROCEDURAL_ERROR`: Algorithmic or step-by-step methodology execution error.
4. `CALCULATION_ERROR`: Arithmetic, computational, or indexing slip despite sound conceptual basis.
5. `CARELESS_ERROR`: Hasty execution or overlooking explicit cues.
6. `MISREAD_QUESTION`: Misinterpretation of constraints (e.g. `NOT`, `EXCEPT`, `FALSE`, or units).
7. `MEMORY_RECALL_FAILURE`: Inability to retrieve memorized facts, terms, or standard nomenclature.
8. `PREREQUISITE_GAP`: Lacks prerequisite foundation required to comprehend the current topic.
9. `CONFUSION_BETWEEN_CONCEPTS`: Conflation of two distinct but related concepts.
10. `INCORRECT_APPLICATION`: Sound theoretical grasp applied to an inappropriate context or archetype.
11. `UNKNOWN`: Insufficient evidence to classify definitively (explicit epistemic honesty).

---

## 4. Longitudinal Pattern State Engine

Mistake patterns are tracked across user learning events (`QUIZ_INTERACTION`, `QUIZ_ANSWER`, `EXAM_SUBMISSION`, `MISTAKE_PRACTICE`):

- **`ISOLATED`**: Single isolated error on this topic (<= 1 prior failed interaction).
- **`RECURRING`**: 2 consecutive errors on the same topic.
- **`PERSISTENT`**: 3+ consecutive errors on the same topic; systemic cognitive block.
- **`IMPROVING`**: Scored >= 70% but < 100% on recent targeted remediation practice.
- **`RESOLVED`**: Scored 100% on targeted practice or confirmed through verified mastery.

---

## 5. Database Schema & Multi-Tenant Isolation

### Model: `MistakeRecord` (`Backend/database.py`)
- `id`: Integer primary key.
- `user_id`: Integer foreign key (`users.id`, index=True, nullable=False).
- `session_id`: Integer foreign key (`study_sessions.id`, nullable=True).
- `source_type`: String (`"quiz"`, `"exam"`, `"manual"`).
- `source_id`: Integer reference to originating quiz or exam attempt.
- `question_text`: Text of the question.
- `user_answer`: User's submitted answer text.
- `correct_answer`: Grounded correct answer text.
- `options`: JSON list of options.
- `topic`: String topic name (index=True).
- `subtopic`: Granular section heading or subtopic.
- `difficulty`: String (`"beginner"`, `"intermediate"`, `"advanced"`).
- `teaching_mode`: String (`"BEGINNER"`, `"INTERMEDIATE"`, `"ADVANCED"`, etc.).
- `error_category`: String taxonomy key (index=True).
- `misconception`: Single-sentence diagnosis of mental model failure.
- `why_incorrect`: Pedagogical explanation of why the user's answer does not hold.
- `correct_reasoning`: Grounded step-by-step reasoning.
- `prerequisite_concept`: Foundational concept name if detected.
- `citations`: JSON list of chunk references (`page_number`, `section_heading`, `snippet`).
- `pattern_state`: String pattern state (index=True).
- `is_resolved`: Boolean flag.
- `resolved_at`: Datetime of resolution.
- `created_at`, `updated_at`: Datetimes.

### Security / IDOR Defense
Every service method (`get_mistake_or_404`, `resolve_mistake`, `delete_mistake`, `generate_targeted_practice`, `submit_targeted_practice`, `schedule_planner_task`, `schedule_notification_reminder`) strictly enforces `MistakeRecord.user_id == current_user.id`. Cross-tenant access attempts return HTTP 404.

---

## 6. Subscription Entitlements

Additive limits in `PLAN_LIMITS`:
- `mistake_analyses_per_day`:
  - Free: 10
  - Pro: 100
  - Premium: Unlimited (`-1`)
  - Admin: Unlimited (`-1`)
- `ai_practice_generations_per_day`:
  - Free: 5
  - Pro: 50
  - Premium: Unlimited (`-1`)
  - Admin: Unlimited (`-1`)

Enforced via `check_plan_limit(user, resource, db)` returning HTTP 402 upon quota exhaustion.

---

## 7. REST API Endpoints

| Method | Path | Description | Plan Enforced |
| :--- | :--- | :--- | :--- |
| `POST` | `/mistakes/analyze` | Metacognitive diagnostic analysis & record persistence | `mistake_analyses_per_day` |
| `GET` | `/mistakes` | List user mistakes with topic/category/resolved filters | Authenticated |
| `GET` | `/mistakes/{id}` | Retrieve comprehensive diagnosis and citations | IDOR protected |
| `POST` | `/mistakes/{id}/resolve` | Mark mistake as resolved | IDOR protected |
| `DELETE` | `/mistakes/{id}` | Delete tracked mistake record | IDOR protected |
| `POST` | `/mistakes/{id}/practice` | Generate targeted remediation practice questions | `ai_practice_generations_per_day` |
| `POST` | `/mistakes/{id}/practice/submit` | Grade practice deterministically, update mastery | Authenticated |
| `POST` | `/mistakes/{id}/plan` | Schedule weak-area practice task in Study Plan | Authenticated |
| `POST` | `/mistakes/{id}/remind` | Schedule revision reminder via NotificationService | Authenticated |

---

## 8. Frontend Integration

1. **`MetacognitiveDebuggerModal.jsx`**:
   - Reusable interactive diagnostic modal.
   - Embeds into `StudySession.jsx` (quiz breakdown review for incorrect answers).
   - Embeds into `ExamWorkspace.jsx` (exam attempt question audit for incorrect answers).
   - Displays taxonomy badge, mental model flaw, why incorrect, step-by-step reasoning, prerequisite alert, and grounded citations.
   - Interactive practice mode with real-time submission, grading feedback, and pattern state transition.
   - Action triggers for Adaptive Study Planner and NotificationCenter.
2. **`MetacognitiveDebugger.jsx`**:
   - Dedicated "Mistake Bank" workspace in Dashboard and Sidebar navigation.
   - High-level KPIs: Tracked Errors, Resolved Count, Active Blockers, Recovery Rate.
   - Multi-dimensional filtering by topic, status (all/active/resolved), and taxonomy category.
