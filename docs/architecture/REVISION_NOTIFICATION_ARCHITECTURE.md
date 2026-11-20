# FLORIX AI — REVISION NOTIFICATION & REMINDER INFRASTRUCTURE
## ARCHITECTURAL SPECIFICATION & VERIFICATION RECORD

**Status:** IMPLEMENTED & VERIFIED  
**Phase:** Revision Notification & Reminder Infrastructure (Post-Phase 5)  
**Parent System:** Florix AI — Intelligent Multi-Modal Academic Workspace  

---

## 1. MISSION & SCOPE

Florix AI natively schedules learning retention using the SM-2 algorithm (`FlashcardProgress.next_review`, `LearnerTopicMastery`). Prior to this phase, Florix computed *when* a student should revise, but lacked a proactive notification and reminder layer to bring learners back to their revision tasks.

This infrastructure establishes a high-reliability notification and reminder subsystem that:
1. **Bridges Automatic SM-2 Reviews**: Automatically monitors spaced repetition review dates and alerts students when flashcards or topics are due for review.
2. **Supports Explicit Manual Reminders**: Empowers learners to schedule one-off or recurring revision sessions for study materials, sessions, flashcards, quizzes, and visual concept maps.
3. **Preserves Learning Engine Invariants**: Strictly decouples notification scheduling (snoozing, dismissal) from SM-2 memory intervals, ease factors, and card progress history.

---

## 2. CORE ARCHITECTURAL INVARIANTS

1. **Single Source of Truth for SM-2 Spaced Repetition**:
   - Spaced repetition math resides exclusively in Florix's existing SM-2 engine.
   - No secondary spaced repetition algorithms or competing review tables were created.
2. **Notification Snooze vs. Learning Interval Decoupling**:
   - Snoozing a reminder modifies *only* `Reminder.snoozed_until`.
   - Snoozing **never** mutates `FlashcardProgress.next_review`, `interval_days`, `ease_factor`, or `repetition_number`.
3. **Idempotent Automatic Synchronization**:
   - `NotificationService.sync_sm2_revisions(user_id)` scans for due flashcards (`next_review <= now()`) and groups them by session.
   - Existing active reminders for a session are updated rather than duplicated.
4. **Strict Multi-Tenant Isolation**:
   - All reminder queries enforce `user_id == current_user.id`.
   - Accessing, modifying, snoozing, or deleting another user's reminders returns HTTP 404 (preventing IDOR information leakage).
5. **Cascading Deletion Integrity**:
   - Deleting a `User` or `StudySession` automatically cascades to all associated reminders (`cascade="all, delete-orphan"`).

---

## 3. DATABASE SCHEMA & MODELS

### 3.1 `reminders` Table
```sql
CREATE TABLE reminders (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(36) REFERENCES study_sessions(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    reminder_type VARCHAR(32) NOT NULL, -- 'automatic_revision' | 'manual'
    target_type VARCHAR(64) NOT NULL,   -- 'session' | 'flashcard' | 'quiz' | 'concept_map'
    target_reference VARCHAR(255),
    scheduled_at DATETIME NOT NULL,
    snoozed_until DATETIME,
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending' | 'due' | 'snoozed' | 'completed' | 'dismissed'
    recurrence VARCHAR(32) NOT NULL DEFAULT 'none', -- 'none' | 'daily' | 'weekly'
    is_read BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
CREATE INDEX ix_reminders_user_id ON reminders (user_id);
CREATE INDEX ix_reminders_status ON reminders (status);
CREATE INDEX ix_reminders_scheduled_at ON reminders (scheduled_at);
```

### 3.2 `notification_preferences` Table
```sql
CREATE TABLE notification_preferences (
    user_id VARCHAR(36) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    browser_notifications_enabled BOOLEAN NOT NULL DEFAULT 1,
    sm2_auto_reminders BOOLEAN NOT NULL DEFAULT 1,
    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT 0,
    quiet_hours_start VARCHAR(5) DEFAULT '22:00',
    quiet_hours_end VARCHAR(5) DEFAULT '08:00'
);
```

---

## 4. REST API ENDPOINTS

All endpoints are registered under the tag `Notifications & Reminders` with JWT bearer authentication:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/notifications` | Fetch unified notification feed (`due_now`, `upcoming`, `history`, `unread_count`, `in_quiet_hours`) |
| `POST` | `/notifications/sync-revisions` | Trigger idempotent synchronization of due SM-2 flashcard reviews |
| `POST` | `/notifications/read-all` | Mark all user notifications as read |
| `POST` | `/notifications/{id}/read` | Mark single notification as read |
| `GET` | `/reminders` | List user reminders with optional filters (`status`, `reminder_type`, `limit`) |
| `POST` | `/reminders` | Create manual reminder (supports `once`, `daily`, `weekly` recurrence) |
| `GET` | `/reminders/{id}` | Retrieve specific reminder (enforces tenant isolation) |
| `PUT` | `/reminders/{id}` | Update title, message, or scheduled time |
| `DELETE` | `/reminders/{id}` | Delete reminder |
| `POST` | `/reminders/{id}/snooze` | Snooze reminder by relative minutes or absolute ISO datetime |
| `POST` | `/reminders/{id}/complete` | Mark reminder complete (spawns next recurrence if daily/weekly) |
| `POST` | `/reminders/{id}/dismiss` | Dismiss reminder from active feeds |
| `GET` | `/user/notification-settings` | Fetch user notification & quiet hours preferences |
| `PUT` | `/user/notification-settings` | Update browser alert, SM-2 toggle, and quiet hours schedule |

---

## 5. FRONTEND INTEGRATION

### 5.1 Components Added
- **`NotificationCenter.jsx`**:
  - Interactive top-navbar popover dropdown.
  - Three distinct feed tabs: **Due Now**, **Upcoming**, and **History**.
  - Quick action controls: Direct Session/Flashcard navigation, Snooze (+30m, +1h, +1d), Complete, and Dismiss.
  - Manual reminder creation modal with 1-click presets ("Tonight 8 PM", "Tomorrow 9 AM", "In 3 Days", "In 1 Week").
  - Preferences modal for quiet hours and auto-sync toggles.
- **`browserNotifications.js`**:
  - Native Web Notification API bridge with safety fallbacks.
  - Permission negotiation and desktop notification dispatching.

### 5.2 Existing UI Augmentation
- **`Dashboard.jsx`**: Integrated `NotificationCenter` bell icon with real-time unread badge into the primary application header.
- **`StudySession.jsx`**: Added "Remind" revision button to the session toolbar, pre-filling manual reminder targets for the current study material.

---

## 6. VERIFICATION & QUALITY AUDIT

- **Dedicated Unit & Integration Suite**:
  - `Backend/test_revision_notifications.py`: **28 / 28 PASSED** (100%).
  - Tests verify: SM-2 auto-sync idempotency, manual CRUD, recurrence generation, snooze/SM-2 separation, multi-tenant IDOR protection, quiet hours (daytime & overnight), and cascading foreign-key deletion.
- **Database Integrity**:
  - `PRAGMA integrity_check`: **`ok`**.
- **Frontend Production Build**:
  - `vite build`: **SUCCESS** (0 errors, 0 warnings).
