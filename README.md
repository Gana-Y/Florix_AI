# Florix AI 🧠 — Production-Grade AI Study Orchestration Platform

Florix AI is an enterprise-grade, full-stack AI learning platform designed to transform unstructured educational assets (scientific PDFs, web URLs, YouTube videos, pastes, and voice recordings) into interactive, grounded study workspaces. 

Unlike basic LLM wrappers, Florix AI implements a **True In-Database RAG Pipeline** with semantic chunking, custom cosine similarity vector search, a **Reasoning & Action (ReAct) AI Agent** equipped with SQL database tools, and an automated **LLM-as-a-Judge quality evaluation suite**.

---

## 🚀 Key Technical Highlights (AI Engineering Core)

### 1. Vector Ingestion & SQLite Vector Table
* **Sentence-Boundary Aware Semantic Chunker:** Processes text via paragraph-regex separators to prevent cutting sentences mid-word. Aggregates data into `~800` character chunks with `~150` characters of sliding overlap.
* **Batch Vectorization:** Generates **3072-dimensional vector coordinate lists** via `models/gemini-embedding-2` in highly optimized asynchronous batches.
* **In-Database Storage:** Persists vectors as JSON arrays in SQLite, linked via cascade-delete relationships to automatically clean up indices when documents are deleted.

### 2. Math Cosine Similarity Retrieval Engine (RAG)
* **Custom Vector Math:** Evaluates semantic similarity at runtime using a pure Python vector algebra dot-product comparison.
* **Top-K Retrieval:** Extracts the top 4 chunks matching the user's query and injects only this context into generative streaming routes, reducing API token billing and eliminating hallucinations.

### 3. ReAct Agent Tool Calling Loop
* **Database Tools:** Equips the chatbot with three live system tools (`search_user_library`, `get_session_details`, `get_user_learning_stats`) allowing the model to query file summaries and active scores.
* **Multi-Turn Loop:** Intercepts structured `[CALL_TOOL: ...]` directives in the backend Python runtime, executes SQLAlchemy database queries, injects results back into the model context, and yields the final response seamlessly.

### 4. LLM-as-a-Judge Telemetry (`evals.py`)
* Includes an automated quality assurance suite auditing and scoring outputs across three core scientific dimensions:
  1. **Faithfulness** (groundedness check, catching hallucinations).
  2. **Answer Relevance** (checking if queries are addressed completely).
  3. **Context Recall** (verifying retrieval engine accuracy against a golden dataset).

---

## 🎨 Full-Stack System Features
* **Premium UX/UI:** Harmonious dark-mode ready glassmorphic panels (`backdrop-filter: blur(12px)`) with smooth Framer Motion transitions and interactive **CSS 3D-card flipping** flashcards.
* **Axios JWT Session Security:** Cryptographic password hashing via **bcrypt** and signed **JWT (HS256)** session state tokens.
* **Dynamic Analytics Dashboards:** Tracks user quiz score trends over time and radial averages via composable **Recharts** SVGs.
* **Subscription Gating (SaaS Model):** Features a 3-tier subscription access level system (Free, Pro, Premium) limiting documents, chats, and quiz quotas per user.
* **Forgot Password flow:** Fully wired token-based forgot/reset password request pipelines.

---

## ⚡ Performance Optimizations
* **73% JS Load Reduction:** Used strategic Rollup manual chunks in `vite.config.js` to extract heavy libraries (react runtime, framer-motion, recharts, pdf engines) into code-split chunks.
* **Asynchronous Bundle Loading:** Configured lazy loading (`lazy` and `Suspense`) to load charting and export assets *only* when users navigate to those specific views.
* **Bundle size comparison:** Slashed primary Javascript initial load from a heavy **1.4 MB to just ~374 KB (gzipped)**.

---

## 🛠️ Tech Stack
* **Frontend:** React 19, Vite, Vanilla CSS 3, Recharts, Framer Motion, Axios.
* **Backend:** FastAPI, Uvicorn, Python 3, SQLAlchemy, slowapi (Rate Limiter), BeautifulSoup4, YouTube Transcript API.
* **AI Orchestration:** Google GenAI SDK (`models/gemini-2.5-flash` & `models/gemini-embedding-2`).
* **DevOps & CI/CD:** Docker, Docker Compose, GitHub Actions (Linting, Testing, Build validation).

---

## ⚙️ Getting Started & Local Installation

### 1. Configure Secrets
Create a `.env` file inside the `Backend` directory:
```env
GEMINI_API_KEY=your_google_gemini_api_key
JWT_SECRET=supersecret_dev_key_12345
DATABASE_URL=sqlite:///./florix.db
```

### 2. Standard Local Run

#### Setup & Run Backend:
```bash
cd Backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Setup & Run Frontend:
```bash
cd ../Frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Run with Docker Compose (Containerized)
Spins up both containerized frontend and backend services in a unified virtual network bridge:
```bash
docker-compose up --build
```
* Backend runs on [http://localhost:8000](http://localhost:8000)
* Frontend runs on [http://localhost:5173](http://localhost:5173)

### 4. Run LLM Quality Evaluations
```bash
cd Backend
python evals.py
```
Outputs the active RAG pipeline performance metric averages directly to your terminal console!
