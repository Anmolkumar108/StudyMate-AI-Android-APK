# StudyMate AI — Project Overview & Architectural Foundation

## 1. Executive Summary

**StudyMate AI** is a premium, AI-powered student productivity, study planning, and learning companion mobile application designed specifically for **Android phones**. The application integrates modern cognitive science principles (spaced repetition, active recall, Pomodoro focus timeboxing) with state-of-the-art Generative AI capabilities to provide students with an intelligent, personalized academic workspace.

Unlike fragmented study utilities (separate calendar, generic notes, isolated flashcard apps, ungrounded chatbots), StudyMate AI centralizes the student's entire academic lifecycle:
* Academic structure (semesters, courses/subjects, syllabus schedules).
* Document and note intelligence (PDF ingestion, automatic multi-format summarization, concept explanations, note generation).
* Active learning systems (automated flashcard creation, adaptive quiz generation, spaced repetition scheduling).
* Focus and task management (Pomodoro timers tied to specific subjects, assignments, and exam revision targets).
* Longitudinal analytics (focus heatmaps, subject time distributions, quiz mastery trends).

The project is initiated with a clean-slate architecture, uncompromising code quality, privacy-first data governance, and strict backend-enforced security.

---

## 2. Mission & Product Vision

### 2.1 Mission Statement
Empower students of all disciplines to master complex subjects faster, reduce academic anxiety, and optimize study habits through an intelligent, unified, and distraction-free mobile assistant.

### 2.2 Core Value Propositions
1. **Context-Aware Study Intelligence**: The AI assistant grounds its explanations, summaries, and flashcards in the student's actual enrolled subjects, lecture notes, and uploaded course materials.
2. **Unified Academic Workflow**: Tasks, timetables, study sessions, and revision plans are interconnected. Studying for an upcoming exam automatically draws from uploaded notes, suggests Pomodoro sessions, and schedules spaced flashcard reviews.
3. **Frictionless Mobile-First Experience**: Built natively for Android using React Native and Expo, delivering sub-second screen transitions, offline caching, smooth 60fps animations, and native system integration (push notifications, status bars, back-button handling).
4. **Bank-Grade Data Privacy & Integrity**: Student intellectual property and personal notes are safeguarded with strict application-level user ownership checks, zero client-exposed API keys, secure document storage, and full compliance with student data privacy standards (including full data export and account deletion).

---

## 3. Target User Personas

| Persona | Academic Level | Primary Pain Points | Key StudyMate AI Solutions |
| :--- | :--- | :--- | :--- |
| **Priya (Undergrad STEM)** | B.Tech Computer Science (Year 2) | Dense technical PDFs, difficult coding concepts, multiple overlapping lab assignments, disorganized lecture notes. | PDF document summarizer, AI concept explainer with code formatting, Pomodoro session tracker tied to specific course modules, automated quiz generation. |
| **Marcus (Medical / Pre-Med)** | MBBS / Biology Major | High volume of anatomical and biochemical facts to memorize; high burnout risk. | Spaced repetition flashcards, automated quiz generation from lecture slides, exam revision countdown planner, detailed study analytics. |
| **Elena (High School Senior)** | Grade 12 / AP & IB Student | Balancing exam board prep with daily homework, lack of structured study discipline. | Smart study planner, weekly timetable, assignment deadlines with automated push reminders, light/dark mode ergonomics for late-night study. |
| **David (Postgrad / Business)** | MBA Candidate | Limited study time while managing projects; needs rapid synthesis of 50-page case studies. | AI notes generation, executive bulleted document summaries, cross-document semantic search. |

---

## 4. Scope Boundaries & Release Strategy

To ensure sustainable development, high reliability, and clear operational cost control, the project follows a disciplined phased scope:

```
[Phases 0 - 7: Android Phone Release Candidate]
  │  • Full Student Suite (FR-01 through FR-20, prioritized by V1 MVP essentials)
  │  • Modular Monolith FastAPI Backend + PostgreSQL Database
  │  • Abstracted Backend AI Gateway & Pluggable File Storage
  ▼
[Phase 8: Web Admin Panel & Platform Governance]
  │  • Separate Web Dashboard (React / Vite or Next.js)
  │  • User Management, Account Suspension, Role-Based Access Control
  │  • AI Provider Rate/Cost/Budget Monitoring & System Audit Logs
  ▼
[Phase 9: Future Enhancements / Post-V1]
     • Tablet & Foldable responsive layouts
     • Cross-platform iOS release
     • Collaborative study groups & shared peer decks
     • Heavy distributed task queues (Celery/Redis) if traffic warrants
```

---

## 5. Technology Stack Evaluation & Architectural Adjustments

### 5.1 Technology Stack Evaluation Matrix

| Layer | Proposed Component | Evaluation & Architectural Adjustments |
| :--- | :--- | :--- |
| **Mobile App** | React Native with Expo (TypeScript) | **Accepted with Verified Stack**. Use the verified current stable **Expo SDK 57+** (targeting React Native 0.86+ and React 19.2+ with Expo Router). Initialize via `npx create-expo-app@latest` and install native packages via `npx expo install` to guarantee dependency harmony. Use **Zustand** for transient UI state, **TanStack Query v5** for server caching, **React Native MMKV** for persistent settings, and **Expo SecureStore** for JWT storage. |
| **Backend API** | Python with FastAPI | **Accepted**. High-performance asynchronous REST framework with native Pydantic v2 validation. Structured as a **modular monolith** with clean service interfaces. Runs on Python 3.12+. |
| **Database** | PostgreSQL | **Accepted**. Target **PostgreSQL 16+** with `asyncpg` async driver. For local Windows development, Native PostgreSQL or minimal single-container Docker Compose is selected based on environment inspection. |
| **ORM & Migrations** | SQLAlchemy & Alembic | **Accepted**. SQLAlchemy 2.0 async-first declarative mapping (`Mapped[...]`, `mapped_column(...)`). Deterministic migrations via Alembic with reversible `downgrade()`. |
| **Background Tasks** | *FastAPI Native Tasks (Initial)* | **Simplified for Initial Phases**. Initial async operations (text extraction, AI calls) use FastAPI's built-in `BackgroundTasks` behind an abstract service interface (`TaskQueueInterface`). Avoids requiring Redis/Celery immediately, keeping local development light on a 16 GB RAM laptop. |
| **File Storage** | *Pluggable Storage Service* | **Phased & Simplified**. For local development, documents upload to a secured local directory (`uploads/documents/`) outside the web root. A `StorageService` interface abstracts file storage so production S3/Cloudflare R2 storage can be configured via environment variables. |
| **AI Gateway** | Configurable Backend AI Adapter | **Accepted & Verified**. Zero AI keys in mobile client. The backend abstracts external LLMs behind a standardized interface with runtime configuration via environment variables. |
| **Web Admin Panel** | Separate Web Application | **Accepted**. Deferred to Phase 8 after core mobile application and backend are stable and verified. |

---

## 6. AI Model Evaluation & Official Verification

Gemini 1.5 Flash is no longer available in the active provider lineup. To maintain high educational performance, low latency, and predictable costs, the backend AI Gateway is designed to support verified active models from Google and OpenAI:

### 6.1 Officially Verified Available Models

| Model Identifier | Provider | Input Price (per 1M tokens) | Output Price (per 1M tokens) | Context Window | Best Suited Tasks |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`gemini-3.1-flash-lite`** | Google | **\$0.25** | **\$1.50** | 1,000,000 | High-throughput conversational chat, flashcard generation, fast terminology lookup. *(Recommended starting model for maximum economy)* |
| **`gemini-3.8-flash`** | Google | **\$0.75** (Promo) / \$1.50 (Std) | **\$3.75** (Promo) / \$7.50 (Std) | 1,000,000 | In-depth academic topic explanations, multi-page lecture PDF summarization, built-in STEM reasoning. |
| **`gpt-4o-mini`** | OpenAI | **\$0.15** | **\$0.60** | 128,000 | Structured quiz generation (strict JSON outputs), Cornell note structuring, study plan rebalancing. |
| **`gpt-4o`** | OpenAI | **\$2.50** | **\$10.00** | 128,000 | Complex academic proofs, multi-step code tutoring, advanced practice exam generation. |

### 6.2 Availability & Pricing Verification Notes
* **Verified**: Model identifiers, context window capacities, and pay-as-you-go token pricing are verified directly from official Google AI Studio and OpenAI developer documentation.
* **Unverified / Account-Dependent Limitations**:
  * Free-tier availability, requests-per-minute (RPM), and daily limits vary dynamically based on the individual developer's account tier, billing verification status, and geographical region.
  * OpenAI does not offer a perpetual free-tier API key; an initial credit balance or payment method is required.
  * Google AI Studio offers promotional/experimental free tiers, but production SLAs require a linked Google Cloud billing account.
* **Architecture Mitigation**: Because pricing and quotas vary, StudyMate AI **never hardcodes an AI provider or model**. The backend uses environment variables (`PRIMARY_AI_PROVIDER`, `AI_MODEL_NAME`, `AI_API_KEY`), allowing instant model switches without code deployment.

---

## 7. Core Architectural Principles

1. **Defense-in-Depth & Zero-Trust Client**:
   * The Android mobile application is treated as an untrusted public client.
   * All authorization, data ownership checks, file validation, rate limiting, and business logic are enforced strictly by the FastAPI backend.
   * The mobile binary contains zero AI API keys or database credentials.

2. **Application-Level User Ownership vs. Database RLS**:
   * Every query touching user data filters unconditionally by the authenticated `user_id` at the application layer (`WHERE user_id = :current_user_id`).
   * This is distinguished from database-level PostgreSQL Row-Level Security (RLS); application-level checks in the repository layer form our primary, test-verified security boundary.

3. **Modular Monolith Architecture**:
   * The backend starts as a clean, cohesive modular monolith. Heavy infrastructure components (Redis, Celery, MinIO) are deferred until an active feature demands them, keeping development on a 16 GB RAM laptop fluid and straightforward.
   * Clear domain interfaces guarantee that distributed queues or cloud object storage can be introduced seamlessly in future phases.

4. **Offline Awareness & Optimistic UI**:
   * Mobile users frequently study in environments with poor connectivity (libraries, lecture halls).
   * Core study materials (flashcards, notes, timetable) are cached locally using TanStack Query and MMKV to allow offline reading and review.

---

## 8. Document Reference Index

* [PRODUCT_REQUIREMENTS.md](file:///c:/Users/Anmol%20kumar/OneDrive/Desktop/StudyMate-AI-Android/docs/PRODUCT_REQUIREMENTS.md): Functional specs for FR-01 through FR-20, distinguishing V1 essentials from advanced features.
* [PRODUCT_ROADMAP.md](file:///c:/Users/Anmol%20kumar/OneDrive/Desktop/StudyMate-AI-Android/docs/PRODUCT_ROADMAP.md): Phased implementation sequence with milestones and acceptance criteria.
* [ARCHITECTURE.md](file:///c:/Users/Anmol%20kumar/OneDrive/Desktop/StudyMate-AI-Android/docs/ARCHITECTURE.md): Component diagrams, data flow pipelines, and client/backend architecture.
* [DATABASE_SCHEMA.md](file:///c:/Users/Anmol%20kumar/OneDrive/Desktop/StudyMate-AI-Android/docs/DATABASE_SCHEMA.md): Complete DDL tables, relationships, indexes, and migration policies.
* [API_SPECIFICATION.md](file:///c:/Users/Anmol%20kumar/OneDrive/Desktop/StudyMate-AI-Android/docs/API_SPECIFICATION.md): Routes, payloads, envelopes, and SSE contracts.
* [UI_UX_GUIDELINES.md](file:///c:/Users/Anmol%20kumar/OneDrive/Desktop/StudyMate-AI-Android/docs/UI_UX_GUIDELINES.md): Tokens, typography, dark/light themes, and Android-specific design patterns.
* [SECURITY.md](file:///c:/Users/Anmol%20kumar/OneDrive/Desktop/StudyMate-AI-Android/docs/SECURITY.md): Threat models, Argon2id, IDOR tests, GDPR export/delete.
* [TESTING_PLAN.md](file:///c:/Users/Anmol%20kumar/OneDrive/Desktop/StudyMate-AI-Android/docs/TESTING_PLAN.md): Testing pyramid, Pytest fixtures, Jest, Maestro.
* [DEPLOYMENT_GUIDE.md](file:///c:/Users/Anmol%20kumar/OneDrive/Desktop/StudyMate-AI-Android/docs/DEPLOYMENT_GUIDE.md): Local PostgreSQL setup, EAS mobile builds, and production roadmap.
* [AGENTS.md](file:///c:/Users/Anmol%20kumar/OneDrive/Desktop/StudyMate-AI-Android/AGENTS.md): Strict development instructions for future coding agents.
