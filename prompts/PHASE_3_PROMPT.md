============================================================
FLORIX AI V2 — PHASE 3
INTELLIGENT LEARNING ENGINE & ADAPTIVE STUDY SYSTEM
============================================================

MISSION:

Build Phase 3 of Florix AI on top of the VERIFIED Phase 2
Knowledge Engine.

The objective is to transform Florix from:

    "AI that answers questions about documents"

into:

    "An intelligent academic learning system that understands
     the user's study material, adapts explanations and practice
     to the learner, and remains grounded in the user's sources."

This is a PRODUCT ENGINEERING PHASE.

Reliability, correctness, maintainability, grounding,
security, backward compatibility, and real user experience
are more important than adding a large number of superficial
features.

============================================================
ABSOLUTE RULES
============================================================

1. DO NOT START PHASE 4.

2. DO NOT redesign the existing Florix UI.

3. DO NOT replace the existing design system.

4. DO NOT change colors, typography, sidebar structure,
   navigation, layouts, cards, spacing, or visual identity
   unless a Phase 3 capability genuinely requires a minimal
   UI addition.

5. DO NOT rewrite the application from scratch.

6. DO NOT replace the Phase 2 RAG architecture.

7. DO NOT create a second RAG pipeline.

8. DO NOT create a second embedding system.

9. DO NOT create a second retrieval system.

10. DO NOT create a second citation system.

11. Phase 3 MUST reuse the existing Backend/rag/ subsystem.

12. DO NOT modify unrelated stable functionality.

13. DO NOT perform destructive database migrations.

14. DO NOT delete existing user data.

15. DO NOT fabricate test results.

16. DO NOT claim "perfect", "zero hallucination", or
    "100% production ready."

17. Every important claim must be backed by implementation
    evidence or tests.

18. If an existing Phase 2 bug directly affects a Phase 3
    feature, fix it carefully and document the fix.

19. If a problem is unrelated to Phase 3, document it instead
    of expanding scope.

20. Preserve existing API contracts whenever possible.

21. If an API contract absolutely must change, maintain
    backward compatibility or provide a compatibility layer.

22. Before modifying anything, inspect the ACTUAL repository.

23. Do not trust documentation blindly.

24. The CODEBASE is the source of truth.

25. Work incrementally.

26. After implementation, run comprehensive verification.

27. Stop after Phase 3.

============================================================
PHASE HISTORY
============================================================

PHASE 1:
Existing Florix application foundation.

PHASE 2:
Verified Knowledge Engine / Academic RAG foundation.

Phase 2 includes:

    Document ingestion
        ↓
    Structural parsing
        ↓
    Academic chunking
        ↓
    Metadata enrichment
        ↓
    Dense retrieval
        +
    Lexical retrieval
        ↓
    RRF hybrid retrieval
        ↓
    Reranking
        ↓
    Context assembly
        ↓
    Grounded generation
        ↓
    Citations
        ↓
    Streaming

Phase 2 was independently verified with limitations.

IMPORTANT:

Phase 3 must BUILD ON THIS SYSTEM.

Do NOT replace it.

============================================================
PHASE 3 CORE VISION
============================================================

Florix should become an intelligent study assistant.

The architecture should move toward:

                         FLORIX AI
                            │
                            ▼
                  ┌─────────────────────┐
                  │ Phase 3 Intelligence│
                  │      Layer          │
                  └──────────┬──────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
    Understanding        Learning           Assessment
       Engine             Engine              Engine
          │                  │                  │
          ▼                  ▼                  ▼
      Intent             Teaching          Questions
      Detection          Strategy          Practice
          │                  │                  │
          └──────────────────┼──────────────────┘
                             ▼
                   Phase 2 Knowledge Engine
                             │
                             ▼
                    Grounded Evidence
                             │
                             ▼
                       Gemini / LLM
                             │
                             ▼
                      Cited Response

============================================================
PHASE 3 PRINCIPLE
============================================================

The Phase 2 RAG engine is the KNOWLEDGE FOUNDATION.

Phase 3 is the INTELLIGENCE LAYER.

Example:

User asks:

    "Teach me normalization."

Phase 3 should:

    1. Understand the learning intent.
    2. Retrieve evidence using Phase 2.
    3. Identify relevant concepts.
    4. Structure the explanation.
    5. Adjust explanation complexity.
    6. Give examples.
    7. Identify likely misconceptions.
    8. Provide practice.
    9. Ground factual claims in retrieved evidence.
   10. Cite the supporting material.

DO NOT create a new retrieval implementation for this.

============================================================
1. REPOSITORY RECONNAISSANCE
============================================================

Before coding:

Inspect:

    Backend/
    Backend/rag/
    Backend/main.py
    Backend/database.py
    Frontend/
    existing API routes
    existing database models
    existing chat implementation
    existing quiz implementation
    existing flashcard implementation
    existing insights implementation
    existing Study Space
    existing Library
    existing streaming implementation
    existing authentication
    existing subscription logic
    existing tests
    FLORIX_ARCHITECTURE_CONTRACT.md
    FLORIX_RAG_ARCHITECTURE.md
    PHASE_2_VERIFICATION_REPORT.md

Determine:

    - what already exists
    - what is actually implemented
    - what is incomplete
    - what Phase 3 can safely reuse
    - what should NOT be touched

Do not assume a feature is missing simply because
the implementation is unfamiliar.

Create:

    PHASE_3_IMPLEMENTATION_PLAN.md

The plan must contain:

    current architecture
    Phase 2 integration points
    Phase 3 modules
    API changes
    database changes
    frontend changes
    testing strategy
    risks
    rollback considerations

============================================================
2. INTELLIGENCE ORCHESTRATION LAYER
============================================================

Create a clean Phase 3 intelligence layer.

Preferred conceptual structure:

Backend/
    intelligence/
        __init__.py
        models.py
        intent.py
        orchestrator.py
        teaching.py
        assessment.py
        study_plan.py
        learner.py
        prompts.py
        validators.py
        memory.py

DO NOT blindly create every file.

Only create modules justified by the actual implementation.

The architecture should separate:

    Intent understanding
    Evidence retrieval
    Teaching strategy
    Assessment generation
    Learner adaptation
    Response validation

============================================================
3. QUERY / LEARNING INTENT ENGINE
============================================================

Build deterministic intent classification where practical.

Examples:

    EXPLAIN
    DEFINE
    SUMMARIZE
    COMPARE
    EXAMPLE
    PROCEDURE
    SOLVE
    DEBUG
    QUIZ
    FLASHCARD
    REVISION
    EXAM_PREPARATION
    DEEP_DIVE
    CLARIFICATION
    OUT_OF_SCOPE

Example:

    "What is 3NF?"
        → DEFINE

    "Explain 3NF like I'm a beginner."
        → EXPLAIN

    "Compare 2NF and 3NF."
        → COMPARE

    "Give me 10 questions on normalization."
        → QUIZ

    "Summarize this chapter."
        → SUMMARIZE

    "Give me exam questions from this topic."
        → EXAM_PREPARATION

Use lightweight deterministic logic first.

Use an LLM classifier only where genuinely useful.

Do not make every request unnecessarily expensive.

============================================================
4. ADAPTIVE TEACHING ENGINE
============================================================

Build a teaching engine that uses Phase 2 evidence.

Possible teaching modes:

    BEGINNER
    INTERMEDIATE
    ADVANCED
    EXAM
    INTERVIEW
    REVISION

The system should adapt structure rather than merely
changing adjectives.

Example BEGINNER:

    Concept
    Simple explanation
    Analogy
    Example
    Common mistake
    Quick check

Example EXAM:

    Definition
    Key points
    Formal explanation
    Example
    Important terminology
    Exam-oriented answer

Example ADVANCED:

    Precise definition
    Underlying mechanism
    Edge cases
    Tradeoffs
    Example
    Deeper implications

All factual document-derived claims must remain grounded
in Phase 2 evidence.

============================================================
5. CONCEPT EXTRACTION
============================================================

Build a concept extraction capability from retrieved
document evidence.

Extract structured concepts where useful:

    concept
    definition
    related concepts
    prerequisites
    examples
    formulas
    code
    misconceptions
    source citations

Example:

    Normalization

        prerequisites:
            Functional Dependency

        related:
            1NF
            2NF
            3NF
            BCNF

        evidence:
            page / section / chunk references

Do NOT invent relationships that aren't supported.

LLM-generated relationships must be treated as hypotheses
unless grounded by evidence.

============================================================
6. EXPLANATION GENERATION
============================================================

Upgrade Florix responses from generic chatbot responses
to structured academic explanations.

Possible structure:

    ## Concept

    ## Simple Explanation

    ## Detailed Explanation

    ## Example

    ## Key Points

    ## Common Mistake

    ## Quick Check

Only include sections appropriate to the user's request.

Do not force the same template onto every question.

Avoid excessive verbosity.

The system should respond naturally.

============================================================
7. GROUNDED ANSWER VALIDATION
============================================================

Create a validation layer after generation.

Pipeline:

    User Query
        ↓
    Phase 3 Intent
        ↓
    Phase 2 Retrieval
        ↓
    Context
        ↓
    Gemini
        ↓
    Generated Answer
        ↓
    Citation Validation
        ↓
    Grounding Validation
        ↓
    Final Response

The validator should check:

    - citations refer to valid retrieved sources
    - citation indices are valid
    - unsupported citation numbers are removed/rejected
    - source references exist
    - answer doesn't claim unsupported document facts
    - no-evidence behavior is preserved

Do not attempt to mathematically guarantee
"zero hallucination."

Use evidence-grounding terminology.

============================================================
8. ANSWER QUALITY / EVIDENCE COVERAGE
============================================================

Extend the existing GroundedResponse where appropriate.

Useful internal metrics may include:

    evidence_count
    citation_count
    citation_coverage
    source_coverage
    grounding_status
    confidence

Do not expose meaningless fake confidence values.

If confidence is implemented, define precisely what it means.

Example:

    HIGH:
        strong evidence overlap + valid citations

    MEDIUM:
        partial evidence

    LOW:
        weak evidence

But do not represent this as mathematical certainty.

============================================================
9. QUIZ INTELLIGENCE
============================================================

Inspect the EXISTING quiz system first.

Do not replace it blindly.

Upgrade it to use Phase 2 evidence.

Quiz generation should support:

    MCQ
    TRUE_FALSE
    SHORT_ANSWER
    CONCEPTUAL
    CODE
    NUMERICAL

Questions must be grounded in uploaded material.

Each generated question should internally retain:

    source chunk(s)
    source document
    page
    section

Answers and explanations should also be grounded.

Avoid questions whose answers aren't supported by
the user's material.

============================================================
10. FLASHCARD INTELLIGENCE
============================================================

Inspect existing flashcards.

Improve generation using retrieved evidence.

Flashcards should support:

    Front
    Back
    Source
    Topic
    Difficulty

Examples:

    Definition cards
    Formula cards
    Concept cards
    Comparison cards
    Code cards
    Exam terminology cards

Do not generate hundreds of low-quality cards.

Prefer useful cards.

============================================================
11. ADAPTIVE DIFFICULTY
============================================================

Introduce a lightweight learner model.

Do NOT build a giant machine-learning recommendation
system in Phase 3.

Track useful signals such as:

    questions attempted
    quiz answers
    correctness
    topics practiced
    difficulty
    repeated mistakes
    revision activity

Possible learner state:

    topic
    mastery_estimate
    questions_attempted
    correct_answers
    last_reviewed
    difficulty_level

Keep this transparent and deterministic.

Avoid sensitive personal profiling.

============================================================
12. MASTERY MODEL
============================================================

Create a simple explainable mastery calculation.

Example conceptually:

    mastery =
        weighted combination of:

        correctness
        recency
        repetition
        difficulty

Do not pretend this is scientifically validated.

Document the formula.

Make it easy to replace later.

Example:

    Topic: Normalization
    Mastery: 0.72
    Attempts: 14
    Correct: 11
    Last reviewed: recent

Use this only to personalize study recommendations.

============================================================
13. WEAK TOPIC DETECTION
============================================================

Use quiz / interaction data to identify weak areas.

Example:

    Database Normalization

        1NF       strong
        2NF       strong
        3NF       weak
        BCNF      weak

Then Florix can recommend:

    "Review 3NF before attempting BCNF."

Recommendations must be based on actual recorded signals.

============================================================
14. SPACED REVISION FOUNDATION
============================================================

Create a clean foundation for spaced revision.

Do not build an overcomplicated scheduler.

Support concepts such as:

    learning
    review
    interval
    difficulty
    next_review

A deterministic scheduling strategy is acceptable.

Document the algorithm.

Do not claim medical/scientific validity.

============================================================
15. STUDY SESSION INTELLIGENCE
============================================================

Improve Study Space behavior where appropriate.

A study session should be able to understand:

    document/topic
    current learning intent
    recent questions
    weak areas
    recent quiz performance
    revision needs

However:

DO NOT expose or leak one user's learning state
to another user.

Every learner-state query MUST be authenticated
and ownership-scoped.

============================================================
16. CONVERSATION-AWARE LEARNING
============================================================

Inspect existing conversation history.

Allow the intelligence layer to use recent conversation
context when useful.

Example:

User:
    "Explain normalization."

Florix:
    explanation

User:
    "I don't understand the second point."

Florix should understand what "second point" refers to.

But:

Do not send unlimited conversation history to Gemini.

Implement bounded context.

Prefer relevant recent turns.

============================================================
17. PROMPT ARCHITECTURE
============================================================

Do NOT destroy Phase 2 prompts.

Extend them carefully.

Prompt hierarchy should conceptually be:

    SYSTEM RULES
        ↓
    SECURITY RULES
        ↓
    LEARNING MODE
        ↓
    GROUNDING RULES
        ↓
    RETRIEVED EVIDENCE
        ↓
    CONVERSATION CONTEXT
        ↓
    USER QUERY

Uploaded document content remains DATA.

It must never become a higher-priority instruction.

Preserve Phase 2 prompt-injection protections.

============================================================
18. SECURITY
============================================================

Phase 3 introduces more user state.

Therefore audit:

    authentication
    authorization
    session ownership
    learner state ownership
    quiz ownership
    flashcard ownership
    conversation ownership
    project ownership
    document ownership

Test:

    User A cannot access User B's:

        study history
        mastery
        quiz results
        flashcards
        learning state
        documents
        citations

Test malicious IDs.

Example:

    User A sends User B's session_id.

Expected:

    reject / not found.

============================================================
19. DATABASE EVOLUTION
============================================================

Only add tables/columns that Phase 3 actually needs.

Prefer normalized structures.

Possible entities:

    learner_topic_state
    learning_events
    review_items

But inspect existing schema first.

Do not duplicate existing tables.

Do not store the same state in multiple places without
a clear reason.

Migration must be:

    additive
    backward compatible
    non-destructive
    testable
    idempotent

Before and after migration:

    inspect schema
    inspect row counts
    verify relationships

Use a test database for destructive experiments.

NEVER destroy real user data.

============================================================
20. API DESIGN
============================================================

Keep existing endpoints working.

If new endpoints are necessary, use clean names.

Examples:

    POST /learning/explain
    POST /learning/quiz
    POST /learning/flashcards
    GET  /learning/mastery
    GET  /learning/recommendations
    POST /learning/review

BUT:

Do not blindly create these exact routes.

First inspect existing APIs.

Reuse existing endpoints if they already provide
the required functionality.

Every new endpoint must have:

    authentication
    authorization
    validation
    error handling
    tests

============================================================
21. FRONTEND INTEGRATION
============================================================

Preserve the existing UI.

Phase 3 should integrate into existing screens.

Possible minimal additions:

    learning mode selector
    difficulty selector
    mastery indicator
    review suggestion
    source citation display
    quiz feedback
    weak-topic indicator

Only add UI elements where they materially improve
existing functionality.

Do NOT redesign the entire application.

Do NOT replace existing components just because a new
component seems cleaner.

Prefer:

    existing component
        +
    small Phase 3 capability

over:

    old component deleted
        ↓
    completely new UI

============================================================
22. CHAT EXPERIENCE
============================================================

Upgrade chat intelligently.

Example:

User:

    "Explain 3NF like I'm preparing for tomorrow's exam."

System should infer:

    intent = EXPLAIN
    mode = EXAM
    evidence = Phase 2 RAG

Then produce a useful response.

Another:

    "Quiz me on this."

System:

    intent = QUIZ

Another:

    "I got question 4 wrong. Explain why."

System should use the quiz context.

All document-derived claims remain grounded.

============================================================
23. RESPONSE SCHEMAS
============================================================

Use strongly typed internal models.

Avoid passing unvalidated arbitrary dictionaries
through the intelligence system.

Validate:

    intent
    difficulty
    generated quiz
    flashcards
    citations
    mastery records
    recommendations

Malformed LLM output must not crash the backend.

Implement safe fallbacks.

============================================================
24. LLM FAILURE HANDLING
============================================================

Reuse Phase 2 resilience mechanisms.

Handle:

    timeout
    rate limit
    transient failure
    malformed structured output
    content filtering
    empty output

Use:

    bounded retries
    exponential backoff
    graceful fallback

Never infinite retry.

Never duplicate database writes because of retries.

============================================================
25. COST CONTROL
============================================================

Do not call Gemini unnecessarily.

Before every LLM call ask:

    Can this be deterministic?

Examples:

    intent detection → deterministic first

    exact source lookup → retrieval

    mastery calculation → deterministic

    duplicate detection → hash

Use LLMs where they provide real value.

Track expensive operations where practical.

============================================================
26. PERFORMANCE
============================================================

Measure:

    intent classification
    retrieval
    reranking
    context building
    generation
    quiz generation
    flashcard generation
    mastery calculation

Do not invent latency numbers.

Use real measurements.

Avoid blocking operations inside async endpoints.

Avoid loading huge conversation histories.

Avoid retrieving unnecessarily large contexts.

============================================================
27. TESTING STRATEGY
============================================================

Create:

    Backend/test_intelligence.py

and additional tests only where needed.

Test at minimum:

    intent classification
    teaching mode selection
    evidence integration
    citation validation
    quiz grounding
    flashcard grounding
    learner state
    mastery calculation
    weak-topic detection
    revision scheduling
    conversation context
    malformed LLM responses
    Gemini failures
    cross-user isolation
    unauthorized IDs
    empty evidence
    out-of-domain questions

============================================================
28. REAL END-TO-END TEST
============================================================

Create a deterministic academic document.

Example:

    Database Normalization

with:

    definitions
    1NF
    2NF
    3NF
    functional dependencies
    formulas
    code
    comparison table

Then test:

    Upload
      ↓
    Phase 2 ingestion
      ↓
    Retrieval
      ↓
    Phase 3 intent
      ↓
    Teaching strategy
      ↓
    Generation
      ↓
    Citation validation
      ↓
    Final answer

Then:

    Quiz generation
      ↓
    Answer
      ↓
    Evaluation
      ↓
    Mastery update
      ↓
    Weak topic detection
      ↓
    Recommendation

Verify the actual database state.

============================================================
29. ADVERSARIAL TESTING
============================================================

Test:

    malicious document instructions
    malicious user IDs
    invalid session IDs
    nonexistent documents
    empty queries
    enormous queries
    malformed quiz requests
    malformed LLM responses
    duplicate requests
    repeated submissions
    unauthorized learner-state requests

The system must fail safely.

============================================================
30. NO-EVIDENCE BEHAVIOR
============================================================

Ask:

    "Explain the Apollo spacecraft propulsion architecture."

when the uploaded document is about normalization.

Expected:

    Florix clearly states that the uploaded material
    does not contain sufficient information.

Do NOT allow Phase 3 teaching templates to accidentally
turn unsupported questions into fabricated answers.

============================================================
31. OBSERVABILITY
============================================================

Add useful structured logging where appropriate.

For a learning request, it should be possible to understand:

    request
    intent
    retrieval count
    evidence count
    generation result
    citation validation
    final status
    latency

DO NOT log:

    passwords
    API keys
    authentication tokens
    sensitive user content unnecessarily

============================================================
32. DOCUMENTATION
============================================================

Create:

    FLORIX_INTELLIGENCE_ARCHITECTURE.md

Document:

    Phase 3 architecture
    intent system
    teaching modes
    evidence flow
    quiz architecture
    flashcard architecture
    learner model
    mastery calculation
    revision strategy
    API contracts
    security model
    failure handling
    testing strategy

Update:

    FLORIX_ARCHITECTURE_CONTRACT.md

Only with behavior actually implemented.

Do not document future features as implemented.

============================================================
33. PHASE 3 ARCHITECTURE DIAGRAM
============================================================

Create a clear architecture diagram similar to:

User
 │
 ▼
Intent Detection
 │
 ├───────────────┐
 ▼               ▼
Learning Mode   Conversation Context
 │               │
 └───────┬───────┘
         ▼
 Phase 2 Knowledge Engine
         │
         ▼
 Evidence + Citations
         │
         ▼
 Teaching / Quiz / Flashcard Engine
         │
         ▼
 Grounding Validator
         │
         ▼
 Final Response
         │
         ▼
 Learner State Update
         │
         ▼
 Mastery / Revision / Recommendations

Ensure the documentation explains the data flow.

============================================================
34. BACKWARD COMPATIBILITY
============================================================

Before declaring completion verify:

    login
    signup
    upload
    chat
    chat streaming
    Study Space
    library
    conversations
    quiz
    flashcards
    insights
    bookmarks
    projects
    subscriptions

Do not claim PASS merely because:

    npm run build

succeeds.

Use:

    PASS
    FAIL
    NOT TESTED

where appropriate.

============================================================
35. FRONTEND REGRESSION
============================================================

Run:

    npm run build

Also perform browser-level testing if the environment
supports it.

At minimum verify:

    upload
    processing
    chat
    streaming
    citations
    quiz
    flashcards
    navigation

If browser automation isn't available, explicitly document:

    "Frontend production build verified;
     browser-level regression testing not performed."

============================================================
36. DATABASE VERIFICATION
============================================================

Before and after Phase 3:

    inspect tables
    inspect schemas
    inspect row counts
    inspect foreign keys
    inspect indexes

Verify:

    existing data preserved
    no accidental duplication
    no broken relationships

============================================================
37. CHROMADB / RAG INTEGRATION VERIFICATION
============================================================

Do not create a new Chroma collection unless required.

Phase 3 must use the existing Phase 2 retrieval infrastructure.

Verify:

    existing collection
    existing metadata
    user isolation
    session isolation
    citation mapping

============================================================
38. CODE QUALITY
============================================================

Audit Phase 3 code for:

    duplicated logic
    giant functions
    circular imports
    unused imports
    dead code
    swallowed exceptions
    hidden global state
    hardcoded secrets
    unsafe SQL
    unsafe file handling
    blocking async code
    unnecessary LLM calls
    unnecessary database queries
    duplicated RAG logic

Keep architecture clean.

============================================================
39. FINAL ACCEPTANCE TEST
============================================================

Phase 3 cannot be declared complete merely because
the code compiles.

The following must be demonstrated:

    Phase 2 RAG still works
             +
    Phase 3 intelligence works
             +
    citations remain valid
             +
    user isolation works
             +
    quiz works
             +
    flashcards work
             +
    learner state works
             +
    failure handling works
             +
    existing application behavior remains intact

============================================================
40. FINAL VERIFICATION REPORT
============================================================

Create:

    PHASE_3_VERIFICATION_REPORT.md

Structure:

    # Phase 3 Verification Report

    ## 1. Executive Summary

    ## 2. Phase 3 Architecture

    ## 3. Implemented Capabilities

    ## 4. Phase 2 Integration Verification

    ## 5. Intent Tests

    ## 6. Teaching Engine Tests

    ## 7. Quiz Tests

    ## 8. Flashcard Tests

    ## 9. Learner Model Tests

    ## 10. Mastery Tests

    ## 11. Revision Tests

    ## 12. Citation / Grounding Tests

    ## 13. Security Tests

    ## 14. Cross-User Isolation

    ## 15. Failure Handling

    ## 16. Database Verification

    ## 17. ChromaDB Verification

    ## 18. API Verification

    ## 19. Frontend Verification

    ## 20. Performance

    ## 21. Code Quality

    ## 22. Known Issues

    ## 23. Limitations

    ## 24. Required Fixes

    ## 25. Recommended Fixes

    ## 26. Phase 3 Acceptance Status

============================================================
41. ACCEPTANCE STATUS
============================================================

Use ONLY:

    VERIFIED

or

    VERIFIED WITH LIMITATIONS

or

    NOT VERIFIED

Do not automatically mark VERIFIED.

If important functionality wasn't tested:

    VERIFIED WITH LIMITATIONS

If critical functionality fails:

    NOT VERIFIED

============================================================
42. CRITICAL STOP CONDITION
============================================================

When Phase 3 implementation and verification are complete:

STOP.

Do NOT:

    start Phase 4
    add Phase 4 features
    redesign the application
    perform unrelated refactors
    rewrite Phase 2
    replace the RAG engine
    add random experimental features

Provide:

    implementation summary
    files changed
    database changes
    API changes
    frontend changes
    test results
    limitations
    known issues
    verification report

Then STOP.

============================================================
FINAL ENGINEERING PRINCIPLE
============================================================

Florix AI must evolve through layers:

    PHASE 1
    Stable Application Foundation
            ↓
    PHASE 2
    Reliable Knowledge Engine
            ↓
    PHASE 3
    Intelligent Learning Engine
            ↓
    FUTURE PHASES
    Additional capabilities

Never destroy a lower layer to build a higher layer.

Phase 3 must consume Phase 2.

Phase 3 must make Phase 2 more valuable.

The final product should feel like ONE coherent system,
not multiple disconnected AI features.

Build carefully.

Inspect before changing.

Test before claiming.

Preserve existing functionality.

Use evidence.

Do not hallucinate implementation status.

Do not move to Phase 4.

============================================================
END OF PHASE 3 INSTRUCTION
============================================================

<ADDITIONAL_METADATA>
The current local time is: 2026-09-17T05:58:08+05:30.
</ADDITIONAL_METADATA>