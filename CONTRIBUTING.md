# Contributing to Florix AI 🚀

Thank you for contributing to **Florix AI** — an asynchronous, enterprise-grade multi-modal RAG platform and adaptive learning engine.

We welcome contributions from engineers, researchers, and open-source builders.

---

## 📜 Code of Conduct

We are committed to maintaining a welcoming, professional, and rigorous engineering environment. Respectful, evidence-driven collaboration and technical excellence are expected from all contributors.

---

## 🏗️ Architecture Overview

Florix AI is split into two core workspaces:
- **`Backend/`**: FastAPI, ChromaDB (HNSW index), PostgreSQL (SQLAlchemy 2.0 async), Google Gemini API, Redis semantic cache.
- **`Frontend/`**: React 19, Tailwind CSS, Vite, Lucide icons.

---

## 🛠️ Local Development Setup

### 1. Backend Setup
```bash
cd Backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Fill in GEMINI_API_KEY and JWT_SECRET in .env
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd Frontend
npm install
npm run dev
```

### 3. Docker Compose (Full Stack)
```bash
make up
# or: docker compose up --build
```

---

## 🌿 Semantic Commit Standards

Every commit must follow the **Conventional Commits** specification:

```
<type>(<scope>): <short imperative summary>
```

### Valid Types:
* `feat`: A new feature (e.g. `feat(rag): add adaptive chunking for complex academic PDFs`)
* `fix`: A bug fix (e.g. `fix(auth): handle JWT expiry edge case in websocket stream`)
* `perf`: Performance improvement (e.g. `perf(chromadb): tune HNSW ef_search for sub-150ms query latency`)
* `refactor`: Code reorganization with zero functional changes
* `docs`: Documentation updates, architecture diagrams, or benchmark data
* `test`: Adding missing unit tests or eval suites
* `ci`: GitHub Actions workflow changes

---

## 🧪 Testing & Evals

Before submitting a PR, verify all tests pass:

```bash
# Run backend test suite
cd Backend
pytest test_api.py -v --cov=.

# Run frontend build check
cd ../Frontend
npm run build
```

---

## 🚀 Pull Request Checklist

- [ ] Code passes automated test suite (`pytest`).
- [ ] Frontend builds without TypeScript / JSX compilation errors.
- [ ] No secrets or personal API keys committed (`.env` is in `.gitignore`).
- [ ] Commit history is clean with descriptive, semantic commit messages.
- [ ] Updated architecture documentation or API schemas if modifying contracts.
