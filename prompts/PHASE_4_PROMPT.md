FLORIX AI V2 — PHASE 4
MULTIMODAL KNOWLEDGE ENGINE & LEARNING EXPERIENCE

============================================================
MISSION
============================================================

Phase 1, Phase 2, and Phase 3 are LOCKED.

Phase 1:
Stable application foundation.

Phase 2:
Production-grade Knowledge Engine / Academic RAG.

Phase 3:
Intelligent Learning Engine & Adaptive Study System.

Phase 3 has been verified and Git-checkpointed.

You are now authorized to implement ONLY PHASE 4.

PHASE 4 GOAL:

Extend Florix AI from a document-centric academic assistant into a
multimodal academic knowledge system capable of consistently processing,
indexing, retrieving, grounding, and learning from supported educational
content types while preserving the existing Phase 2 RAG and Phase 3
Intelligence architecture.

The goal is NOT to create another RAG system.

The goal is NOT to redesign the application.

The goal is NOT to turn Florix into an autonomous coding agent.

The goal is to make the existing Knowledge Engine understand more forms
of educational content through a unified ingestion → normalization →
chunking → indexing → retrieval → intelligence pipeline.

============================================================
ABSOLUTE RULES
============================================================

1. DO NOT start Phase 5.

2. DO NOT modify Phase 1 architecture unnecessarily.

3. DO NOT replace Phase 2 RAG.

4. DO NOT replace Phase 3 Intelligence.

5. DO NOT create a second RAG pipeline.

6. DO NOT create a second Chroma collection unless the existing
   architecture proves a separate collection is technically required.
   Prefer the existing collection and metadata extensions.

7. DO NOT introduce a second embedding model if the existing embedding
   infrastructure can support the new content.

8. DO NOT create a second chunking system that duplicates Phase 2.

9. DO NOT duplicate learner/mastery logic from Phase 3.

10. DO NOT create a competing spaced-repetition system.

11. DO NOT redesign the frontend.

12. DO NOT change existing colors, layouts, navigation, typography,
    components, or visual identity.

13. DO NOT rename existing APIs merely for cleanliness.

14. DO NOT perform unrelated refactoring.

15. DO NOT delete existing database tables or existing user data.

16. DO NOT silently change existing API response contracts.

17. Every new feature must preserve multi-tenant isolation.

18. Every generated educational claim must remain grounded in retrieved
    evidence whenever evidence is required.

19. Inspect the real repository before making architectural decisions.

20. If an existing implementation already solves part of a Phase 4
    requirement, EXTEND it instead of rebuilding it.

21. Prefer additive changes.

22. Keep the system backward compatible.

23. Run tests continuously.

24. At the end of Phase 4, STOP.

============================================================
STEP 0 — REPOSITORY RECONNAISSANCE
============================================================

Before changing anything, inspect the actual repository.

Inspect:

Backend/
Frontend/
Backend/rag/
Backend/intelligence/
database models
API routes
upload pipeline
document processing pipeline
ChromaDB integration
DocumentChunk model
StudySession model
FlashcardProgress
LearnerTopicMastery
LearningEvent
chat endpoints
streaming endpoints
frontend upload components
frontend study-session components
frontend library components
existing file/audio/video handling
existing dependencies
environment configuration
tests
documentation
architecture contracts

Determine exactly which content types are already supported.

Do not assume the implementation matches documentation.

Produce a short internal architecture map before implementation.

You must identify:

CURRENT INPUT
    ↓
CURRENT PARSER
    ↓
CURRENT NORMALIZATION
    ↓
CURRENT CHUNKER
    ↓
CURRENT EMBEDDING
    ↓
CURRENT VECTOR STORAGE
    ↓
CURRENT RETRIEVAL
    ↓
PHASE 3 INTELLIGENCE
    ↓
FRONTEND

Then identify the smallest extension points required for Phase 4.

============================================================
PHASE 4 TARGET ARCHITECTURE
============================================================

The intended architecture is:

                    USER
                      │
                      ▼
                CONTENT UPLOAD
                      │
        ┌─────────────┼──────────────┐
        │             │              │
        ▼             ▼              ▼
      PDF           TEXT          MEDIA
        │             │          AUDIO/VIDEO
        │             │              │
        └─────────────┼──────────────┘
                      ▼
             CONTENT NORMALIZER
                      │
                      ▼
              STRUCTURED CONTENT
                      │
                      ▼
              PHASE 2 CHUNKER
                      │
                      ▼
             EXISTING EMBEDDING
                      │
                      ▼
              EXISTING CHROMA
                      │
                      ▼
             HYBRID RETRIEVAL
                      │
                      ▼
              PHASE 3 INTELLIGENCE
                      │
        ┌─────────────┼──────────────┐
        ▼             ▼              ▼
      CHAT           QUIZ         FLASHCARDS
        │             │              │
        └─────────────┼──────────────┘
                      ▼
             GROUNDED RESPONSE

IMPORTANT:

The existing Phase 2 retrieval system remains the central evidence
foundation.

Phase 4 extends CONTENT REPRESENTATION, not the fundamental retrieval
architecture.

============================================================
1. UNIFIED CONTENT MODEL
============================================================

Create or extend a unified representation for educational content.

The system should be able to distinguish content such as:

- PDF/document
- plain text
- transcript
- audio-derived transcript
- video-derived transcript
- code/text educational material
- structured notes where supported

Do not create unnecessary independent database models.

Prefer a normalized metadata representation compatible with the existing
DocumentChunk model.

Useful metadata may include:

- content_type
- source_type
- page_number
- timestamp_start
- timestamp_end
- section
- chapter
- heading
- speaker where available
- language where available
- source_filename
- source_document_id
- chunk_id
- user_id
- session_id

Only add metadata that is actually useful.

Preserve existing metadata fields.

============================================================
2. CONTENT NORMALIZATION LAYER
============================================================

Create a clean normalization layer if one does not already exist.

Potential structure:

Backend/content/
    __init__.py
    models.py
    normalizer.py
    metadata.py
    parsers/
        ...
    processors/
        ...

But FIRST inspect the existing architecture.

Do not blindly create this structure if equivalent functionality already
exists.

The normalizer should convert supported source material into a common
internal representation such as:

NormalizedContent:
    content
    content_type
    source_metadata
    structural_metadata
    location_metadata

The normalized representation must remain compatible with the existing
Phase 2 chunking/indexing pipeline.

============================================================
3. PDF / DOCUMENT REGRESSION
============================================================

Do not break existing PDF processing.

Verify:

PDF
 ↓
parser
 ↓
structured content
 ↓
Phase 2 chunking
 ↓
embedding
 ↓
Chroma
 ↓
retrieval

still works.

Existing academic documents must continue producing valid chunks.

Existing page numbers and citations must remain correct.

============================================================
4. AUDIO PROCESSING
============================================================

If audio processing does not already exist, implement a modular audio
processing path.

The intended conceptual flow is:

Audio
 ↓
transcription
 ↓
timestamped transcript
 ↓
normalization
 ↓
Phase 2 chunking
 ↓
embedding
 ↓
Chroma

Do not hard-code a single external transcription provider if the
architecture can cleanly abstract it.

Create a provider interface where appropriate.

For example:

TranscriptionProvider
    ↓
transcribe(audio)
    ↓
Transcript

The implementation may use the project's existing supported provider
if one already exists.

DO NOT invent API keys or credentials.

If the environment does not contain credentials, implement the provider
abstraction and deterministic/mock tests without claiming live
transcription was verified.

Transcript chunks should retain timestamp information when available.

Example:

[00:12:31 - 00:13:04]

This metadata must be traceable back to the source.

============================================================
5. VIDEO PROCESSING
============================================================

If video processing does not already exist, extend the content pipeline
to support video educational material.

Preferred conceptual flow:

Video
 ├── audio track
 │      ↓
 │   transcription
 │      ↓
 │   transcript
 │
 └── metadata
        ↓
  normalized content
        ↓
  Phase 2 chunking
        ↓
  embedding
        ↓
  Chroma

Do NOT implement expensive video frame/image understanding unless the
existing project already has an appropriate vision architecture and
Phase 4 genuinely requires it.

For this phase, prioritize:

VIDEO → AUDIO → TRANSCRIPT → KNOWLEDGE

rather than building a completely separate vision system.

Preserve timestamp references.

============================================================
6. TRANSCRIPT QUALITY
============================================================

Educational transcripts can be noisy.

Implement lightweight normalization where appropriate:

- whitespace normalization
- repeated token cleanup
- obvious transcription artifact handling
- paragraph segmentation
- timestamp preservation

Do NOT aggressively rewrite source content.

The source transcript must remain traceable.

Never silently transform technical terminology into unrelated terminology.

============================================================
7. MULTILINGUAL SAFETY
============================================================

Inspect the existing application for language assumptions.

Do not force English-only processing where the current stack can safely
handle other languages.

Store language metadata if it can be determined reliably.

Do not invent language detection results.

If language detection is introduced, isolate it behind a small interface.

============================================================
8. MULTIMODAL RETRIEVAL METADATA
============================================================

Extend Phase 2 metadata so retrieval results can identify where evidence
came from.

Examples:

PDF:
    page_number = 42

Audio:
    timestamp_start = 732
    timestamp_end = 781

Video:
    timestamp_start = 732
    timestamp_end = 781

Text:
    section/chapter

The existing citation system must continue working.

Do not introduce a completely new citation syntax.

If the existing citation format is:

[1]
[2]

continue using it.

The metadata behind those citations can become richer.

============================================================
9. CITATION TRACEABILITY
============================================================

A citation must be traceable through:

generated answer
    ↓
retrieved candidate
    ↓
DocumentChunk
    ↓
source document
    ↓
location

For media:

generated answer
    ↓
citation
    ↓
chunk
    ↓
transcript
    ↓
timestamp
    ↓
source media

For PDFs:

generated answer
    ↓
citation
    ↓
chunk
    ↓
page
    ↓
source PDF

Implement tests for this traceability.

============================================================
10. CHAT INTEGRATION
============================================================

Do NOT rewrite /chat.

Extend it only where necessary.

Example:

User:
"What did the lecturer say about normalization around 12 minutes?"

Expected conceptual flow:

query
 ↓
Phase 3 intent
 ↓
Phase 2 retrieval
 ↓
timestamp-aware evidence
 ↓
grounded generation
 ↓
citation validation
 ↓
answer

The answer should identify the relevant source location when available.

Do not fabricate timestamps.

If evidence does not contain timestamp metadata, do not invent one.

============================================================
11. QUIZ INTEGRATION
============================================================

Phase 3 grounded quiz generation must continue working.

If the source is a transcript:

quiz question
    ↓
source_chunk_id
    ↓
timestamp

If the source is PDF:

quiz question
    ↓
source_chunk_id
    ↓
page_number

Preserve existing frontend quiz schema.

Do not break:

question
options
answer
explanation

============================================================
12. FLASHCARD INTEGRATION
============================================================

Phase 3 flashcards must continue working with multimodal sources.

A flashcard generated from:

PDF → page citation

Audio → timestamp citation

Video → timestamp citation

Preserve the existing FlashcardProgress and SM-2 architecture.

Do NOT create another spaced-repetition database.

============================================================
13. LEARNER MODEL INTEGRATION
============================================================

Do not duplicate Phase 3 learner logic.

Learning events may include source information when useful.

For example:

event:
    topic = normalization
    source_type = video
    source_location = timestamp

But avoid storing huge source contents inside learning_events.

Store identifiers and compact metadata.

Do not store unnecessary sensitive or private content.

============================================================
14. UPLOAD PIPELINE
============================================================

Inspect the current upload endpoint and frontend upload flow.

Extend only where necessary.

The upload pipeline should support supported content types through one
consistent process:

UPLOAD
 ↓
VALIDATE
 ↓
CREATE PROCESSING RECORD
 ↓
NORMALIZE
 ↓
CHUNK
 ↓
EMBED
 ↓
INDEX
 ↓
READY

Failures must be represented explicitly.

Never mark content READY if indexing failed.

Existing processing status semantics must remain compatible.

============================================================
15. PROCESSING STATUS
============================================================

Verify whether the existing processing status supports:

PENDING
PROCESSING
COMPLETED
FAILED

If already present, reuse it.

If insufficient, extend minimally.

Users should never receive successful search results from content that
has failed ingestion.

============================================================
16. LARGE FILE SAFETY
============================================================

Inspect current upload limits.

Do not arbitrarily remove limits.

Implement safe handling for:

- large PDFs
- long transcripts
- long audio
- long videos

Avoid loading entire massive media files into memory unnecessarily.

Where possible use streaming/file-based processing.

Prevent:

- memory exhaustion
- runaway transcription
- duplicate indexing
- repeated processing loops

============================================================
17. DUPLICATE INGESTION
============================================================

Verify what happens when the same file is uploaded twice.

Do not blindly create duplicate vectors if the architecture can safely
detect duplicates.

Inspect existing document/session semantics before implementing this.

If deduplication already exists, reuse it.

If it does not exist, implement only a safe minimal mechanism.

Never delete existing user data during deduplication.

============================================================
18. SECURITY / MULTI-TENANCY
============================================================

Every new content path must enforce:

user_id
+
session ownership

A user must NEVER retrieve:

- another user's transcript
- another user's audio metadata
- another user's video metadata
- another user's chunks
- another user's citations
- another user's processing state

Add explicit cross-user tests.

Test:

User A uploads content.

User B attempts:

- retrieval
- chat against the content
- quiz generation
- flashcard generation
- metadata access
- processing status access

All must be isolated.

============================================================
19. RESOURCE / COST CONTROLS
============================================================

Multimedia processing can be expensive.

Implement sensible protections.

Do not introduce uncontrolled:

- transcription loops
- repeated embedding
- duplicate processing
- huge LLM requests

Reuse Phase 2 retrieval limits.

Reuse Phase 3 generation constraints.

Do not increase model calls unnecessarily.

============================================================
20. FRONTEND
============================================================

ABSOLUTELY NO UI REDESIGN.

Inspect the current upload interface.

If it already supports audio/video, preserve its appearance.

If support is missing, make only the smallest UX addition necessary.

Use the existing:

- buttons
- cards
- modals
- typography
- colors
- spacing
- notification system

Do not redesign the application.

Potential minimal additions:

- supported media indication
- processing status
- transcript availability
- source location indicator

Only implement what is actually needed.

============================================================
21. ERROR UX
============================================================

When media processing fails, the frontend should receive a meaningful
status/error.

Examples:

"Unable to process this audio file."

"Transcription service unavailable."

"Unsupported media format."

Do not expose raw stack traces to users.

============================================================
22. DATABASE
============================================================

Inspect the current schema before adding anything.

Prefer extending existing tables with additive metadata only when
appropriate.

Potential metadata:

content_type
source_type
language
duration
processing_status

Do not add unnecessary tables.

If a new table is genuinely required:

- use foreign keys
- use indexes
- enforce ownership
- preserve existing data
- make migration idempotent
- test migration safety

Before/after database verification must prove:

existing tables preserved
existing rows preserved
new schema valid

============================================================
23. API COMPATIBILITY
============================================================

Existing endpoints must continue to work.

At minimum regression-test:

/upload
/chat
/chat/stream
/generate_quiz
/generate_flashcards

and relevant Phase 3:

/learning/mastery/{session_id}
/learning/weak-topics/{session_id}
/learning/evaluate-answer

If new endpoints are necessary, add them without changing old
contracts unnecessarily.

============================================================
24. TESTING STRATEGY
============================================================

Create focused Phase 4 tests.

Minimum categories:

A. Existing PDF regression

B. Text ingestion

C. Audio normalization/transcript handling

D. Video normalization/transcript handling

E. Metadata preservation

F. Page citation preservation

G. Timestamp citation preservation

H. Citation traceability

I. Multimodal retrieval

J. Quiz grounding

K. Flashcard grounding

L. Chat integration

M. Streaming regression

N. Processing failure

O. Duplicate ingestion

P. Large-content safety

Q. Cross-user isolation

R. API backward compatibility

S. Database migration safety

T. Malformed provider output

U. Missing transcription provider

V. Missing evidence

Do NOT create fake tests that merely assert that functions exist.

Where external providers are unavailable, clearly separate:

UNIT TEST
INTEGRATION TEST
LIVE PROVIDER TEST

Never claim live provider verification if credentials/services were not
available.

============================================================
25. TEST REAL SOURCE TRACEABILITY
============================================================

Create a deterministic test fixture.

Example educational content:

"Normalization reduces redundancy in relational databases."

Create a known source location.

Process it through the actual Phase 4 normalization/chunking path.

Then verify:

query
 ↓
retrieval
 ↓
chunk
 ↓
citation
 ↓
source location

The test must prove actual traceability.

For transcript fixtures:

"At 00:05:20 the lecturer explains functional dependency."

Verify that the resulting evidence retains the timestamp.

============================================================
26. OBSERVABILITY
============================================================

Add useful structured logging around:

- ingestion start
- ingestion completion
- ingestion failure
- content type
- processing duration
- chunk count
- embedding/indexing status

Never log:

- passwords
- API keys
- authentication tokens
- unnecessary full document contents
- unnecessary private user data

Logs should help diagnose ingestion failures without becoming a privacy
problem.

============================================================
27. PERFORMANCE
============================================================

Measure where practical:

- normalization time
- chunking time
- embedding/indexing time
- retrieval time
- total processing time

Do not optimize prematurely.

The goal is to identify obvious regressions.

Do not make claims such as "real-time" unless measured.

============================================================
28. DOCUMENTATION
============================================================

Update/create:

PHASE_4_IMPLEMENTATION_PLAN.md
FLORIX_MULTIMODAL_ARCHITECTURE.md
PHASE_4_VERIFICATION_REPORT.md

Update:

FLORIX_ARCHITECTURE_CONTRACT.md

Documentation must clearly explain:

Phase 4 purpose
supported content types
normalization flow
media processing flow
metadata
citation traceability
security
failure handling
database changes
API changes
frontend changes
testing
limitations

Do not rewrite unrelated documentation.

============================================================
29. FINAL VERIFICATION
============================================================

Run:

1. Full backend pytest suite

2. Phase 4 tests

3. Phase 2 regression tests

4. Phase 3 regression tests

5. Frontend production build

6. Database integrity verification

7. ChromaDB integrity verification

8. If available, minimal browser smoke test

Report:

- total tests
- passed
- failed
- skipped
- warnings
- execution time
- frontend build result
- database result
- ChromaDB result
- browser result

============================================================
30. FINAL QUALITY GATE
============================================================

Phase 4 must NOT be declared complete merely because tests pass.

Verify these architectural invariants:

PHASE 2 RAG
     ↓
still ONE evidence foundation

PHASE 3 INTELLIGENCE
     ↓
still ONE learning intelligence layer

PHASE 4 CONTENT
     ↓
extends input/content representation

There must NOT be:

- duplicate RAG
- duplicate embeddings
- duplicate learner model
- duplicate SM-2
- duplicate citation system
- cross-user leakage
- destructive migrations

============================================================
31. FINAL REPORT
============================================================

Create:

PHASE_4_FINAL_VERIFICATION_REPORT.md

Include:

1. Executive Summary
2. Repository Baseline
3. Architecture Changes
4. Supported Content Types
5. Normalization Layer
6. Audio Processing
7. Video Processing
8. Metadata
9. Chunking/Embedding Integration
10. Retrieval Integration
11. Citation Traceability
12. Chat Integration
13. Quiz Integration
14. Flashcard Integration
15. Learner Integration
16. Upload Pipeline
17. Failure Handling
18. Duplicate Ingestion
19. Security / Multi-Tenancy
20. Database Integrity
21. API Compatibility
22. Frontend Verification
23. Performance
24. Observability
25. Automated Tests
26. Browser Testing
27. Known Issues
28. Limitations
29. Required Fixes
30. Final Acceptance Status

Use an honest status:

VERIFIED

or

VERIFIED WITH LIMITATIONS

or

NOT VERIFIED

Never hide limitations.

============================================================
32. GIT SAFETY
============================================================

DO NOT create the final Git checkpoint automatically unless explicitly
authorized after verification.

After implementation and verification, STOP.

Report the exact:

git status

and list modified/untracked files.

Do NOT commit automatically.

============================================================
33. ABSOLUTE STOP CONDITION
============================================================

PHASE 4 ONLY.

Do not:

- start Phase 5
- add unrelated AI features
- redesign UI
- replace RAG
- replace intelligence engine
- refactor the entire repository
- upgrade dependencies unnecessarily

After completing Phase 4 and generating the final verification report,
STOP and wait for engineering review.

============================================================
SUCCESS CRITERIA
============================================================

Phase 4 is successful only if:

✓ Existing PDF/text workflows remain functional

✓ Supported audio can be normalized into searchable educational
  knowledge when the required provider is available

✓ Supported video can be normalized through transcript processing when
  the required provider is available

✓ Source metadata remains traceable

✓ Page references remain accurate

✓ Timestamp references remain accurate

✓ Phase 2 retrieval remains the single retrieval foundation

✓ Phase 3 intelligence consumes the same evidence layer

✓ Quiz generation remains grounded

✓ Flashcards remain grounded

✓ Chat remains grounded

✓ Streaming remains compatible

✓ Learner model remains intact

✓ SM-2 remains single-source-of-truth

✓ Cross-user isolation is verified

✓ Duplicate ingestion is safely handled

✓ Processing failures are explicit

✓ Existing database data is preserved

✓ Existing API contracts remain compatible

✓ Frontend build succeeds

✓ Tests pass

✓ Limitations are honestly documented

✓ No Phase 5 work is performed

STOP AFTER PHASE 4.

<ADDITIONAL_METADATA>
The current local time is: 2026-09-17T06:53:25+05:30.
</ADDITIONAL_METADATA>