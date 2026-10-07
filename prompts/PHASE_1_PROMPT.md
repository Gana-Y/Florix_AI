PHASE 1 — FLORIX AI V2
CODEBASE RECONNAISSANCE, ARCHITECTURE AUDIT & SAFETY BASELINE

ROLE
You are acting as a Senior Staff Software Engineer, Product Architect,
AI Engineer, Full-Stack Engineer, UX Systems Engineer, Security Engineer,
and Codebase Maintainer.

You are working on an existing production-style academic AI application
called:

FLORIX AI

Do NOT treat this as a greenfield project.

This is an existing project that has been developed over approximately
9 months. The existing frontend, backend, database structure, UI,
components, routes, authentication, AI functionality, and user workflows
represent significant existing work.

Your primary responsibility in this phase is:

UNDERSTAND FIRST.
PRESERVE SECOND.
IMPROVE THIRD.

Do NOT rewrite the application.
Do NOT redesign the UI.
Do NOT replace working architecture merely because you personally prefer
another approach.

============================================================
1. PRODUCT CONTEXT
============================================================

Florix AI is an:

"Intelligent Multi-Modal Academic Workspace & AI-Powered Personalized
Study Companion."

Its purpose is not to become another generic ChatGPT clone.

Florix is intended to become an academic learning workspace where a
student can:

INPUT
→ understand
→ ask questions
→ visualize
→ practice
→ receive feedback
→ remember
→ measure mastery
→ receive personalized next steps.

Existing supported academic inputs include:

- PDF
- images/files where currently supported
- audio
- video
- YouTube/web links
- pasted text
- spoken input

Existing learning functionality includes:

- AI study guide generation
- document-grounded chat
- persistent conversations
- quiz generation
- flashcard generation
- quiz result tracking
- library
- search
- bookmarks
- progress
- history
- personalization
- study workspace
- insights
- timeline
- profile/scholar system
- XP / badges
- subscription plans
- developer API area
- folders

The project currently uses technologies including:

Frontend:
- React
- Vite
- Tailwind CSS
- Framer Motion
- Lucide
- React Markdown
- Axios

Backend:
- FastAPI
- Python
- SQLAlchemy
- JWT authentication
- bcrypt/password hashing
- Gemini API / Google GenAI SDK

Data / AI:
- SQLite during development
- PostgreSQL-ready architecture
- ChromaDB for vector storage / RAG

Existing document processing includes:
- PDF extraction
- web extraction
- YouTube transcript extraction
- audio processing
- Gemini-based processing

============================================================
2. CRITICAL PRESERVATION RULE
============================================================

THE EXISTING UI MUST BE PRESERVED.

This is a NON-NEGOTIABLE requirement.

Do not redesign:

- sidebar
- colors
- typography
- spacing system
- cards
- buttons
- existing navigation
- existing dashboard
- Study Space
- Quiz interface
- Flashcard interface
- Insights interface
- Timeline interface
- Library interface
- Progress interface
- Profile interface
- pricing interface

unless the current phase explicitly requires a change.

Do not change visual design just because you think another design
looks better.

Do not replace existing components with your preferred component library.

Do not replace Tailwind with another CSS framework.

Do not replace React architecture with another framework.

Do not replace FastAPI with another backend framework.

Do not replace ChromaDB or the existing database without a documented
technical reason.

Do not modify working functionality unnecessarily.

If you identify a UI problem, document it in the audit report instead
of automatically redesigning it.

============================================================
3. FIRST ACTION — READ THE ENTIRE CODEBASE
============================================================

Before modifying ANY code:

Inspect the complete repository.

Do not rely on filenames alone.

Read and understand:

- package.json
- frontend source
- backend source
- API routes
- services
- database models
- schemas
- authentication
- AI services
- RAG services
- document processors
- prompts
- utilities
- contexts
- hooks
- routing
- components
- pages
- configuration
- environment handling
- subscription logic
- payment integration
- error handling
- logging
- tests
- scripts

Identify:

- dead code
- duplicate code
- duplicated business logic
- unused components
- unused endpoints
- hard-coded limits
- hard-coded plan checks
- hard-coded UI assumptions
- fragile state management
- race conditions
- missing validation
- security problems
- error-handling problems
- database inconsistencies
- API inconsistencies
- technical debt

Do NOT immediately fix everything.

First understand it.

============================================================
4. CREATE A FRONTEND ARCHITECTURE MAP
============================================================

Determine the actual frontend architecture from the repository.

Produce a map similar to:

src/
├── components/
├── pages/
├── layouts/
├── contexts/
├── hooks/
├── services/
├── utils/
├── assets/
└── ...

Use the ACTUAL project structure.

Do not invent directories.

For every major page, document:

PAGE
→ route
→ component
→ child components
→ API calls
→ state
→ context dependencies
→ authentication requirements
→ plan requirements
→ navigation relationships

Pay special attention to:

- Dashboard/Home
- AI Chat
- New Session
- Library
- Bookmarks
- Progress
- History
- Personalization
- Profile
- Pricing
- Study Space
- Notes
- Quiz
- Flashcards
- Insights
- Timeline

============================================================
5. CREATE A BACKEND ARCHITECTURE MAP
============================================================

Identify:

- FastAPI application entry point
- routers
- services
- dependencies
- authentication
- database layer
- AI layer
- RAG layer
- document ingestion
- quiz generation
- flashcard generation
- conversation handling
- statistics
- subscription handling
- payment handling

For each major endpoint document:

METHOD
PATH
AUTH
INPUT
OUTPUT
DATABASE EFFECT
AI CALL
ERROR HANDLING
PLAN RESTRICTION

Use the actual endpoints discovered in the repository.

Do not invent endpoints.

============================================================
6. CREATE A DATABASE MAP
============================================================

Inspect all SQLAlchemy models and migrations/schema definitions.

Produce the REAL database relationship diagram.

Example format:

users
  │
  ├── study_sessions
  │       ├── quiz_data
  │       ├── flashcards
  │       └── scores
  │
  ├── quiz_results
  │
  ├── activities
  │
  └── conversations
          └── messages

But replace this example with the actual schema discovered.

Document:

- primary keys
- foreign keys
- indexes
- relationships
- nullable fields
- JSON fields
- cascade behavior
- timestamps
- subscription fields
- usage fields if they already exist

Identify schema problems that may become blockers for future phases.

Do NOT perform a destructive migration in Phase 1.

============================================================
7. MAP THE CURRENT AI PIPELINE
============================================================

Trace the actual flow.

For document ingestion:

USER
 ↓
UPLOAD
 ↓
VALIDATION
 ↓
EXTRACTION
 ↓
PROCESSING
 ↓
CHUNKING
 ↓
EMBEDDING
 ↓
VECTOR STORAGE
 ↓
RETRIEVAL
 ↓
LLM
 ↓
RESPONSE

Determine which stages actually exist.

Do not assume the architecture is exactly as documented.

Identify:

- where documents are parsed
- where text is stored
- where chunks are created
- where embeddings are created
- where ChromaDB is used
- where retrieval occurs
- how many chunks are retrieved
- whether reranking exists
- whether metadata filtering exists
- whether citations exist
- how context is assembled
- how prompts are built
- how Gemini is called
- how conversation context is handled

Also identify whether the current implementation still has the
approximately 15,000-character limitation or whether this has already
been changed.

Do not fix the RAG architecture in this phase unless a tiny safe bug fix
is required.

Document it for Phase 2.

============================================================
8. MAP THE PLAN / SUBSCRIPTION SYSTEM
============================================================

Inspect the actual implementation of:

FREE
PRO
PREMIUM

Determine:

- where plan type is stored
- where limits are stored
- where limits are checked
- whether limits are enforced frontend-side
- whether limits are enforced backend-side
- whether both are used
- whether users can bypass frontend restrictions
- how Razorpay/payment status is handled
- how expired subscriptions behave
- how cancelled subscriptions behave
- how failed payments behave
- how upgrades/downgrades behave

IMPORTANT:

A frontend-only plan restriction is NOT considered secure.

The backend must eventually be the source of truth for entitlements.

Do not redesign the subscription system in Phase 1.

Audit it.

============================================================
9. AUDIT THE CURRENT UI/UX
============================================================

Inspect the actual existing UI and compare it against the intended
product direction.

DO NOT redesign it.

Instead categorize findings as:

KEEP
IMPROVE LATER
MERGE LATER
REMOVE LATER
UNKNOWN / NEEDS PRODUCT DECISION

Pay particular attention to duplicated concepts such as:

- New Session appearing in multiple places
- Search
- My Library
- Bookmarks
- History
- Personalization
- Profile
- Study Space outputs

Do not change them yet.

Create recommendations for later phases.

============================================================
10. IDENTIFY EXISTING TECHNICAL LIMITATIONS
============================================================

Create a prioritized list.

Classify each issue as:

P0 = blocks future development
P1 = important architectural issue
P2 = important but can wait
P3 = cosmetic / low priority

Look specifically for:

- RAG limitations
- context limitations
- synchronous AI calls
- missing streaming
- missing background processing
- weak error handling
- missing retries
- missing rate limiting
- missing usage enforcement
- missing observability
- database scalability issues
- race conditions
- insecure API exposure
- secrets handling
- oversized uploads
- malicious files
- prompt injection through uploaded documents
- SSRF risks from URL ingestion
- YouTube/web scraping failures
- malformed AI JSON
- AI hallucination handling
- duplicate generation requests
- concurrent requests
- subscription bypasses
- quota bypasses

Do not automatically fix all of these.

Identify and prioritize them.

============================================================
11. EDGE CASE AUDIT
============================================================

Think like a senior production engineer.

Analyze at minimum:

A. FILES

- empty PDF
- corrupted PDF
- password-protected PDF
- scanned PDF
- huge PDF
- PDF with images
- PDF with tables
- PDF with malformed text
- duplicate upload
- same file uploaded repeatedly
- unsupported extension
- oversized file

B. AI

- Gemini timeout
- Gemini rate limit
- invalid JSON
- partial response
- empty response
- hallucinated answer
- prompt injection inside document
- very long context
- concurrent requests

C. USERS

- expired subscription
- cancelled subscription
- payment failure
- upgrade during active session
- downgrade
- quota exhausted
- simultaneous tabs
- deleted document referenced by chat
- deleted user
- stale JWT

D. DATABASE

- orphaned records
- duplicate records
- transaction failures
- concurrent writes
- migration compatibility
- JSON corruption

E. WEB / URL INGESTION

- invalid URL
- inaccessible website
- redirect
- SSRF
- malicious URL
- huge webpage
- dynamic website
- missing YouTube transcript
- private YouTube video

F. UX

- loading state
- empty state
- error state
- retry state
- partial state
- mobile viewport
- slow network
- double-click submission
- browser refresh during generation

============================================================
12. ESTABLISH A "DO NOT BREAK" CONTRACT
============================================================

Create a document named something similar to:

FLORIX_ARCHITECTURE_CONTRACT.md

The exact location should follow the existing project conventions.

This document must contain:

A. Existing stack
B. Existing routes
C. Existing components
D. Existing database models
E. Existing APIs
F. Existing AI pipeline
G. Existing UI design rules
H. Existing functionality
I. Known technical debt
J. Planned future architecture
K. Explicit forbidden changes

Include a section:

"UI PRESERVATION RULES"

Example:

- Do not replace existing visual language.
- Do not rewrite pages unnecessarily.
- Reuse existing components.
- Extend existing layouts.
- Preserve existing responsive behavior.
- Preserve existing navigation unless an approved phase changes it.
- Preserve existing user workflows.
- Do not remove functionality without explicit approval.

============================================================
13. CREATE A FEATURE INTEGRATION MAP
============================================================

Do NOT implement the following features yet.

Instead determine where each future feature should eventually live.

Future systems include:

1. Visual Learning / Napkin-inspired visual generation
2. Concept Graph
3. Mastery Engine
4. Spaced Repetition
5. Adaptive Quizzes
6. Viva Mode
7. Mock Exam
8. Check My Work
9. Coding Tutor
10. Math Verification
11. Lecture Intelligence
12. AI Study Planner
13. "What Should I Study Next?"
14. Advanced Analytics
15. Learning Timeline improvements

For every future feature identify:

- likely frontend location
- likely backend service
- required database changes
- required APIs
- required AI capabilities
- dependencies on earlier phases
- possible plan entitlement
- possible usage/credit cost
- risks

Again:

DO NOT IMPLEMENT THESE FEATURES IN PHASE 1.

============================================================
14. ARCHITECTURAL PRINCIPLE
============================================================

Florix should evolve toward:

                    FLORIX AI
                        │
       ┌────────────────┼────────────────┐
       ↓                ↓                ↓
   UNDERSTAND        PRACTICE          MASTER
       │                │                │
       ↓                ↓                ↓
   AI Tutor           Quiz            Mastery
   Study Guide        Viva            Analytics
   Notes              Exam            Knowledge Graph
   Visualize          Coding          Spaced Recall
   Concept Map        Math
       │                │
       └────────────────┼────────────────┘
                        ↓
                 KNOWLEDGE BASE
                        │
          PDF / Audio / Video / Web

<ADDITIONAL_METADATA>
The current local time is: 2026-09-16T21:47:25+05:30.
</ADDITIONAL_METADATA>