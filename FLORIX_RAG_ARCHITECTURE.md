# FLORIX AI — ACADEMIC KNOWLEDGE ENGINE & RAG ARCHITECTURE
**Document Version**: 2.0.0-RAG  
**Author**: Ganesh (Lead Architect & Maintainer)  
**Status**: PRODUCTION BASELINE (PHASE 2 COMPLETE)  
**Core Invariant**: ZERO UI REDESIGNS • STRICT USER ISOLATION • EVIDENCE-GROUNDED CITATIONS

---

## 1. Architectural Mission & Overview

Florix AI V2 features a production-grade academic knowledge and retrieval engine built specifically for student research, lecture comprehension, textbook study, and multi-modal synthesis. Rather than treating academic documents as undifferentiated text blocks, Florix AI structuralizes documents into coherent academic components (proofs, equations, tables, definitions, code blocks, and section hierarchies) and retrieves them via hybrid dense-vector and lexical matching with strict multi-tenant isolation.

```
                  ┌──────────────────────────────┐
                  │    STUDENT ACADEMIC SOURCE   │
                  │   PDF • Audio • Video • Web  │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │     STRUCTURAL PARSING       │
                  │  Preserves pages, headings,  │
                  │  code blocks, LaTeX & tables │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │   ACADEMIC SEMANTIC CHUNKER  │
                  │  Context boundaries + atomic │
                  │  preservation (no split math)│
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │ METADATA ENRICHMENT & STORE  │
                  │  ChromaDB (user_id scoped) + │
                  │  SQLite JSON fallback        │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
┌──────────────────┐             │
│  STUDENT QUERY   ├─────────────┤
└────────┬─────────┘             │
         │                       │
         ▼                       ▼
┌──────────────────┐   ┌─────────────────────────┐
│ QUERY INTENT &   ├──►│    HYBRID RETRIEVAL     │
│ DISAMBIGUATION   │   │  Dense Vector (Gemini)  │
└──────────────────┘   │           +             │
                       │   Exact Lexical (BM25)  │
                       │           +             │
                       │ Reciprocal Rank Fusion  │
                       └─────────────┬───────────┘
                                     │
                                     ▼
                       ┌─────────────────────────┐
                       │  RELEVANCE RERANKING    │
                       │  Deduplication + Intent │
                       └─────────────┬───────────┘
                                     │
                                     ▼
                       ┌─────────────────────────┐
                       │    CONTEXT BUILDER      │
                       │  Explicit Source Blocks │
                       │  [SOURCE 1: Doc, Page]  │
                       └─────────────┬───────────┘
                                     │
                                     ▼
                       ┌─────────────────────────┐
                       │   GROUNDED GENERATION   │
                       │  Google Gemini 1.5/2.0  │
                       │  Evidence Guardrails    │
                       └─────────────┬───────────┘
                                     │
                                     ▼
                       ┌─────────────────────────┐
                       │    ANSWER + CITATIONS   │
                       │  Claim-mapped [1], [2]  │
                       │  Interactive Badges     │
                       └─────────────────────────┘
```

---

## 2. Canonical Data Models (`Backend/rag/models.py`)

### 2.1 Ingestion Processing States
Every uploaded document passes through explicit, verifiable state transitions:
1. `UPLOADED`: File received, validated, and SHA-256 content fingerprint computed.
2. `QUEUED`: Background worker enqueued for heavy processing.
3. `EXTRACTING`: Page-by-page text, OCR, or audio/video transcription active.
4. `CHUNKING`: Structural sectioning and semantic chunk generation in progress.
5. `EMBEDDING`: Gemini vector embeddings being calculated in batches of 50.
6. `INDEXING`: Enriched chunks, page numbers, and embeddings written to SQLite & ChromaDB.
7. `READY`: Document fully indexed and available for hybrid RAG chat, quizzes, and flashcards.
8. `FAILED`: Ingestion halted; error logged to `StudySession.processing_error`.

### 2.2 Content Classifications
The structural parser tags each chunk with an explicit `ContentType`:
- `TEXT`: Standard conceptual narrative or prose.
- `CODE`: Computer programming code blocks, syntax, algorithms, and SQL queries.
- `TABLE`: Tabular data rows, schemas, comparisons, and matrices.
- `EQUATION`: LaTeX mathematical equations, integrals, summations, and proofs.
- `DEFINITION`: Formal academic definitions (`Term: explanation`).
- `HEADING`: Chapter, section, or subsection titles.
- `LIST`: Enumerated properties, steps, or bullet points.

---

## 3. Structural Parsing & Academic Chunking (`Backend/rag/`)

### 3.1 Structural Parsing (`parser.py`)
- **Page Boundary Preservation**: Extracted via `pypdf.PdfReader` retaining a strict `(page_number, page_text)` mapping. Page numbers are 1-indexed.
- **Academic Heuristics**: Automatically identifies LaTeX formulas (`$...$`, `$$...$$`, `\frac`, `\int`), Markdown tables (`| ... |`), definitions, and code fences (` ``` `).
- **Section Linkage**: Headings (`#`, `##`, `1.1`, or All-Caps headers) are bound to their child paragraphs, ensuring explanatory text never loses its conceptual anchor.

### 3.2 Semantic Chunking Engine (`chunker.py`)
- **Sliding Window Sizing**: Default chunk size of $\approx 800$ characters with $\approx 150$ characters overlap.
- **Atomic Unit Protection**:
  - **Code Blocks**: Fenced code blocks are never cut across chunk boundaries unless an individual code sample exceeds 1,600 characters.
  - **Mathematical Equations**: Multi-line LaTeX proofs and math blocks are kept intact.
  - **Tables**: Table headers and rows remain bonded together.
  - **Definitions**: Term and definition pairs are packaged in single chunks to empower downstream quiz and flashcard generation.

---

## 4. Multi-Tenant User Isolation & Vector Indexing

> [!CAUTION]
> **Zero Cross-Tenant Leakage**: Private student notes and exam materials must never be retrievable by unauthorized users.

### Security Guarantees:
1. **ChromaDB Metadata Partitioning**:
   Every vector chunk upserted to ChromaDB collection `document_chunks` includes:
   ```json
   {
     "session_id": 104,
     "user_id": 12,
     "chunk_index": 3,
     "page_number": 14,
     "section_heading": "Third Normal Form",
     "content_type": "definition"
   }
   ```
2. **Retrieval Layer Enforcement**:
   All vector queries mandate `user_id` validation. Any chunk failing ownership verification is dropped before candidate scoring.
3. **Database Scoping**:
   All relational queries join on `StudySession.user_id == current_user.id`.

---

## 5. Hybrid Retrieval & Reranking Architecture (`retriever.py` & `reranker.py`)

Academic queries routinely contain exact terminology (`3NF`, `ACID`, `BFS`, `malloc()`, `O(n log n)`, `TCP/IP`) where semantic vector search alone can underperform. Florix AI couples dense vector embeddings with exact lexical matching.

### 5.1 Query Intent Classification
Incoming queries are classified into six intents:
- `CONCEPTUAL`: Explanatory queries ("What is normalization?")
- `COMPARISON`: Contrast queries ("Difference between 2NF and 3NF?")
- `TARGETED`: Page/section queries ("What did page 17 say about deadlock?")
- `CODE`: Implementation queries ("Show Python code for Dijkstra")
- `ASSESSMENT`: Exercise queries ("Quiz me on SQL joins")
- `GENERAL`: Open-ended inquiries.

### 5.2 Reciprocal Rank Fusion (RRF)
Candidates from the dense vector search ($R_{dense}$) and exact lexical search ($R_{lexical}$) are fused using weighted RRF:
$$RRF\_Score(d) = w_{dense} \cdot \frac{1}{k + rank_{dense}(d)} + w_{lexical} \cdot \frac{1}{k + rank_{lexical}(d)}$$
* $k = 60$ (smoothing constant)
* Adaptive weights: $w_{dense} = 0.70, w_{lexical} = 0.30$ for conceptual queries; $w_{dense} = 0.45, w_{lexical} = 0.55$ for code and targeted keyword queries.

### 5.3 Relevance Reranker & Deduplication
- **Jaccard Word Overlap Filter**: Prunes near-duplicate chunks ($\text{similarity} \ge 0.70$).
- **Intent Boost**: Promotes code blocks for code queries ($+35\%$), equations for mathematical queries ($+15\%$), and definitions for conceptual queries ($+25\%$).
- Selects the Top-$K$ (default 4–6) highest-utility chunks.

---

## 6. Context Builder & Grounded Generation (`context_builder.py` & `generator.py`)

### 6.1 Structured Context Assembly
Retrieved chunks are assembled into explicit source demarcations:
```markdown
[SOURCE 1: Document "Operating Systems", Page 42, Section "Deadlock Conditions"]
A deadlock requires four simultaneous conditions: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait.

---

[SOURCE 2: Document "Operating Systems", Page 44, Section "Banker's Algorithm"]
The Banker's algorithm tests for safe states by simulating resource allocations...
```

### 6.2 Grounded Synthesis with Citation Mapping
- **System Prompt**: Enforces that claims are attributed using `[1]`, `[2]`.
- **Evidence-Absence Refusal Fallback**: If sources lack evidence, the AI explicitly states: *"Based on your uploaded study material, this topic is not covered."*
- **Citation Extraction**: The generator regex-parses bracketed numbers used in the answer and binds them to verified `Citation` records containing `document_title`, `session_id`, `page_number`, `section_heading`, and `snippet`.
- **Streaming Citations**: When streaming via SSE (`/chat/stream`), the citation metadata packet is emitted immediately before `[DONE]`.

---

## 7. Performance & Benchmark Suite (`Backend/test_rag.py`)

The test suite validates all 10 core functional invariants:
1. `test_01_content_type_detection`: Correctly classifies code, math, tables, definitions, and lists.
2. `test_02_structural_section_extraction`: Retains headings and paragraph associations.
3. `test_03_academic_chunker_preserves_atomic_units`: Guarantees code blocks and equations remain undivided.
4. `test_04_query_intent_classification`: Accurately detects comparison, code, targeted, and conceptual intents.
5. `test_05_lexical_keyword_scoring`: Verifies exact keyword boosts for academic terms (`ACID`, `SQL`).
6. `test_06_reciprocal_rank_fusion`: Validates weighted dense + lexical rank fusion.
7. `test_07_reranker_deduplication`: Verifies redundancy filtering on overlapping text.
8. `test_08_context_builder_and_citations`: Confirms source headers and citation object generation.
9. `test_09_grounded_prompt_construction`: Validates zero-fabrication directives and formatting.
10. `test_10_multi_tenant_user_isolation_guardrail`: Proves cross-tenant access attempts are rejected.

**Benchmark Execution Result**: `Ran 10 tests in 0.002s — OK (100% Pass)`.
