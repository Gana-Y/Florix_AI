# FLORIX AI — ADAPTIVE STUDY PLANNER LOCKED CHECKPOINT

**Status**: 🔒 LOCKED  
**Date**: October 2026  
**Author**: Ganesh (Lead Architect) & Aria  

---

## 1. PROJECT LIFECYCLE STATE

```
PHASE 1 (Foundations & Core System)                 = LOCKED 🔒
PHASE 2 (Academic RAG & Knowledge Vault)            = LOCKED 🔒
PHASE 3 (Intelligence & Mastery Engine)             = LOCKED 🔒
PHASE 4 (Multimodal Processing Pipeline)            = LOCKED 🔒
PHASE 5 (Visual Learning & Concept Mapping)         = LOCKED 🔒
REVISION NOTIFICATION & REMINDER INFRASTRUCTURE     = LOCKED 🔒
ADAPTIVE STUDY PLANNER                              = LOCKED 🔒
NEXT FUTURE CAPABILITY                              = NOT STARTED ⏹️
```

---

## 2. CAPABILITY SCOPE & IMPLEMENTATION SUMMARY

The **Adaptive Study Planner** is the intelligence orchestration layer that answers:
> **"What should this learner study next, why, for how long, and when?"**

### Core Delivered Features:
1. **Multi-Factor Priority Scoring**: Transparent $0 \dots 100$ scoring algorithm and four-tier priority classification (`critical`, `high`, `medium`, `low`) factoring in topic mastery scores, SM-2 due card counts, recent quiz accuracy, days to exam, days since last studied, and learner focus goals.
2. **Transparent Explainability**: Each scheduled task carries human-readable reasoning and structured numerical factor dictionaries (`mastery`, `sm2_due_count`, `recent_quiz_accuracy`, `days_since_last_studied`).
3. **Four Planning Modes**:
   - `daily`: Today-focused schedule with knapsack budget enforcement honoring `daily_available_minutes`.
   - `weekly`: 7-day rolling trajectory distributed across preferred study days.
   - `exam`: Spaced topic progression with dedicated Final Review & Active Recall milestones scheduled 48h prior to target date.
   - `goal`: Targeted deep dives on learner-selected focus topics and sessions.
4. **Adaptive Recalibration**: Recalibrates priorities when mastery improves ($\ge 85\%$) or drops ($< 40\%$), and forward-shifts overdue tasks via `POST /study-plans/{id}/adapt`.
5. **Bounded Rescheduling**: Skips reschedule tasks to tomorrow with a strict maximum bound of 3 skips to prevent topic starvation while preserving learner agency.
6. **User Control**: Add manual custom tasks, edit parameters, complete tasks, skip tasks, and delete plans/tasks.
7. **Frontend Workspace (`AdaptiveStudyPlanner.jsx`)**:
   - Active plan overview with metrics (budget, progress bar, study days, target date).
   - Dynamic timeline grouped into *Today*, *Tomorrow*, *Later This Week*, and *Overdue / Rescheduled*.
   - Expandable *"Why recommended?"* explanation drawer.
   - Task actions (Complete, Skip, Remind, Study Now, Delete).
   - Plan creation modal with entitlement badges and custom task creation drawer.
   - Integrated into `Dashboard.jsx` and `Sidebar.jsx`, with Home Tab quick access.

---

## 3. ARCHITECTURAL & SUBSCRIPTION INVARIANTS VERIFIED

- **Subscription Architecture Verified & Preserved**:
  - Pre-existing `PLAN_LIMITS` dictionary and `check_plan_limit` function in `Backend/main.py` reused without architectural mutation.
  - Planner-specific entitlements are purely additive: `active_study_plans`, `study_plans_per_day`, `allowed_plan_modes`, and `max_planning_days`.
  - Zero existing pricing tiers modified: Free, Pro (₹799/mo), and Premium (₹1599/mo) remain intact.
  - Zero unrelated subscription limits or payment routes altered.
- **Backend Entitlement Enforcement & API Bypass Resistance**:
  - Free users are strictly blocked from `exam` mode and $>7$-day planning horizons with `HTTP 402 Payment Required`.
  - Pro users are entitled to `exam` mode and up to 60-day horizons.
  - Premium users enjoy unlimited active plans and horizons.
  - Administrators (`user.is_admin == True`) bypass quota limits.
  - Direct API calls enforcing `check_plan_limit` cannot bypass subscription quotas.
- **Spaced Repetition (SM-2) Remains Single Source of Truth**:
  - Planner queries `.count()` of due flashcards with read-only semantics.
  - Planner contains zero logic calculating SM-2 intervals, zero ease factor mutations, and zero mutations to `FlashcardProgress.next_review`.
- **Existing Mastery Remains Single Source of Truth**:
  - `LearnerTopicMastery` remains the exclusive source of topic mastery scores.
- **Existing Notification Infrastructure Reused**:
  - Zero duplicate notification schedulers, zero background threads, and zero duplicate reminder tables created.
  - All task reminder operations delegate to `NotificationService.create_manual_reminder` and `NotificationService.complete_reminder`.
- **Strict Data Ownership Boundaries**:
  - Planner owns exclusively `StudyPlan` and `StudyPlanTask`.
  - `LearnerTopicMastery`, `LearningEvent`, `FlashcardProgress`, `QuizResult`, and `RevisionReminder` remain owned by their respective subsystems.

---

## 4. VERIFICATION EVIDENCE & AUDIT RESULTS

| Verification Area | Suite / Command | Result |
|---|---|---|
| **Adaptive Study Planner Suite** | `pytest Backend/test_adaptive_study_planner.py -v` | **17/17 PASSED** (100%) |
| **Revision Notifications Suite** | `pytest Backend/test_revision_notifications.py -v` | **28/28 PASSED** (100%) |
| **Phase 5 Visual Learning Suite** | `pytest Backend/test_visual_learning.py -v` | **17/17 PASSED** (100%) |
| **Core Intelligence & Multimodal** | `pytest Backend/test_intelligence.py Backend/test_multimodal.py -v` | **41/41 PASSED** (100%) |
| **Frontend Production Build** | `cd Frontend && npm run build` | **Built in 24.96s** (0 errors) |
| **Authoritative DB Integrity** | `PRAGMA integrity_check;` on `Backend/florix.db` | `[('ok',)]` |
| **Authoritative DB Foreign Keys** | `PRAGMA foreign_key_check;` on `Backend/florix.db` | `[]` (0 violations) |
| **Additive Tables & Indexes** | `study_plans`, `study_plan_tasks` + 13 indexes | Verified |
| **Legacy Database Safety** | Root `florix.db` | Untouched legacy artifact |
| **Whitespace & Git Integrity** | `git diff --check` | 0 errors |
| **ChromaDB Vector Binary** | `data_level0.bin` | Restored to pristine git state |

---

## 5. HARD LOCK DIRECTIVE

The **Adaptive Study Planner** is permanently locked.

No code modifications, UI refactoring, or speculative feature work may be performed on this capability.

The following future capabilities remain **NOT STARTED** and must NOT be initiated without explicit authorization:
- Exam / Mock Exam Engine
- Mistake Intelligence
- Viva / Oral Interview Mode
- Collaborative Study Rooms
- Concept-dependency graph intelligence
- Any other capability beyond this locked checkpoint
