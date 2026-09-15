# Florix AI — Chapter-by-Chapter Codebase Study Curriculum

> **Welcome to the Florix AI Master Class!** This curriculum is structured as a 10-chapter textbook. It breaks down the entire codebase, file structures, technologies, libraries, and design patterns, showing you exactly what to study file-by-file.

---

## 🗺️ Chapter 1: Codebase Directory Layout & Architecture Overview

Before looking at the code, you must understand where everything lives and what role each directory plays.

### 📁 Project Directory Structure
```
Florix_AI/
├── .github/
│   └── workflows/
│       └── main.yml           # Chapter 9: CI/CD GitHub Actions pipeline
├── Backend/
│   ├── uploads/               # Temporary storage for uploaded PDF & audio files
│   ├── .env                   # Environment secrets (GEMINI_API_KEY, JWT_SECRET)
│   ├── auth.py                # Chapter 3: JWT Auth & password hashing helpers
│   ├── database.py            # Chapter 2: SQLAlchemy Database Models & SQLite configuration
│   ├── evals.py               # Chapter 10: LLM-as-a-Judge Evaluation Suite
│   ├── main.py                # Chapter 7: FastAPI endpoints, streaming, RAG & Agent logic
│   └── requirements.txt       # Backend dependencies & library versions
├── Frontend/
│   ├── public/                # Static assets (icons, logo)
│   ├── src/
│   │   ├── components/        # Chapter 8: Reusable UI widgets & dashboards
│   │   │   ├── BookmarksTab.jsx
│   │   │   ├── ForgotPasswordPage.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── ProgressStats.jsx
│   │   ├── pages/             # Major application screens
│   │   │   ├── Dashboard.jsx  # Main user study space & dynamic tabs
│   │   │   ├── Login.jsx      # Login interface
│   │   │   └── Signup.jsx     # Onboarding & signup
│   │   ├── utils/
│   │   │   └── api.js         # Centralized Axios client with JWT headers
│   │   ├── App.jsx            # Custom view-based state machine router & AuthContext
│   │   ├── index.css          # Global Vanilla CSS styling tokens & custom animations
│   │   └── main.jsx           # React DOM root render
│   ├── package.json           # Frontend dependencies (React 19, Framer, Recharts)
│   ├── vercel.json            # Vercel deployment rewrites config
│   └── vite.config.js         # Chapter 8: Vite & Rollup code-splitting chunks
├── docker-compose.yml         # Chapter 9: Multi-container Docker orchestration
└── MASTER_PORTFOLIO_GUIDE.md  # Detailed interview Q&A guide
```

---

## 💾 Chapter 2: The Data Layer & Relational Schema

### 🛠️ Key Technologies:
* **SQLite:** A serverless, lightweight SQL database. Ideal for development and easy localized single-user workspace deployments.
* **SQLAlchemy:** The Python SQL Toolkit and Object Relational Mapper (ORM). Allows us to write Python classes that map directly to database tables, generating SQL queries automatically.

### 📚 Study Files:
* 📂 **[Backend/database.py](file:///c:/Users/ganes/OneDrive/Desktop/Coding%20Materials/Florix_AI/Backend/database.py)**

### 📖 Lesson Outline:
1. **The Database Engine:** SQLite is initialized via `create_engine` with `connect_args={"check_same_thread": False}` to allow concurrent multithreaded requests from FastAPI.
2. **The 8 Normalized Tables:**
   * `User`: Stores emails, names, hashed passwords, and subscription tiers (`free`, `pro`, `premium`).
   * `StudySession`: Tracks files uploaded, summaries generated, source types, and dynamic quiz/flashcard JSON data.
   * `QuizResult`: Stores scores, totals, percentages, and dates taken. Used for Recharts analytical dashboards.
   * `ChatConversation`: Stores titles of chat rooms, user relations, and associated session documents.
   * `ChatMessage`: Stores messages, indexing their roles (`user` or `assistant`) with chronological ordering.
   * `Activity`: Custom telemetry system recording user activities (e.g., "Uploaded PDF", "Took Quiz").
   * `Bookmark`: Stores notes and references to study sessions for quick access.
   * `PasswordResetToken`: Stores secure temporary tokens, expiration dates, and usage states for password resets.
   * `DocumentChunk` **[RAG Core]**: Stores split text chunks and their 3072-dimensional embedding coordinates serialized as JSON lists.
3. **Cascading Relationships:** SQLAlchemy `relationship(..., cascade="all, delete-orphan")` ensures that if a user deletes a session or profile, all orphaned quiz results, bookmarks, vector chunks, and chat histories are cleaned up instantly to prevent database bloat.

---

## 🔒 Chapter 3: The Authentication & Authorization Security Layer

### 🛠️ Key Technologies:
* **JSON Web Token (JWT):** A compact, URL-safe means of representing claims to be transferred between two parties securely.
* **Bcrypt:** A secure cryptographic password-hashing function based on the Blowfish cipher, incorporating a salt to protect against brute-force attacks.

### 📚 Study Files:
* 📂 **[Backend/auth.py](file:///c:/Users/ganes/OneDrive/Desktop/Coding%20Materials/Florix_AI/Backend/auth.py)**

### 📖 Lesson Outline:
1. **Bcrypt Hashing:** Passwords are never stored as plain text. The system salt-encrypts passwords using `bcrypt.hashpw` on registration and validates them using `bcrypt.checkpw` on login.
2. **Access Token Generation:** On successful login, the backend signs a JWT using `jwt.encode` with a 256-bit secret key using the **HS256** algorithm, attaching a standard 30-minute expiration claim (`exp`).
3. **FastAPI Dependency Injection (`get_current_user`):** Protected endpoints do not query the database manually. They use `Depends(get_current_user)`. This function intercepts the HTTP headers, decodes the JWT, validates signature/expiration, pulls the matching user from the database, and injects the User object directly into the route function parameters.

---

## 📥 Chapter 4: The Core Ingestion, Parsing & ETL Engine

### 🛠️ Key Technologies:
* **pypdf:** Pure Python PDF library capable of extracting text from documents.
* **BeautifulSoup4:** Web scraping package used to parse clean text from HTML articles.
* **YouTube Transcript API:** Fetches text captions from YouTube video IDs.
* **Gemini Files API:** Multimodal developer tool to upload audio and media files for native transcription.

### 📚 Study Files:
* 📂 **[Backend/main.py (upload, upload-audio, process-link, process-text routes)](file:///c:/Users/ganes/OneDrive/Desktop/Coding%20Materials/Florix_AI/Backend/main.py)**

### 📖 Lesson Outline:
1. **ETL (Extract, Transform, Load):**
   * **PDF Ingestion:** `PdfReader` extracts text page-by-page. Text is sanitized and passed to our chunker.
   * **Web Articles:** `requests` fetches raw HTML, BeautifulSoup decomposes noise (header, footer, nav, script, style tags), and extracts raw body content.
   * **YouTube Ingestion:** We parse the URL, extract the 11-character video ID, fetch the captions via the transcript API, and merge them into a single coherent text block.
   * **Audio Multimodality:** We upload voice recordings to Google's Files API using `client.files.upload`, send them with system instructions to Gemini for unified transcription and summarization, and return a beautiful Markdown study guide.

---

## 🔍 Chapter 5: The Advanced Vector RAG Engine

### 🛠️ Key Technologies:
* **Vector Embeddings (`gemini-embedding-2`):** Converts words, sentences, or paragraphs into a high-dimensional mathematical coordinate vector (3072 coordinates) where semantically similar meanings cluster close together.
* **Cosine Similarity:** Mathematical algorithm checking the angle between two vectors to determine how closely their meanings match.

### 📚 Study Files:
* 📂 **[Backend/main.py (`chunk_text`, `embed_and_store_document`, `cosine_similarity`, `retrieve_relevant_chunks`)](file:///c:/Users/ganes/OneDrive/Desktop/Coding%20Materials/Florix_AI/Backend/main.py)**

### 📖 Lesson Outline:
1. **Sentence-Boundary Aware Chunking (`chunk_text`):** Splitting text naively by string slicing cuts words in half. Our algorithm uses regex splits on punctuation, aggregates sentences into blocks of ~800 characters, and maintains a sliding overlap window of ~150 characters to ensure semantic continuity between boundaries.
2. **Embedding & Storage:** Chunks are batch-sent in blocks of 50 to Gemini's embedding model to prevent rate limits. The returned 3072-float vectors are stored in SQLite.
3. **Retrieval Engine (`retrieve_relevant_chunks`):**
   * Embeds the user question vector.
   * Pulls all chunk vectors of the document.
   * Calculates cosine similarity for each chunk.
   * Ranks and slices the Top-4 (Top-K) most relevant chunks.
   * Injects the top chunks into the generative context window.

---

## 🤖 Chapter 6: The AI Agent ReAct Tool Loop

### 🛠️ Key Technologies:
* **ReAct Agent Pattern (Reasoning + Action):** An autonomous execution loop where the LLM can think, choose to run external tools, observe the results, and formulate its final answer.

### 📚 Study Files:
* 📂 **[Backend/main.py (Agent tools & send_message route)](file:///c:/Users/ganes/OneDrive/Desktop/Coding%20Materials/Florix_AI/Backend/main.py)**

### 📖 Lesson Outline:
1. **Agent Database Tools:** Defined three specialized read-only tools:
   * `search_user_library`: Full-text SQL query across user uploaded titles and summaries.
   * `get_session_details`: Pulls document metrics, summaries, and associated quiz history.
   * `get_user_learning_stats`: Queries totals for sessions, quiz averages, and active bookmarks.
2. **Orchestrator Loop:** The endpoint executes a multi-loop ReAct system. If the model outputs `[CALL_TOOL: get_user_learning_stats()]`, the backend pauses, runs the Python SQLAlchemy function, appends the tool outputs, and calls the API again. This allows the chatbot to dynamically reference live DB stats.

---

## 🌐 Chapter 7: The FastAPI REST API, SSE Streaming & Middlewares

### 🛠️ Key Technologies:
* **FastAPI & Uvicorn:** Extreme high-performance, asynchronous web server framework.
* **Server-Sent Events (SSE):** Standard HTTP unidirectional streaming protocol allowing servers to push data to client browsers in real-time.
* **slowapi:** Rate limiting library for FastAPI.

### 📚 Study Files:
* 📂 **[Backend/main.py](file:///c:/Users/ganes/OneDrive/Desktop/Coding%20Materials/Florix_AI/Backend/main.py)**

### 📖 Lesson Outline:
1. **Lifespan Management:** Uses `@asynccontextmanager` on startup to trigger table initialization (`Base.metadata.create_all`) ensuring schemas update automatically.
2. **Middleware Configurations:**
   * **CORS Middleware:** Standard security setup permitting React's origin (`http://localhost:5173`) to make REST calls.
   * **slowapi Rate Limiting:** Imposed standard limits on chat endpoints (`limiter.limit("5/minute")`) using client IP tracking to prevent API exploitation.
3. **Real-time SSE Streaming (`chat_stream`):** Uses FastAPI's `StreamingResponse`. It yields asynchronous JSON chunks (`data: {"token": "..."}\n\n`) as they arrive from the generative model, terminating with a `[DONE]` keyword.

---

## 🎨 Chapter 8: The Modern React 19 Frontend Engine

### 🛠️ Key Technologies:
* **React 19:** State-of-the-art UI renderer utilizing Context Providers and performance hooks.
* **Framer Motion:** High-performance React animation engine.
* **Recharts:** Composable charting library built on SVG.

### 📚 Study Files:
* 📂 **[Frontend/src/App.jsx](file:///c:/Users/ganes/OneDrive/Desktop/Coding%20Materials/Florix_AI/Frontend/src/App.jsx)**
* 📂 **[Frontend/src/pages/Dashboard.jsx](file:///c:/Users/ganes/OneDrive/Desktop/Coding%20Materials/Florix_AI/Frontend/src/pages/Dashboard.jsx)**
* 📂 **[Frontend/vite.config.js](file:///c:/Users/ganes/OneDrive/Desktop/Coding%20Materials/Florix_AI/Frontend/vite.config.js)**

### 📖 Lesson Outline:
1. **Centralized AuthContext & PreferencesContext:** Coordinates token loading, login triggers, subscription tiers, and local preference storage (Concise, Balanced, or Detailed) throughout the application wrapper.
2. **Custom View Routing:** Implements a lightweight, fast state-machine router in `App.jsx` avoiding heavy browser dependencies.
3. **Performance Bundle Code Splitting (`vite.config.js`):** Slashes initial loads from 1.4MB to 374KB. Uses manual rollup chunks to separate large packages (react runtime, framer-motion, charts, pdf) and lazy-loads views using React `lazy` and `Suspense`.
4. **Vanilla CSS Glassmorphism & Card flips:** Outlined inside `index.css`. Glassmorphism uses `backdrop-filter: blur(12px)`. Card flips use outer 3D `perspective` and absolute card face rotation transforms.

---

## 🚢 Chapter 9: DevOps, Testing & CI/CD Pipeline

### 🛠️ Key Technologies:
* **Docker & Docker Compose:** Containerization engine packaging code, dependencies, and runtimes into a unified image that runs identically on any environment.
* **GitHub Actions:** Native GitHub CI/CD automation workflow.

### 📚 Study Files:
* 📂 **[docker-compose.yml](file:///c:/Users/ganes/OneDrive/Desktop/Coding%20Materials/Florix_AI/docker-compose.yml)**
* 📂 **[.github/workflows/main.yml](file:///c:/Users/ganes/OneDrive/Desktop/Coding%20Materials/Florix_AI/.github/workflows/main.yml)**

### 📖 Lesson Outline:
1. **Docker Containerization:** Dockerfile maps directories, configures virtual environments, installs requirements, exposes ports, and initializes Uvicorn or Node dev servers.
2. **Docker Compose Orchestration:** Binds our Frontend container and Backend container under a shared virtual network bridge, injecting environment secrets and exposing ports 8000 and 5173.
3. **CI/CD Validation Pipeline:** GitHub Actions sets up virtual OS platforms on every git push, spins up Python and Node test instances, installs dependencies, runs 30+ validation test scripts, and asserts successful Docker builds before allowing merges to the main branch.

---

## 📊 Chapter 10: The LLM-Ops Quality Evaluation Suite

### 🛠️ Key Technologies:
* **LLM-as-a-Judge:** Modern validation standard using advanced foundation models (rather than hardcoded strings) to audit, grade, and evaluate natural language outputs.

### 📚 Study Files:
* 📂 **[Backend/evals.py](file:///c:/Users/ganes/OneDrive/Desktop/Coding%20Materials/Florix_AI/Backend/evals.py)**

### 📖 Lesson Outline:
1. **Golden Datasets:** Establishes fixed reference schemas of golden context, Gold-standard answers, and queries.
2. **Judge Telemetry Grading:**
   * **Faithfulness Evaluation:** Prompts Gemini to review generated answers compared to retrieved contexts, ensuring no ungrounded claims or hallucinations are present.
   * **Answer Relevance Evaluation:** Evaluates how directly the reply addresses the core question without drifting off-topic.
   * **Context Recall Evaluation:** Measures the accuracy of the vector search pipeline, verifying that retrieved contexts successfully match gold-standard requirements.
3. **Windows Console Reconfiguration:** Utilizes `sys.stdout.reconfigure(encoding='utf-8')` to ensure multi-byte emojis and telemetry statistics print successfully on CP1252 Windows console architectures without throwing encoding crashes.
