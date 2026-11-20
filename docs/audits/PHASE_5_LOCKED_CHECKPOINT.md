# PHASE 5 LOCKED CHECKPOINT
## Grounded Visual Learning, Concept Mapping & Personal Knowledge Map

**Project:** Florix AI — Intelligent Multi-Modal Academic Workspace  
**Status Date:** 2026-09-30  
**Phase 1:** LOCKED  
**Phase 2:** LOCKED  
**Phase 3:** LOCKED  
**Phase 4:** LOCKED  
**Audits #1–#12:** LOCKED  
**Phase 5:** **LOCKED**  
**Phase 6:** **NOT STARTED**  

---

### 1. Phase 5 Objective

Transform multi-modal academic study materials into grounded, interactive visual learning models (concept maps, flowcharts, mind maps, hierarchies, comparisons, processes, and timelines) that connect directly to course source chunks and student mastery telemetry, while providing a fully manual concept-mapping editor for self-directed study.

---

### 2. Features Implemented

1. **AI-Generated Grounded Visuals (Auto Mode + 7 Formats):**
   - **Concept Map:** Interconnected semantic concept network with controlled relationship types.
   - **Flowchart:** Decision paths, branches, and algorithmic structures.
   - **Mind Map:** Central academic theme radiating outward into topic branches.
   - **Hierarchy:** Top-down taxonomic classification tree.
   - **Comparison:** Dual-column comparative structure for contrasting subjects.
   - **Process:** Linear sequential progression with numbered stages.
   - **Timeline:** Chronological event progression with time/era markers.
2. **Deterministic Fallback Engine:**
   - Automatically constructs a grounded conceptual graph directly from section headings when the LLM is unreachable or returns unparseable output, guaranteeing zero downtime.
3. **Manual Visual Concept Map Builder:**
   - Add concepts (type, label, academic explanation).
   - Connect concepts with directional arrows and controlled academic relationships.
   - Delete nodes and relationships.
   - Drag nodes interactively across the vector SVG canvas.
   - Full Undo / Redo history stack.
4. **Learner-Aware Knowledge Visualization & Foundation Alerts:**
   - Overlays student topic mastery from `LearnerTopicMastery`: Mastered (Emerald), Learning (Blue), Review Needed (Amber), Struggling (Rose), and Untested (Slate).
   - **Prerequisite Foundation Alerts:** When a prerequisite foundation concept is struggling (`score < 0.40`), dependent edges pulse with a dashed rose line and warning icon alert.
5. **Interactive Source Citations Drawer:**
   - Clicking any concept node opens an inspector side drawer displaying the full academic definition, learner mastery score, and interactive source citations with page numbers and text snippets.
6. **Unified Visual Artifact Persistence:**
   - AI-generated and manual maps serialize to the exact same `VisualArtifact` schema.
   - Full versioning (`version`, `is_modified`) and CRUD support in the student library.
7. **Contextual Toolbar Integration:**
   - Selecting text in the Study Guide reveals `[ 📊 Visualize ]` in `FloatingSelectionToolbar`, which opens Visual Learning focused on that snippet.

---

### 3. Backend Architecture

- **`Backend/visualization/models.py`:** Controlled vocabulary enums (`VisualType`, `RelationType`, `VisualReadinessStatus`), Pydantic schemas (`VisualNode`, `VisualEdge`, `VisualDocument`, `ReadinessAnalysis`, `VisualizeRequest`, `VisualArtifactCreate`, `VisualArtifactUpdate`).
- **`Backend/visualization/analyzer.py`:** Semantic density scoring, noise/gibberish rejection, and academic readiness evaluation before invoking generation.
- **`Backend/visualization/prompts.py`:** Structured prompt templates sandboxing source chunks inside `<untrusted_study_material>` blocks.
- **`Backend/visualization/validator.py`:** HTML/script sanitization, relation normalization, graph bounds enforcement (3–25 nodes, max 40 edges), and deterministic SVG layout engine.
- **`Backend/visualization/service.py`:** Service coordinator tying RAG retrieval, Gemini Flash cascade, fallback generator, mastery overlay, Foundation Alerts, and artifact CRUD.
- **`Backend/main.py`:** REST API routes registered under tags `["Visual Learning"]` with strict JWT dependency and multi-tenant authorization:
  - `POST /study/visualize/readiness`
  - `POST /study/{session_id}/visualize`
  - `GET /study/{session_id}/concept-map`
  - `POST /study/{session_id}/visuals`
  - `GET /study/{session_id}/visuals`
  - `GET /study/{session_id}/visuals/{visual_id}`
  - `PATCH /study/{session_id}/visuals/{visual_id}`
  - `DELETE /study/{session_id}/visuals/{visual_id}`

---

### 4. Frontend Integration

- **`Frontend/src/components/VisualLearningWorkspace.jsx`:** Interactive React SVG canvas with pan, zoom, reset, node dragging, topic generator, manual node/link modals, saved visuals drawer, and node details/citations inspector.
- **`Frontend/src/components/StudySession.jsx`:** `Visual Learning` tab added directly to top tab switcher. Wired `FloatingSelectionToolbar` to open Visual Learning on highlight.
- **`Frontend/src/components/FloatingSelectionToolbar.jsx`:** Added `Network` icon and `[ 📊 Visualize ]` action button.
- **Zero Redesign:** Maintained 100% of existing sidebar, shell, theme, and token styling.

---

### 5. Database Changes

- **Table Added:** `visual_artifacts`
  - `id`: `String(60)` (Primary Key, e.g. `vis_1712345678901`)
  - `user_id`: `Integer` (Foreign Key -> `users.id`, Indexed)
  - `session_id`: `Integer` (Foreign Key -> `study_sessions.id`, ondelete="CASCADE", Indexed)
  - `title`: `String(200)`
  - `visual_type`: `String(50)`
  - `visual_data`: `JSON`
  - `is_manual`: `Boolean`
  - `is_modified`: `Boolean`
  - `version`: `Integer`
  - `created_at`: `DateTime`
  - `updated_at`: `DateTime`
- **Relationships:**
  - `User.visual_artifacts`: `cascade="all, delete-orphan"`
  - `StudySession.visual_artifacts`: `cascade="all, delete-orphan"`
- **Indexes:**
  - `ix_visual_artifacts_user_session` on `(user_id, session_id)` in `init_db()`.
- **Integrity:**
  - `PRAGMA integrity_check` verified: `[('ok',)]`.

---

### 6. Security Guarantees

1. **Multi-Tenant Isolation & IDOR Defense:**
   - Every route validates `current_user.id == session.user_id` and `current_user.id == artifact.user_id`.
   - Access attempts to other users' sessions or visuals return HTTP 404.
2. **Prompt Injection Boundaries:**
   - Course material encapsulated in `<untrusted_study_material>` with system prompt strictness.
3. **XSS & Code Execution Prevention:**
   - LLM instructed never to generate HTML, CSS, JavaScript, `<script>`, or `<svg>`.
   - All text sanitized with regex stripping.
   - Frontend SVG renders pure React elements (`<rect>`, `<text>`, `<line>`).
   - Zero `dangerouslySetInnerHTML` or `eval()`.

---

### 7. Grounding & Provenance Behavior

- **Single RAG Pipeline:** Visual generation uses `retrieve_relevant_chunks()`, which uses the single `HybridRetriever` and persistent ChromaDB collection.
- **Provenance Linkage:** Every node stores `source_chunk_ids` linking to exact chunks. Nodes contain rich citation metadata (page numbers, section headings, and text snippets).
- **Relational Integrity:** Relationships are restricted to controlled vocabulary items derived from source text semantics. Unresolved or orphaned edges are stripped.
- **Topic Grounding:** If a requested topic is absent from the study material, Gemini returns `{"status": "NOT_FOUND"}` and the service returns an informative 404 message without hallucinating content.

---

### 8. Learner Mastery Integration

- Consumes the authoritative Phase 3 `LearnerEngine` and `LearnerTopicMastery` table.
- Concepts matched by label/description.
- Status categories:
  - $\ge 0.85$: Mastered
  - $\ge 0.65$: Learning
  - $\ge 0.40$: Review Needed
  - $< 0.40$: Struggling
  - No record: Untested (never falsely categorized as weak or struggling)
- Foundation Alerts trigger strictly on prerequisite edges where the foundation concept has low mastery or is struggling.

---

### 9. Test Results

- **Pre-Phase-5 Baseline Tests:** 650/650 PASSED
- **Dedicated Phase 5 Tests (`Backend/test_visual_learning.py`):** 17/17 PASSED
- **Full Platform Regression Suite:** **667/667 PASSED (0 Failures, 0 Errors, 0 Skipped across 20 suites)**
- **Frontend Production Build:** **PASSED (`vite build` in 34.94s, 0 errors)**
- **Database Integrity:** **`PRAGMA integrity_check` = `[('ok',)]`**

---

### 10. Known Limitations

1. **SVG Direct Keyboard Navigation:** Screen readers and keyboard-only users access node concepts, citations, and mastery through the semantic textual inspector drawer rather than direct roving focus within SVG `<g>` elements.
2. **Video Player Seeking:** Citations display timestamp information for video/audio chunks, but clicking does not directly trigger seek events in the separate video player component.

---

### 11. Files Added & Modified

#### Tracked Files Modified (4 files):
- `Backend/database.py` (27 lines added)
- `Backend/main.py` (225 lines added, 1 line modified)
- `Frontend/src/components/FloatingSelectionToolbar.jsx` (25 lines added, 3 lines modified)
- `Frontend/src/components/StudySession.jsx` (27 lines added, 1 line modified)

#### Untracked Files Added (8 files):
- `Backend/visualization/__init__.py`
- `Backend/visualization/models.py`
- `Backend/visualization/analyzer.py`
- `Backend/visualization/prompts.py`
- `Backend/visualization/validator.py`
- `Backend/visualization/service.py`
- `Backend/test_visual_learning.py`
- `Frontend/src/components/VisualLearningWorkspace.jsx`

---

### 12. Architectural Invariants That Must NEVER Be Violated

1. **ONE HybridRetriever:** All search queries must flow through `HybridRetriever`. Never create a secondary search or retrieval pipeline.
2. **ONE Embedding Model:** All vectors must be generated using `models/gemini-embedding-2` (3072-dim).
3. **ONE Vector Database:** All chunk embeddings must be indexed in the single persistent ChromaDB collection.
4. **ONE Citation Architecture:** Citations must map to chunk provenance (indices, page numbers, timestamps).
5. **ONE Learner Mastery Engine:** Topic mastery scores and history must be managed solely by `LearnerEngine` and `LearnerTopicMastery`.
6. **ONE SM-2 Spaced Repetition Engine:** Review scheduling must use the single SM-2 implementation in `FlashcardProgress`.
7. **Strict Rendering Security:** AI outputs must never be rendered as raw HTML, CSS, JavaScript, or executable SVG. Visuals must be structured JSON rendered by safe React components.

---

### 13. Current Project Status

```text
============================================================
PHASE 1 = LOCKED
PHASE 2 = LOCKED
PHASE 3 = LOCKED
PHASE 4 = LOCKED
AUDITS #1–#12 = LOCKED
PHASE 5 = LOCKED

PHASE 6 = NOT STARTED
============================================================
```
