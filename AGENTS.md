# StudyMate AI — Agent & Developer Operating Instructions

## 1. Project Identity & Mandate

You are working on **StudyMate AI**, a premium, AI-powered student productivity and learning application targeting **Android phones**.

### Strict Reset Rule
* This project is built **completely from scratch**.
* **NEVER** import, copy, reference, or depend on any previous legacy codebase, database, frontend, backend, or environment files.
* Build with clean, modern, idiomatic patterns.

---

## 2. Core Development Rules

### Rule 1: Phase-by-Phase Development (No Mega-Prompts)
* **Never attempt to implement the entire application at once.**
* Follow the phased sequence defined in [docs/PRODUCT_ROADMAP.md](file:///c:/Users/Anmol%20kumar/OneDrive/Desktop/StudyMate-AI-Android/docs/PRODUCT_ROADMAP.md).
* Implement one discrete slice or feature at a time (e.g., Auth, Semesters CRUD, Pomodoro, Flashcards).

### Rule 2: "Verify Before You Claim"
* **Never declare that a feature works unless its implementation and relevant automated tests confirm that it works.**
* Write unit, integration, and contract tests for every new endpoint and component.
* Execute the test suite and verify green status before marking any task as done.
* Do not claim a feature is implemented when it exists only in planning documents.

### Rule 3: Zero Mock Substitution in Production Code
* **Do not use fake, hardcoded in-memory mock data as a substitute for real production functionality.**
* If an endpoint is built, it must query the PostgreSQL database using SQLAlchemy.
* If a mobile screen displays data, it must query the backend API using TanStack Query.
* Mocks are permitted **only** inside automated test suites (`tests/`) to isolate external third-party APIs (like LLM providers).

### Rule 4: Lean, Simplified & Justified Architecture
* **Start with a modular monolith.**
* Do not introduce Redis, Celery, ARQ, MinIO, distributed caches, or complex microservices during initial phases unless a specific active feature explicitly mandates it.
* Design clean abstractions and interfaces (e.g., `JobQueueProtocol`, `StorageService`) so that asynchronous task brokers (Celery/Redis) and cloud object storage (S3/R2) can be slotted in later without breaking existing domain logic.
* Keep local development lightweight and responsive on standard development hardware (e.g., Windows laptop with 16 GB RAM).

### Rule 5: Cost & Resource Conscious AI Usage
* Optimize LLM prompt token counts. Use system instructions and structured schemas.
* AI models must remain **fully configurable** via backend environment variables (`PRIMARY_AI_PROVIDER`, `AI_MODEL_NAME`, `AI_API_KEY`).
* Default to cost-effective, verified currently available models (e.g., Google `gemini-3.1-flash-lite`, Google `gemini-3.8-flash`, or OpenAI `gpt-4o-mini`).
* Never assume a model is permanently free or universally available.

---

## 3. Technology Stack & Coding Standards

### 3.1 Mobile Client (React Native & Expo for Android)
* **Framework**: React Native with **verified current stable Expo SDK** (SDK 57+, targeting React Native 0.86+ and React 19.2+) and **Expo Router** (file-based routing).
* **Node.js Environment**: Node.js **20+ LTS** or **22+ LTS**.
* **Dependency Management**:
  * Initialize via `npx create-expo-app@latest`.
  * Always install Expo and React Native native packages using:
    ```bash
    npx expo install <package-name>
    ```
    This ensures that package versions match the installed Expo SDK's verified compatibility matrix.
  * Run `npx expo-doctor` frequently to audit and fix any peer dependency mismatches.
* **Language**: TypeScript with **strict mode enabled** (`noImplicitAny`, `strictNullChecks`).
* **State Management**:
  * Server State: **TanStack Query v5** (`@tanstack/react-query`).
  * Transient UI State: **Zustand**.
  * Persistent Storage: **React Native MMKV** (for app settings, themes) and **Expo SecureStore** (for JWT access/refresh tokens).
* **Styling & Design Tokens**: Adhere strictly to the design system outlined in [docs/UI_UX_GUIDELINES.md](file:///c:/Users/Anmol%20kumar/OneDrive/Desktop/StudyMate-AI-Android/docs/UI_UX_GUIDELINES.md). Always support Dark and Light themes.
* **Accessibility**: Minimum touch target of $48 \times 48\text{ dp}$. Support screen readers and dynamic font scaling.

### 3.2 Backend API (Python & FastAPI)
* **Runtime**: Python 3.12+.
* **Framework**: **FastAPI** with **Pydantic v2** for request/response validation.
* **Architecture**: Strict layered architecture within a modular monolith:
  $$\text{Router} \longrightarrow \text{Domain Service} \longrightarrow \text{Repository} \longrightarrow \text{SQLAlchemy Model}$$
* **Database**: **PostgreSQL 16+** accessed via **SQLAlchemy 2.0 Async** (`asyncpg` driver).
* **Migrations**: **Alembic**. Every schema change must have an accompanying migration script with a tested, reversible `downgrade()`.
* **Background Tasks (Initial)**: FastAPI native `BackgroundTasks` behind a clean service interface. Heavy distributed workers (Celery/Redis) will only be introduced when scaling requires it.
* **Typing & Linting**: 100% type-annotated code validated by `mypy --strict` and formatted/linted via `ruff`.

---

## 4. Security & Privacy Non-Negotiables

1. **Zero Client API Keys**:
   * The Android mobile application must **never** contain AI provider API keys, database credentials, or secret signing keys.
   * All AI interactions must pass through backend `/api/v1/ai/*` routes.
2. **Application-Level User Ownership Enforcement**:
   * Every database query that accesses student assets (notes, documents, tasks, flashcards, quizzes) must include `WHERE user_id = :current_user_id`.
   * Never query an entity by `id` alone.
   * Note the architectural distinction: this is **application-level ownership checking** enforced in the repository layer and verified via integration tests, distinct from PostgreSQL database-level Row-Level Security (RLS) policies.
3. **No Administrative Privileges via Public Registration**:
   * Self-registration endpoints must hard-code `role = 'student'`.
   * Administrator accounts can only be provisioned via backend CLI scripts or direct database seeding.
4. **Password & Token Security**:
   * Passwords must be hashed using **Argon2id**. Plaintext passwords must never be stored or logged.
   * Short-lived access tokens (15 minutes); high-entropy refresh tokens (30 days) rotated on each refresh.
   * On Android, tokens must be stored exclusively using **Expo SecureStore** (hardware-backed Android Keystore), never in plaintext `AsyncStorage`.
5. **Secure Document Ingestion**:
   * Minimum viable upload: Multipart upload directly to backend, validated by MIME type (`application/pdf`) and magic bytes (`%PDF-`), with strict 25MB file size limit.
   * Files stored outside the web root on local disk for development, switching to S3/Cloudflare R2 for production.
6. **Privacy-Aware Logging**:
   * Application logs must **never** contain passwords, tokens, full student note text, or PII.

---

## 5. Development Workflow for Coding Agents

When executing a coding task, follow this standard procedure:

```
1. READ SPECIFICATIONS
   └── Inspect docs/ (PROJECT_OVERVIEW, PRODUCT_REQUIREMENTS, ARCHITECTURE, etc.)
       to confirm data models, route contracts, and design tokens.

2. RUN ENVIRONMENT HEALTH CHECK
   └── Ensure PostgreSQL and automated tests pass before editing.

3. WRITE OR UPDATE DATA MODELS & MIGRATIONS
   └── If adding tables/fields, update SQLAlchemy models and generate an Alembic migration.

4. WRITE DOMAIN LOGIC & API ENDPOINTS
   └── Implement the repository, service, and FastAPI router with Pydantic validation.

5. IMPLEMENT AUTOMATED TESTS
   └── Write Pytest integration tests (including IDOR cross-tenant checks) and Jest/RNTL tests.

6. RUN TESTS & VERIFY
   └── Execute `pytest` and `npm test`. Assert that 100% of tests pass.

7. IMPLEMENT FRONTEND INTEGRATION
   └── Build the Expo Router screen/component using design tokens and TanStack Query.

8. VERIFY END-TO-END
   └── Test the screen in the Android emulator or via integration tests. Confirm edge states (loading, empty, error).
```

---

## 6. Document Reference Index

Before making changes in any area of the codebase, consult the authoritative documentation:
* [PROJECT_OVERVIEW.md](file:///c:/Users/Anmol%20kumar/OneDrive/Desktop/StudyMate-AI-Android/docs/PROJECT_OVERVIEW.md): Vision, personas, tech stack evaluation, and model comparisons.
* [PRODUCT_REQUIREMENTS.md](file:///c:/Users/Anmol%20kumar/OneDrive/Desktop/StudyMate-AI-Android/docs/PRODUCT_REQUIREMENTS.md): Functional specs for FR-01 through FR-20 and Admin tools, distinguishing V1 MVP from advanced features.
* [PRODUCT_ROADMAP.md](file:///c:/Users/Anmol%20kumar/OneDrive/Desktop/StudyMate-AI-Android/docs/PRODUCT_ROADMAP.md): Phased sequence, dependencies, and acceptance criteria.
* [ARCHITECTURE.md](file:///c:/Users/Anmol%20kumar/OneDrive/Desktop/StudyMate-AI-Android/docs/ARCHITECTURE.md): Modular monolith topology, client architecture, storage abstractions.
* [DATABASE_SCHEMA.md](file:///c:/Users/Anmol%20kumar/OneDrive/Desktop/StudyMate-AI-Android/docs/DATABASE_SCHEMA.md): DDL tables, indexes, ownership rules, and migration guidelines.
* [API_SPECIFICATION.md](file:///c:/Users/Anmol%20kumar/OneDrive/Desktop/StudyMate-AI-Android/docs/API_SPECIFICATION.md): Routes, payloads, envelopes, and SSE contracts.
* [UI_UX_GUIDELINES.md](file:///c:/Users/Anmol%20kumar/OneDrive/Desktop/StudyMate-AI-Android/docs/UI_UX_GUIDELINES.md): Tokens, typography, dark/light modes, animations, and touch targets.
* [SECURITY.md](file:///c:/Users/Anmol%20kumar/OneDrive/Desktop/StudyMate-AI-Android/docs/SECURITY.md): Threat models, Argon2id, IDOR tests, GDPR export/delete.
* [TESTING_PLAN.md](file:///c:/Users/Anmol%20kumar/OneDrive/Desktop/StudyMate-AI-Android/docs/TESTING_PLAN.md): Testing pyramid, Pytest fixtures, Jest, Maestro.
* [DEPLOYMENT_GUIDE.md](file:///c:/Users/Anmol%20kumar/OneDrive/Desktop/StudyMate-AI-Android/docs/DEPLOYMENT_GUIDE.md): Local PostgreSQL setup, EAS Android mobile builds, production roadmap.
