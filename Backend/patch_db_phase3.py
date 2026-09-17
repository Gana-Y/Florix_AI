# Phase 3 Database Migration Patch
# Ensures learner_topic_mastery and learning_events tables exist.
# Non-destructive and idempotent.

import sqlite3
from database import engine, Base, init_db

def run_phase3_migration():
    print("[PHASE 3 MIGRATION] Verifying and applying schema additions...")
    init_db()
    with engine.connect() as conn:
        from sqlalchemy import text
        res = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('learner_topic_mastery', 'learning_events')")).fetchall()
        names = [r[0] for r in res]
        assert "learner_topic_mastery" in names, "Missing learner_topic_mastery table"
        assert "learning_events" in names, "Missing learning_events table"
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_learner_mastery_user_session_topic ON learner_topic_mastery (user_id, session_id, topic)"))
        conn.commit()
    print("[PHASE 3 MIGRATION] Schema migration completed successfully.")

if __name__ == "__main__":
    run_phase3_migration()
