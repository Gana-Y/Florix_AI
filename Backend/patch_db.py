import sqlite3
import os

db_path = "florix.db"
if not os.path.exists(db_path):
    print("Error: Database file not found.")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get existing columns in users table
cursor.execute("PRAGMA table_info(users);")
columns = [row[1] for row in cursor.fetchall()]
print("Current columns in 'users':", columns)

# Add plan column if it doesn't exist
if "plan" not in columns:
    print("Adding 'plan' column...")
    cursor.execute("ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free';")
    conn.commit()
else:
    print("'plan' column already exists.")

# Add plan_expires_at column if it doesn't exist
if "plan_expires_at" not in columns:
    print("Adding 'plan_expires_at' column...")
    cursor.execute("ALTER TABLE users ADD COLUMN plan_expires_at TIMESTAMP;")
    conn.commit()
else:
    print("'plan_expires_at' column already exists.")

# Add created_at column if it doesn't exist
if "created_at" not in columns:
    print("Adding 'created_at' column...")
    cursor.execute("ALTER TABLE users ADD COLUMN created_at TIMESTAMP;")
    conn.commit()
    
    print("Populating existing rows with current time...")
    cursor.execute("UPDATE users SET created_at = datetime('now') WHERE created_at IS NULL;")
    conn.commit()
else:
    print("'created_at' column already exists.")

# Verify study_sessions columns
cursor.execute("PRAGMA table_info(study_sessions);")
session_cols = [row[1] for row in cursor.fetchall()]
print("Current columns in 'study_sessions':", session_cols)

if "source_type" not in session_cols:
    print("Adding 'source_type' column to study_sessions...")
    cursor.execute("ALTER TABLE study_sessions ADD COLUMN source_type VARCHAR DEFAULT 'pdf';")
    conn.commit()
else:
    print("'source_type' column already exists.")

if "share_type" not in session_cols:
    print("Adding 'share_type' column to study_sessions...")
    cursor.execute("ALTER TABLE study_sessions ADD COLUMN share_type VARCHAR DEFAULT 'public';")
    conn.commit()
else:
    print("'share_type' column already exists.")

# Add is_admin column if it doesn't exist
if "is_admin" not in columns:
    print("Adding 'is_admin' column...")
    cursor.execute("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0;")
    conn.commit()
    
    # Make ganesh1@gmail.com admin
    cursor.execute("UPDATE users SET is_admin = 1 WHERE email = 'ganesh1@gmail.com';")
    conn.commit()
else:
    print("'is_admin' column already exists.")

# Create payment_submissions table if it doesn't exist
print("Verifying 'payment_submissions' table...")
cursor.execute("""
CREATE TABLE IF NOT EXISTS payment_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan TEXT NOT NULL,
    amount INTEGER NOT NULL,
    payment_method TEXT NOT NULL,
    transaction_id TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
""")
conn.commit()

# Phase 2 — Academic RAG Engine Migrations
print("Checking Phase 2 RAG columns...")
cursor.execute("PRAGMA table_info(study_sessions);")
sess_cols = [row[1] for row in cursor.fetchall()]
for col_name, col_def in [
    ("processing_status", "VARCHAR DEFAULT 'READY'"),
    ("processing_error", "TEXT"),
    ("page_count", "INTEGER DEFAULT 1"),
    ("char_count", "INTEGER DEFAULT 0"),
    ("doc_metadata", "TEXT DEFAULT '{}'")
]:
    if col_name not in sess_cols:
        print(f"Adding '{col_name}' to study_sessions...")
        cursor.execute(f"ALTER TABLE study_sessions ADD COLUMN {col_name} {col_def};")
        conn.commit()

cursor.execute("PRAGMA table_info(document_chunks);")
chunk_cols = [row[1] for row in cursor.fetchall()]
for col_name, col_def in [
    ("page_number", "INTEGER DEFAULT 1"),
    ("section_heading", "VARCHAR"),
    ("content_type", "VARCHAR DEFAULT 'text'"),
    ("chunk_metadata", "TEXT DEFAULT '{}'")
]:
    if col_name not in chunk_cols:
        print(f"Adding '{col_name}' to document_chunks...")
        cursor.execute(f"ALTER TABLE document_chunks ADD COLUMN {col_name} {col_def};")
        conn.commit()

print("SUCCESS: Schema patch verification complete!")
conn.close()

