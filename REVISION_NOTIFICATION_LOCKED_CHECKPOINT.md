# FLORIX AI — REVISION NOTIFICATION & REMINDER INFRASTRUCTURE
## PERMANENT LOCKED CHECKPOINT & ARCHITECTURAL VERIFICATION RECORD

**Date:** 2026-10-01  
**Status:** 🔒 LOCKED & VERIFIED  

---

## 1. PROJECT STATUS

```text
PHASE 1 = LOCKED
PHASE 2 = LOCKED
PHASE 3 = LOCKED
PHASE 4 = LOCKED
PHASE 5 = LOCKED
REVISION NOTIFICATION & REMINDER INFRASTRUCTURE = LOCKED
ADAPTIVE STUDY PLANNER / PHASE 6 = NOT STARTED
```

---

## 2. PURPOSE OF THE CAPABILITY

The **Revision Notification & Reminder Infrastructure** bridges Florix AI's existing spaced repetition algorithm (SM-2) and academic study assets with a reliable, multi-tenant notification and reminder subsystem.

### Key Capabilities Provided:
- **Automatic SM-2 Revision Reminders**: Scans `FlashcardProgress` for due review cards (`next_review <= now()`) and groups them by session into actionable reminders without duplicating learning progress.
- **Manual Reminders**: Allows students to schedule explicit revision reminders for sessions, flashcards, quizzes, visual concept maps, and topics.
- **Notification Center UI**: Popover dropdown in the application header with **Due Now**, **Upcoming**, and **History** tabs, unread badge counters, and real-time refresh.
- **Snooze & Reschedule Separation**: Postpones delivery (`snoozed_until` / `scheduled_at`) without modifying underlying SM-2 learning math, intervals, ease factors, or repetition numbers.
- **Recurrence Engine**: Supports `once`, `daily`, and `weekly` recurrence rules, automatically spawning subsequent instances upon completion.
- **Web Browser Alerts**: Native Web Notification API integration with user permission negotiation and desktop notifications.
- **Notification Preferences & Quiet Hours**: Configurable toggles for auto-sync and browser alerts, plus overnight/daytime quiet hour windows.
- **Direct Deep-Link Routing**: Clicking a notification opens the exact study session and switches directly into the target view (e.g. `flashcards`, `quiz`, `visual`, `summary`).
- **Strict Multi-Tenant Isolation & IDOR Defense**: All database operations verify `user_id == current_user.id`.
- **Timezone-Aware & Idempotent Scheduling**: Stores UTC timestamps with ISO formatting and deduplicates automated revision reminders.

---

## 3. AUTHORITATIVE ARCHITECTURAL INVARIANTS

```text
Existing SM-2 (FlashcardProgress)
     ↓
next_review <= now()
     ↓
automatic reminder detection
     ↓
notification infrastructure (reminders table)
     ↓
notification center
     ↓
existing learning activity

Manual reminder (user created)
     ↓
notification infrastructure (reminders table)
     ↓
notification center
     ↓
existing learning activity
```

### Architectural Rules:
1. **Single Source of Truth**: SM-2 spaced repetition math resides exclusively in Florix's existing learning engine. The notification system is delivery infrastructure, **not** a secondary learning engine.
2. **Notification vs. Memory Decoupling**: Snoozing, dismissing, or completing a reminder modifies *only* `Reminder` state. It **never** alters `FlashcardProgress.next_review`, `interval_days`, `ease_factor`, or `repetition_number`.
3. **Manual Independence**: Manual reminders are completely independent of SM-2 spaced repetition schedules.
4. **No Architectural Duplication**: The system strictly forbids creating:
   - another SM-2 algorithm
   - another mastery calculation system
   - another revision scheduling engine
   - another reminder architecture
   - another notification center
   - another `FlashcardProgress` table
   - another learning-event logging system

---

## 4. VERIFICATION RECORD

All verification gates were empirically executed and confirmed:

- **Full Backend Regression**: **695 / 695 PASSED** (`pytest Backend -v -m "not slow"`, 0 failed, 0 skipped, 0 errors, duration 210.85s).
- **Dedicated Notification Suite**: **28 / 28 PASSED** (`pytest Backend/test_revision_notifications.py -v`, 0 failed, 0 errors, duration 13.33s).
- **Frontend Production Build**: **PASSED** (`vite build`, 3,325 modules transformed, 0 errors, duration 32.85s).
- **Lint & Whitespace Check**: **PASSED** (`git diff --check`, exit code 0, 0 errors).
- **Database Integrity**:
  - `Backend/florix.db`: `PRAGMA integrity_check` = `ok`.
  - `Backend/florix.db`: `PRAGMA foreign_key_check` = `[]` (0 violations).
- **Database Data Preservation**: Zero database records were modified or deleted during cleanup.
- **Runtime DB Distinction**: `Backend/florix.db` (23.9 MB) is the authoritative production/dev database; root `florix.db` (4.1 MB) is classified as a legacy test artifact and left untouched.

---

## 5. DOCUMENTED KNOWN LIMITATIONS

1. **Phase 5 Standalone Test Rate Limit Dependency**: When `pytest Backend/test_visual_learning.py` is executed standalone without mocking external LLM calls, 2 of 17 tests call the live Google Gemini API and hit the free-tier daily rate limit (20 req/day). When run within the full test suite, all 17 tests pass.
2. **Root SQLite Legacy Test Rows**: The root-level legacy test file `florix.db` contains 2 orphan rows in `document_chunks` (IDs 7 and 53) from previous test runs. They have no impact on the production runtime database at `Backend/florix.db` and are preserved untouched.
3. **Accessibility**: Complex interactive SVG visual elements in Phase 5 rely on the semantic inspector drawer as the primary accessibility and keyboard fallback.
4. **Video Timestamps**: Video timestamp citations display temporal location metadata but do not seek a separate external player.

---

## 6. FINAL LOCK CONFIRMATION

```text
REVISION NOTIFICATION & REMINDER INFRASTRUCTURE = LOCKED
```

No further code modifications, feature enhancements, or refactors are permitted on this capability. Any future work requires explicit authorization.
