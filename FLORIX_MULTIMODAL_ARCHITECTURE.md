# Florix AI — Multimodal Architecture Specification (Phase 4)
**System Architecture Manual**: Phase 4 Multimodal Knowledge Engine & Learning Experience  
**Author**: Ganesh (Lead Architect)  
**Status**: ACTIVE, VERIFIED & LOCKED  
**Core Directive**: EXTEND MULTIMODALITY WHILE PRESERVING RETRIEVAL & INTELLIGENCE FOUNDATIONS

---

## 1. Executive Summary & Architectural Scope

Phase 4 extends Florix AI from a document-centric academic assistant into a unified multimodal knowledge system. The engine ingests, normalizes, indexes, retrieves, and synthesizes educational material across all primary learning modalities:
1. **Multi-page Academic PDFs** (with structural layout, formula preservation, and page provenance).
2. **Plain Text & Markdown Notes** (with code blocks and heading hierarchy).
3. **Audio Lectures & Podcasts** (with timestamp spans, speaker identification, and transcript segmentation).
4. **Video Lectures & Demonstrations** (with visual highlights, spoken transcript, and temporal markers).
5. **YouTube Educational Videos** (with start and duration caption timestamp preservation).
6. **Web Articles & Research Portals** (with boiler-plate removal and section boundaries).

### Strict Architectural Invariant
Phase 4 **strictly preserves** the single, verified retrieval and intelligence foundation established in Phase 2 and Phase 3:
- **Zero secondary Chroma collections**: All multimodal chunks reside in the primary ChromaDB collection `document_chunks`.
- **Zero secondary embedding models**: All chunks are embedded using Google GenAI `models/gemini-embedding-2`.
- **Zero duplicate chunking silos**: `build_semantic_chunks` operates as the single authoritative semantic chunker.
- **Zero UI alterations**: All existing React components, Framer Motion animations, and dashboard views remain 100% untouched.

---

## 2. Multimodal Content Pipeline Topology

```
+-----------------------------------------------------------------------------------+
|                           MULTIMODAL INGESTION CHANNELS                           |
|  [PDF Upload]   [Audio Upload]   [Video Upload]   [YouTube Link]   [Web Article]  |
+-------+----------------+---------------+----------------+----------------+--------+
        |                |               |                |                |
        v                v               v                v                v
+-----------------------------------------------------------------------------------+
|               UNIFIED CONTENT NORMALIZATION LAYER (Backend/content/)              |
|                                                                                   |
|  - ContentNormalizer.normalize_pdf()      -> NormalizedContent(MediaType.PDF)     |
|  - ContentNormalizer.normalize_audio()    -> NormalizedContent(MediaType.AUDIO)   |
|  - ContentNormalizer.normalize_video()    -> NormalizedContent(MediaType.VIDEO)   |
|  - ContentNormalizer.normalize_youtube()  -> NormalizedContent(MediaType.YOUTUBE) |
|  - ContentNormalizer.normalize_web()      -> NormalizedContent(MediaType.WEB)     |
|  - ContentNormalizer.normalize_text()     -> NormalizedContent(MediaType.TEXT)    |
|                                                                                   |
|  Atom: ContentSegment(text, page_number, timestamp_start, timestamp_end, speaker) |
|  Hash: SHA-256 for deterministic deduplication and provenance tracking           |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|              TIMESTAMP-PRESERVING CHUNKER (Backend/rag/chunker.py)                |
|                                                                                   |
|  - Consolidates atomic segments into ~800-character semantic chunks              |
|  - Calculates temporal spans: timestamp_start = min(s.start), end = max(s.end)    |
|  - Interpolates timestamps during sentence splits for oversized segments         |
|  - Produces: EnrichedChunk(metadata={"timestamp_start", "timestamp_end", ...})   |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                    UNIFIED VECTOR & RELATIONAL STORAGE ENGINE                     |
|                                                                                   |
|  ChromaDB (Cosine):                               SQLite Database (florix.db):     |
|  - Collection: document_chunks                    - Table: document_chunks        |
|  - Dimensions: 3072 (gemini-embedding-2)          - Column: chunk_metadata (JSON) |
|  - Metadata: session_id, user_id,                 - Columns: page_number,         |
|    timestamp_start, timestamp_end,                  section_heading, content_type |
|    timestamp_str, source_type, speaker                                            |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                       HYBRID RETRIEVAL & CITATION ENGINE                          |
|                                                                                   |
|  - HybridRetriever: Chroma Dense + SQLite Lexical via Reciprocal Rank Fusion      |
|  - ContextBuilder: Assembles prompt context with explicit temporal headers:       |
|    [SOURCE 1: Audio "Title", Timestamp [01:15 - 02:45], Section "..."]            |
|  - Citation: Populates timestamp_start, timestamp_end, media_timestamp_str        |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                   GROUNDED LEARNING & TUTORING (Phase 3 & 4)                     |
|                                                                                   |
|  - Chat & Tutoring: Grounded answers with clickable [MM:SS - MM:SS] media links   |
|  - Grounded Quizzes: Questions cited to exact lecture moments or document pages   |
|  - Flashcards: Spaced repetition cards linked to source audio/video timestamps     |
+-----------------------------------------------------------------------------------+
```

---

## 3. Unified Content Normalization Layer (`Backend/content/`)

### 3.1 Canonical Data Models (`models.py`)
- `MediaType(str, Enum)`: Enumerates supported modalities (`pdf`, `audio`, `video`, `youtube`, `text`, `web`, `image`).
- `ContentSegment`: Canonical atom representing an educational excerpt:
  - `segment_id: int`: Sequential ordinal index.
  - `text: str`: Raw textual transcript or document paragraph.
  - `page_number: Optional[int]`: Physical document page (PDF).
  - `timestamp_start: Optional[float]`: Starting offset in seconds (Media).
  - `timestamp_end: Optional[float]`: Ending offset in seconds (Media).
  - `speaker: Optional[str]`: Identified speaker turn.
  - `heading: Optional[str]`: Associated section heading or topic tag.
  - `content_type: ContentType`: Academic type (text, code, table, formula, definition).
  - `metadata: Dict[str, Any]`: Provenance tags.
- `NormalizedContent`: Standardized container encapsulating normalized material:
  - `title: str`: Clean display title.
  - `media_type: MediaType`: Canonical modality enum.
  - `content_hash: str`: Deterministic SHA-256 digest.
  - `raw_text: str`: Consolidated full-text representation.
  - `segments: List[ContentSegment]`: Ordered list of atomic segments.
  - `metadata: Dict[str, Any]`: Modality-specific metadata (duration, page count, URL).

### 3.2 Content Normalization Engine (`normalizer.py`)
The `ContentNormalizer` class provides dedicated, format-specific ingestion methods:
- `normalize_pdf`: Preserves page numbers and detects formulas/code blocks within pages.
- `normalize_youtube`: Preserves YouTube caption `start` and `duration` values into explicit seconds and `[MM:SS - MM:SS]` brackets.
- `normalize_audio`: Structures timestamped audio transcripts with speaker identification.
- `normalize_video`: Structures multimodal video transcripts with visual and spoken markers.
- `normalize_web`: Cleans and segments web portal articles.
- `normalize_text`: Processes student notes, Markdown, and plain text.
- `normalize_any`: Universal polymorphic dispatcher routing dynamically by `source_type`.

### 3.3 Modular Transcription Layer (`transcription.py`)
- `TranscriptionProvider` (Abstract Base Class): Defines standard `transcribe(file_path, mime_type) -> List[ContentSegment]`.
- `GeminiTranscriptionProvider`: Production provider uploading media via Google GenAI Files API and prompting Gemini for high-fidelity timestamped segments in `[MM:SS - MM:SS] Speaker: Text` syntax.
- `MockTranscriptionProvider`: Deterministic offline provider for unit testing and CI/CD pipelines.
- `extract_timestamped_segments`: Resilient regular expression and JSON parser capable of extracting timestamps across various LLM formatting variations.
- `parse_timestamp_str`: Robust parser converting `MM:SS`, `HH:MM:SS`, and floating-point representations into float seconds.

---

## 4. Timestamp Preservation & Chunker Integration

In `Backend/rag/chunker.py`, `build_semantic_chunks` has been extended to accept `NormalizedContent`:
1. **Timestamp Span Aggregation**: When merging consecutive segments into a chunk of ~800 characters:
   $$\text{timestamp\_start} = \min_{s \in \text{segs}} s.\text{timestamp\_start}$$
   $$\text{timestamp\_end} = \max_{s \in \text{segs}} s.\text{timestamp\_end}$$
2. **Linear Interpolation for Oversized Segments**: When a single spoken monologue exceeds `chunk_size`, the segment is split across sentence boundaries, and temporal boundaries are linearly interpolated proportional to character length:
   $$t_{\text{sub\_start}} = t_{\text{start}} + \frac{\text{char\_offset} - \text{len}}{\text{total\_chars}} \times \text{duration}$$
   $$t_{\text{sub\_end}} = t_{\text{start}} + \frac{\text{char\_offset}}{\text{total\_chars}} \times \text{duration}$$
3. **Heading Decoration**: Chunks without structural section headings are automatically decorated with their timecode bracket (e.g. `[01:15 - 02:30] Instructor`).
4. **Metadata Carrier**: Each `EnrichedChunk` carries `metadata["timestamp_start"]`, `metadata["timestamp_end"]`, `metadata["timestamp_str"]`, and `metadata["source_type"]`.

---

## 5. Storage Engine & ChromaDB Vector Indexing

### 5.1 Relational Schema (`florix.db`)
`DocumentChunk` stores all timestamp metadata in its JSON column:
```python
db_chunk = DocumentChunk(
    chunk_index=index,
    text_content=chk.text,
    embedding=embedding_vector,
    session_id=session_id,
    page_number=chk.page_number,
    section_heading=chk.section_heading,
    content_type=chk.content_type.value,
    chunk_metadata={
        "timestamp_start": chk.metadata.get("timestamp_start"),
        "timestamp_end": chk.metadata.get("timestamp_end"),
        "timestamp_str": chk.metadata.get("timestamp_str"),
        "source_type": source_type,
        "speaker": chk.metadata.get("speaker")
    }
)
```

### 5.2 Vector Schema (ChromaDB `document_chunks`)
ChromaDB accepts flat scalar metadata:
```python
meta_dict = {
    "session_id": session_id,
    "user_id": session.user_id,
    "chunk_index": idx,
    "page_number": chk.page_number,
    "section_heading": chk.section_heading or "",
    "content_type": chk.content_type.value,
    "timestamp_start": float(chk.metadata["timestamp_start"]),
    "timestamp_end": float(chk.metadata["timestamp_end"]),
    "timestamp_str": str(chk.metadata["timestamp_str"]),
    "source_type": str(source_type),
}
```

---

## 6. Hybrid Retrieval & Traceable Citations

### 6.1 Hybrid Retrieval (`Backend/rag/retriever.py`)
`HybridRetriever.retrieve` extracts chunks from dense ChromaDB queries and lexical SQLite queries, propagating `source_type` and `metadata` into `RetrievalCandidate` instances.

### 6.2 Structured Context Builder (`Backend/rag/context_builder.py`)
Evidence blocks presented to Gemini are formatted dynamically:
- **For Document Sources**:
  `[SOURCE 1: Document "Data Structures", Page 42, Section "B-Trees"]`
- **For Media / Multimodal Sources**:
  `[SOURCE 1: Audio "Distributed Systems", Timestamp [05:40 - 06:50], Section "Paxos Consensus"]`

### 6.3 Citation Data Contract (`Backend/rag/models.py`)
The canonical `Citation` schema provides backward-compatible timestamp serialization:
```python
@dataclass
class Citation:
    source_index: int
    document_title: str
    session_id: int
    page_number: int
    section_heading: str
    snippet: str
    timestamp_start: Optional[float] = None
    timestamp_end: Optional[float] = None
    source_type: Optional[str] = None
    media_timestamp_str: Optional[str] = None
```
Calling `Citation.to_dict()` outputs `timestamp_start`, `timestamp_end`, `source_type`, and `media_timestamp_str` whenever available.

---

## 7. Multi-Tenant Security & Safety Protocols

1. **Strict User Scoping**: All sessions, SQLite chunks, and Chroma embeddings are bound to `user_id`. Queries cross-checking different users return HTTP 404.
2. **SHA-256 Ingestion Deduplication**: Inputs are hashed prior to processing. Duplicate uploads reuse the existing study session without redundant embeddings.
3. **Resilient Fallbacks**:
   - Audio/video files without speech fall back gracefully to empty or synthetic timelines.
   - YouTube videos with disabled captions return HTTP 422 with actionable guidance.
   - Embedding API rate-limiting triggers exponential backoff retries ($2^{\text{attempt}} + \text{jitter}$).

---

## 8. Verification & Test Coverage Summary

The system is validated by an automated test suite:
- `Backend/test_multimodal.py`: 21 tests covering Categories A through V.
- `Backend/test_rag.py`: 10 tests verifying hybrid retrieval and chunking.
- `Backend/test_main.py`: 4 tests verifying authentication and core routing.
- `Backend/test_api.py`: 29 tests verifying REST contract compliance and subscription gates.
- `Backend/test_intelligence.py`: 20 tests verifying learning loop, SM-2, and assessment generation.
- **Total Backend Tests**: 84 passed, 0 failed.
- **Frontend Build**: `npm run build` succeeds in 14.19s with 0 errors.
