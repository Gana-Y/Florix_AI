# FLORIX AI — ADAPTIVE STUDY PLANNER ARCHITECTURE

**System Capability**: Adaptive Study Planner  
**Status**: Implemented, Verified, and Green  
**Author**: Ganesh (Lead Architect) & Aria  
**Date**: October 2026  

---

## 1. MISSION & CORE PRODUCT PRINCIPLE

Florix AI is not a generic chatbot. Its purpose is to transform educational material through:
$$\text{Input} \longrightarrow \text{Understanding} \longrightarrow \text{Questioning} \longrightarrow \text{Visualization} \longrightarrow \text{Practice} \longrightarrow \text{Feedback} \longrightarrow \text{Mastery} \longrightarrow \text{Adaptive Trajectory}$$

The **Adaptive Study Planner** serves as the intelligence orchestration layer that answers the learner's most critical question:
> **"What should I study next, why, for how long, and when?"**

### Zero Duplication Principle
The planner **never** invents duplicate learning systems. Instead, it directly orchestrates existing authoritative Florix subsystems:
1. **Phase 2 RAG & Document Chunks**: Resolves session concepts and study content from `DocumentChunk` and `StudySession`.
2. **Phase 3 Learner Mastery**: Ingests topic mastery scores ($0.0 \dots 1.0$) and weak subtopics from `LearnerTopicMastery` and `LearningEvent`.
3. **Spaced Repetition (SM-2)**: Orchestrates active recall tasks triggered strictly by `FlashcardProgress.next_review \le \text{now}$ without mutating SM-2 intervals or ease factors.
4. **Quizzes & Diagnostic Performance**: Leverages recent `QuizResult` accuracy percentages to identify weak topics.
5. **Phase 5 Visual Learning**: Schedules visual concept mapping and mental model consolidation for complex, multi-concept sessions.
6. **Revision Notification Infrastructure**: Direct integration with `NotificationService` to automatically schedule revision alerts and resolve them upon task completion.
7. **Subscription Entitlement Layer**: Strict enforcement of tier limits (`free`, `pro`, `premium`, `admin`) via `PLAN_LIMITS` and `check_plan_limit`.

---

## 2. MULTI-FACTOR PRIORITIZATION ENGINE

Every recommended task receives an **explainable priority score** ($0 \dots 100$) and a deterministic classification level:

| Priority Level | Score Range | Description |
|---|---|---|
| **Critical** | $\ge 80.0$ | Overdue SM-2 active recall, urgent exam target ($< 7$ days), or severely struggling topics ($\text{mastery} < 0.40$). |
| **High** | $60.0 \dots 79.9$ | Moderate mastery ($0.40 \dots 0.65$), low recent quiz accuracy ($< 60\%$), or learner-specified goal topics. |
| **Medium** | $40.0 \dots 59.9$ | Maturing concepts ($0.65 \dots 0.85$) or routine topic deep-dives. |
| **Low** | $< 40.0$ | Mastered concepts ($\ge 0.85$) or newly studied material requiring no immediate revision. |

### Prioritization Scoring Formula
The base score is computed transparently:
$$S = 50.0 + \Delta_{\text{mastery}} + \Delta_{\text{sm2}} + \Delta_{\text{quiz}} + \Delta_{\text{exam}} + \Delta_{\text{recency}} + \Delta_{\text{goal}}$$

Where:
- $\Delta_{\text{mastery}} = (0.7 - \text{mastery}) \times 40.0$
- $\Delta_{\text{sm2}} = \min(25.0, \text{due\_cards} \times 5.0)$
- $\Delta_{\text{quiz}} = (0.7 - \text{quiz\_accuracy}) \times 25.0$
- $\Delta_{\text{exam}} = \begin{cases} 30.0 & \text{if } \text{days\_to\_exam} \le 3 \\ 20.0 & \text{if } \text{days\_to\_exam} \le 7 \\ 10.0 & \text{if } \text{days\_to\_exam} \le 14 \\ 0 & \text{otherwise} \end{cases}$
- $\Delta_{\text{recency}} = \min(15.0, \text{days\_since\_studied} \times 2.0)$
- $\Delta_{\text{goal}} = +15.0 \text{ (if topic explicitly matches learner's target focus)}$
- Clamped to $[10.0, 100.0]$.

### Explainability Contract
Each generated task carries:
- `recommendation_reason`: A human-readable rationale (e.g., *"Active recall is due for 4 flashcard(s) under SM-2 schedule."* or *"Reinforcement needed: Topic mastery is 35% with recent quiz accuracy 40%."*).
- `reason_factors`: A structured dictionary containing `{ "mastery": 0.35, "sm2_due_count": 4, "recent_quiz_accuracy": 0.40, "days_since_last_studied": 3 }`.

---

## 3. PLANNING MODES & SCHEDULING ALGORITHMS

### A. Daily Focus (`mode: "daily"`)
- Generates a prioritized study list strictly for **Today**.
- Knapsack budget enforcement: Accumulates top candidate tasks until $\sum \text{estimated\_minutes} \le \text{daily\_available\_minutes}$.
- Tasks beyond the budget are omitted to avoid learner cognitive overload.

### B. Weekly Roadmap (`mode: "weekly"`)
- Spreads tasks across the learner's **preferred study days** over a 7-day rolling window.
- Distributes high-priority tasks into early slots, pacing learning evenly.

### C. Exam Preparation (`mode: "exam"`)
- Requires a `target_date`.
- Allocates topics into a spaced progression across available study days up to the exam date.
- Dedicated **Final Review & Active Recall** milestones are automatically scheduled in the final 48 hours before the exam.
- Gated to `pro` and `premium` tiers.

### D. Goal-Oriented (`mode: "goal"`)
- Focuses specifically on user-provided `focus_topics` or selected `focus_session_ids`.
- Prioritizes prerequisite foundational concepts and weak subtopics.

---

## 4. ADAPTATION & RECALIBRATION PROTOCOL

The planner adapts dynamically via `POST /study-plans/{id}/adapt`:
1. **Performance Improvements**: If recent quiz accuracy on a topic reaches $\ge 85\%$, repeat study tasks for that topic are automatically downgraded from Critical/High to Medium priority.
2. **Struggling Signals**: If topic mastery drops below $40\%$, pending tasks for that topic are elevated to High priority with explicit reinforcement reasons.
3. **Overdue Forward-Shifting**: Any pending or rescheduled tasks whose `scheduled_date` has elapsed are shifted into the current day's active study slot.
4. **Bounded Skip Rescheduling**: When a learner skips a task (`POST /study-plans/tasks/{id}/skip`), the task is rescheduled to tomorrow (up to a bounded limit of 3 skips) to prevent topic starvation while respecting learner agency.

---

## 5. DATABASE SCHEMA

The schema is registered in [`Backend/database.py`](file:///C:/Users/ganes/OneDrive/Desktop/Coding%20Materials/Florix_AI/Backend/database.py) using SQLAlchemy with full cascading deletion:

```sql
-- Study Plans Table
CREATE TABLE study_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode VARCHAR(32) NOT NULL DEFAULT 'weekly',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_date DATETIME,
    daily_available_minutes INTEGER NOT NULL DEFAULT 60,
    preferred_days JSON,
    focus_session_ids JSON,
    focus_topics JSON,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    total_tasks INTEGER NOT NULL DEFAULT 0,
    completed_tasks INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_study_plans_user_id ON study_plans(user_id);
CREATE INDEX ix_study_plans_status ON study_plans(status);

-- Study Plan Tasks Table
CREATE TABLE study_plan_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
    session_id INTEGER REFERENCES study_sessions(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    task_type VARCHAR(32) NOT NULL DEFAULT 'study_topic',
    target_topic VARCHAR(255),
    priority VARCHAR(16) NOT NULL DEFAULT 'medium',
    priority_score FLOAT NOT NULL DEFAULT 50.0,
    estimated_minutes INTEGER NOT NULL DEFAULT 20,
    scheduled_date DATETIME,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    completed_at DATETIME,
    recommendation_reason TEXT,
    reason_factors JSON,
    reminder_id INTEGER REFERENCES revision_reminders(id) ON DELETE SET NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_study_plan_tasks_plan_id ON study_plan_tasks(plan_id);
CREATE INDEX ix_study_plan_tasks_scheduled_date ON study_plan_tasks(scheduled_date);
CREATE INDEX ix_study_plan_tasks_status ON study_plan_tasks(status);
```

---

## 6. REST API CONTRACT

All endpoints enforce multi-tenant JWT authentication and strict IDOR defenses.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/study-plans` | Generates a new adaptive plan orchestrating SM-2, quizzes, and mastery. |
| `GET` | `/study-plans` | Lists all study plans owned by the authenticated learner. |
| `GET` | `/study-plans/{id}` | Retrieves full study plan details including prioritized tasks. |
| `PUT` | `/study-plans/{id}` | Updates plan metadata, daily minutes budget, or preferred study days. |
| `DELETE` | `/study-plans/{id}` | Deletes a plan and cascades deletion to all attached tasks. |
| `POST` | `/study-plans/{id}/adapt` | Recalibrates priorities and reschedules overdue tasks based on performance. |
| `POST` | `/study-plans/{id}/tasks` | Adds a custom manual task to an existing plan. |
| `PUT` | `/study-plans/tasks/{id}` | Modifies task title, duration, priority, or scheduled date. |
| `POST` | `/study-plans/tasks/{id}/complete` | Marks task completed and resolves any linked revision reminder. |
| `POST` | `/study-plans/tasks/{id}/skip` | Bounded reschedule of task to tomorrow (max 3 skips). |
| `DELETE` | `/study-plans/tasks/{id}` | Removes a task and updates parent plan counters. |
| `POST` | `/study-plans/tasks/{id}/remind` | Creates an automated notification reminder in `revision_reminders`. |

---

## 7. SUBSCRIPTION ENTITLEMENTS

| Limit Metric | Free Tier | Pro Tier (₹799/mo) | Premium Tier (₹1599/mo) | Admin |
|---|---|---|---|---|
| **Active Plans** | 1 | 3 | Unlimited ($-1$) | Bypass |
| **Plans Generated / Day** | 2 | 10 | Unlimited ($-1$) | Bypass |
| **Allowed Modes** | Daily, Weekly, Goal | Daily, Weekly, Exam, Goal | All | All |
| **Max Planning Days** | 7 days | 60 days | Unlimited ($-1$) | Bypass |

---

## 8. FRONTEND ARCHITECTURE

1. **`AdaptiveStudyPlanner.jsx`**:
   - Built with Tailwind CSS, Lucide icons, Framer Motion, and dark mode support.
   - **Header & Metric Cards**: Displays active plan selector, daily budget, task completion progress bar, study days, and target date.
   - **Dynamic Timeline**: Groups tasks into *Today*, *Tomorrow*, *Later This Week*, and *Overdue / Rescheduled*.
   - **Explainability Accordion**: Clickable *"Why recommended?"* toggle breaking down mastery score, cards due under SM-2, and quiz accuracy.
   - **Task Actions**: Complete, Skip & Reschedule, Set Reminder, Delete, and direct *Study Now* jump to linked study sessions.
   - **Creation & Custom Task Modals**: Intuitive planning mode picker, daily time sliders, day-of-week toggles, and entitlement badges.
2. **Dashboard Integration**:
   - Integrated as a dedicated tab (`Study Planner`) in `Frontend/src/pages/Dashboard.jsx` and `Frontend/src/components/Sidebar.jsx`.
   - Direct CTA quick-launch button on `HomeTab` alongside Progress and New Session.

---

## 9. VERIFICATION EVIDENCE

- **Dedicated Planner Test Suite**: `pytest Backend/test_adaptive_study_planner.py -v` $\longrightarrow$ **17/17 PASSED** (100%).
- **Revision Notification Test Suite**: `pytest Backend/test_revision_notifications.py -v` $\longrightarrow$ **28/28 PASSED** (100%).
- **Phase 5 Visual Learning Test Suite**: `pytest Backend/test_visual_learning.py -v` $\longrightarrow$ **17/17 PASSED** (100%).
- **Frontend Production Build**: `npm run build` $\longrightarrow$ **Built in 24.96s with 0 errors**.
- **Database Integrity**:
  - `PRAGMA integrity_check` $\longrightarrow$ `[('ok',)]`
  - `PRAGMA foreign_key_check` $\longrightarrow$ `[]` (0 violations)
- **Formatting & Lint Integrity**: `git diff --check` $\longrightarrow$ **0 errors**.
- **SM-2 & Mastery Invariants**: Tested and confirmed zero unintended mutation of flashcard review intervals or mastery score tables.
