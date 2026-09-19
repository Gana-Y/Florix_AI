# Florix AI — Technical Documentation & Verified Milestones

## Architecture & Visual Save Points
- **Onboarding Left Visual Save Point**:
  - **Status**: Approved & Locked as the definitive save point.
  - **Composition**:
    - Authentic 4K laser pouring beam video (`/videos/onboarding-beam.mp4` / `.webm`) running with natural cloud lightning flashes and dynamic right-side waterfall flare.
    - Flat black board container directly branded with typography:
      - `INTELLIGENT WORKSPACE`
      - `FLORIX` (high-contrast typography with drop shadow)
      - `Next-Gen Academic Engine`
    - No nested extra black rectangles or conflicting borders behind it.
    - Right-side onboarding steps (roles, domains, setup options, progress bar) cleanly structured and fully operational.
  - **Backup Reference**: `Frontend/src/components/OnboardingFlow.savepoint.jsx`

## Production Audit & Security Milestones
- **Audit #1 — Content Edge-Case Audit**:
  - **Status**: LOCKED & Approved.
  - **Coverage**: Empty/whitespace inputs, SQL injection strings, LaTeX math formulas, prompt injection payloads, cross-tenant isolation, null bytes.
- **Audit #2 — PDF Deep Audit**:
  - **Status**: LOCKED & Approved.
  - **Coverage**: Multi-page PDF extraction, encrypted/password-protected PDFs, corrupt headers/xref, MIME spoofing, page number preservation.
- **Audit #3 — Video Upload Deep Audit**:
  - **Status**: LOCKED & Approved.
  - **Coverage**: Video file validation, async background processing, transcript/study guide partitioning regex fix, timestamp span preservation.
- **Audit #4 — Web Link / URL Ingestion Deep Audit**:
  - **Status**: LOCKED & Approved.
  - **Coverage**:
    - Complete SSRF defense (RFC 1918, loopback, cloud metadata `169.254.169.254`, DNS rebinding, redirect IP re-validation, RFC 6052 NAT64 unwrapping).
    - Resource & redirect bounds (15MB Content-Length early rejection, 15MB stream cutoff, 20s timeout, max 5 redirect hops).
    - Structural HTML parsing (`BeautifulSoup` article extraction, Markdown headings/lists/tables, boilerplate removal, entity decoding).
    - Content-Type routing (HTML, `text/plain`, PDF pass-through, binary/media HTTP 422 rejection).
    - Web-to-RAG traceability: `page_number=None` preserved across entire pipeline (Normalizer, Chunker, SQLite `DocumentChunk`, ChromaDB, Retriever, Citations) with authentic `source_url` and zero fabricated Page 1.
    - Verified with live public URL ingestion (`https://httpbin.org/html`), 70/70 Audit #4 tests passing, and 291/291 total backend regression passing.
