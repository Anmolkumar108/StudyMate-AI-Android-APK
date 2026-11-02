# StudyMate AI — Product Implementation Roadmap

## 1. Roadmap Strategy & Phasing Principles

To guarantee architectural integrity, stability, and high velocity without premature complexity, StudyMate AI is developed across **disciplined, sequential phases**. 

The implementation adheres to these core principles:
1. **Simplified Modular Monolith First**: Local infrastructure requires only PostgreSQL. Background jobs run via FastAPI's native `BackgroundTasks`, and file uploads store locally behind clean service interfaces. Distributed systems (Redis, Celery, cloud object storage) are deferred until scaling demands them.
2. **Prioritize V1 MVP Essentials**: Core student workflows (Auth, Academic taxonomy, Notes, Tasks, Timetable, Pomodoro, AI Chat, Flashcards) are built and hardened before layering advanced features (Quiz generator, Analytics heatmaps, Push notifications).
3. **No Mock Substitution**: Every feature must connect to real backend endpoints and persist to the real PostgreSQL database.
4. **Strict Phase Gate Verification**: A phase must pass all automated unit, integration, and security checks before downstream dependent phases begin.
5. **Clear Separation of Releases**: The Initial Android Release (Phases 0–7) must be completely delivered and verified before the Web Admin Panel (Phase 8) is developed.

---

## 2. Phase Overview Visual Map

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 0: Foundations, Infrastructure & Tooling Setup                  │
│          (FastAPI Scaffold, PostgreSQL, Expo SDK 57+ Scaffold)         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ Phase 1: Authentication, Profiles & Academic Taxonomy [V1 Essential]   │
│          (FR-01, FR-07, FR-19)                                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ Phase 2: Core Academic Productivity [V1 Essential]                     │
│          (FR-02, FR-08, FR-09, FR-11)                                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ Phase 3: Focus & Habit Engine [V1 Essential]                           │
│          (FR-12, FR-16 Base Analytics)                                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ Phase 4: Configurable AI Gateway & PDF Ingestion [V1 Essential]        │
│          (FR-03, FR-04, FR-05, FR-06 Minimum Viable Upload)            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ Phase 5: Active Recall & Mastery [V1 Essential + Advanced]             │
│          (FR-15 SM-2 Flashcards, FR-10, FR-13, FR-14 AI Quizzes)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ Phase 6: Push Notifications, Search & Advanced Analytics [V1 Advanced] │
│          (FR-16 Heatmap, FR-17 Push Alerts, FR-18 GIN Search)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ Phase 7: Privacy, Settings, Hardening & Android Release Candidate      │
│          (FR-20, Full E2E & IDOR Security Testing, EAS AAB Build)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
======================= [INITIAL ANDROID RELEASE] ========================
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ Phase 8: Web Admin Panel & Platform Governance                         │
│          (AR-01 through AR-06: Web Dashboard, Moderation, AI Budget)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ Phase 9: Future Enhancements (Post-V1)                                 │
│          (Cloudflare R2 Storage, Celery/Redis Workers, iOS Port)       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Phase Breakdown

### Phase 0: Foundations, Infrastructure & Tooling Setup
* **Goal**: Establish the repository monorepo structure, minimal local PostgreSQL database, base TypeScript mobile shell, and backend skeleton.
* **Key Deliverables**:
  1. Root repository layout: `/apps/mobile`, `/backend`, `/docs`.
  2. Local PostgreSQL 16 instance configured (native Windows service or lightweight single-service Docker container).
  3. FastAPI application scaffold with structured configuration (`pydantic-settings`), logging, and async database session manager (`asyncpg` + `SQLAlchemy 2.0`).
  4. Alembic initial migration runner.
  5. Expo React Native project scaffold initialized via `npx create-expo-app@latest` with verified stable dependencies (Expo SDK 57+, React Native 0.86+, React 19.2+, Expo Router, TypeScript strict mode).
  6. Expo Doctor verification: `npx expo-doctor` runs clean with zero dependency warnings.
* **Dependencies**: None.
* **Acceptance Criteria**:
  * PostgreSQL connects and runs the initial Alembic schema migration.
  * Backend health endpoint `GET /api/v1/health` returns `200 OK` with database status verified.
  * Expo app boots cleanly on Android emulator with zero runtime warnings.

---

### Phase 1: Authentication, Student Profiles & Academic Taxonomy [V1 Essential]
* **Features Covered**: FR-01 (Auth & Profiles), FR-07 (Semesters & Subjects), FR-19 (Dark/Light Mode).
* **Key Deliverables**:
  1. Backend Auth Router: `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/refresh`, `/api/v1/auth/logout`.
  2. Argon2id password hashing and rotating JWT access/refresh token logic.
  3. Strict role enforcement: Public signup hard-codes `role = 'student'`.
  4. Semesters & Subjects CRUD: Create semester, set active semester, add subjects with custom color tags and credit hours.
  5. Application-level ownership checks on all subject/semester queries (`WHERE user_id = :current_user_id`).
  6. Mobile Auth UI: Welcome screen, Login, Register, Forgot Password, Onboarding Profile Setup.
  7. Mobile Secure Storage: JWTs stored strictly in Expo SecureStore (Android Keystore).
  8. Mobile Theme Provider: AMOLED Dark mode / Light mode toggle persisted in MMKV.
* **Dependencies**: Phase 0.
* **Acceptance Criteria**:
  * User can register, receive JWT tokens, store tokens securely, and retrieve their protected profile.
  * User can create semesters and subjects; subjects are strictly isolated to the owning student.
  * Public registration endpoint rejects any attempts to register as administrator.

---

### Phase 2: Core Academic Productivity [V1 Essential]
* **Features Covered**: FR-02 (Dashboard Base), FR-08 (Notes Library), FR-09 (Tasks & Assignments), FR-11 (Timetable & Calendar).
* **Key Deliverables**:
  1. Notes API & UI: Rich markdown editor, note creation, subject association, local auto-save.
  2. Tasks API & UI: Create tasks with due dates, priority tags, subtask checklists, and completion toggle.
  3. Timetable API & UI: Recurring class schedule entries, weekly grid view, and unified daily agenda.
  4. Student Dashboard Aggregation: Summary endpoint (`GET /api/v1/dashboard/summary`) feeding today's schedule and urgent tasks.
* **Dependencies**: Phase 1.
* **Acceptance Criteria**:
  * Notes save with markdown formatting and render properly with KaTeX math equations.
  * Tasks update dynamically on the dashboard upon status change.
  * Timetable entries flag time conflicts during entry.

---

### Phase 3: Focus & Habit Engines [V1 Essential]
* **Features Covered**: FR-12 (Pomodoro Focus Timer), FR-16 (Base Study Hours Tracking).
* **Key Deliverables**:
  1. Backend Session Logging API: `/api/v1/study-sessions/log`, saving duration, subject ID, task ID, and timestamp.
  2. Mobile Pomodoro Screen: Circular animated countdown timer, Focus/Short Break/Long Break modes.
  3. Ambient audio player (offline rain, white noise, cafe sounds).
  4. Android background timer persistence using target epoch timestamp calculations.
  5. Dashboard Goal Ring integration: Circular progress bar updating with logged minutes.
* **Dependencies**: Phase 2.
* **Acceptance Criteria**:
  * Timer calculates remaining time accurately even if the app process is suspended or reopened.
  * Completed sessions increment the student's daily study minutes and update streak metrics.

---

### Phase 4: Configurable AI Gateway & PDF Ingestion [V1 Essential]
* **Features Covered**: FR-03 (AI Chat Assistant), FR-04 (Topic Explanations), FR-05 (AI Notes Generation), FR-06 (Minimum Viable Document Ingestion).
* **Key Deliverables**:
  1. Backend AI Gateway: Standardized adapter interface supporting configurable active models (Gemini 3.8 Flash / Gemini 3.1 Flash-Lite / GPT-4o mini) via backend environment variables.
  2. Minimum Viable Document Ingestion:
     * Multipart upload endpoint (`POST /api/v1/documents/upload`) saving to secure local storage (`uploads/documents/{user_id}/`).
     * Strict validation: MIME type (`application/pdf`), magic bytes (`%PDF-`), and 25MB file size limit.
     * FastAPI `BackgroundTasks` integration for non-blocking PDF text extraction and summarization.
     * Pluggable `StorageService` interface allowing seamless future migration to S3/Cloudflare R2.
  3. Streaming AI Chat: Server-Sent Events (SSE) endpoint (`/api/v1/ai/chat/stream`) with conversation history and Socratic mode.
  4. AI Explanation & Note Generation endpoints with Pydantic JSON validation.
  5. Mobile UI: PDF upload screen with progress bar, multi-turn chat screen with markdown/code syntax highlighting, and 1-tap "Save as Note".
* **Dependencies**: Phase 2, Phase 3.
* **Acceptance Criteria**:
  * PDF uploads, saves to local storage, and generates multi-format summaries asynchronously without blocking the API.
  * AI chat streams tokens with $< 1.5$s time-to-first-token.
  * Zero AI provider keys exist inside the mobile client binary.

---

### Phase 5: Active Recall & Mastery [V1 Essential + Advanced]
* **Features Covered**: FR-15 (Flashcards & SM-2) [Essential], FR-10 (Smart Study Planner) [Advanced], FR-13 (Exam Prep & Revision) [Advanced], FR-14 (AI Quiz Generation) [Advanced].
* **Key Deliverables**:
  1. Flashcard System: Deck management, SuperMemo SM-2 spaced repetition algorithm on card reviews.
  2. AI Quiz Generator: Generates MCQs, True/False, and Short Answer questions from notes or documents with full answer rationales.
  3. Exam Revision Planner: Exam countdown, AI-generated 3-phase revision schedule, and syllabus checklist.
  4. Smart Study Planner: Daily schedule recommendation balancing pending tasks with study targets.
  5. Mobile Flashcard & Quiz UI: 3D flip card animations, interactive quiz runner, detailed score breakdown.
* **Dependencies**: Phase 4.
* **Acceptance Criteria**:
  * Flashcard SM-2 algorithm correctly calculates next review intervals based on user ratings (1-4).
  * AI quiz generates valid questions that parse cleanly into Pydantic models with 100% schema compliance.
  * Missed quiz questions can be converted into flashcards with 1 tap.

---

### Phase 6: Push Notifications, Search & Advanced Analytics [V1 Advanced]
* **Features Covered**: FR-16 (Full Analytics Heatmap), FR-17 (Push Notifications), FR-18 (Global Full-Text Search).
* **Key Deliverables**:
  1. Push Notification Pipeline: Expo Notifications integrated with Android system notification channels for class alerts, deadline countdowns, and daily streak reminders.
  2. Notification Preference Center: Granular toggles in settings; quiet hours configuration.
  3. Full-Text Search: Backend PostgreSQL `tsvector` + GIN index search endpoint covering subjects, notes, PDFs, tasks, and flashcards with application-level tenant scoping.
  4. Advanced Analytics: 6-month consistency heatmap and quiz mastery line charts.
* **Dependencies**: Phase 5.
* **Acceptance Criteria**:
  * Notifications trigger reliably before class starts and when assignments approach deadlines.
  * Global search returns scoped results in $< 200$ms with matching terms highlighted.
  * Analytics heatmap accurately reflects historical Pomodoro logs.

---

### Phase 7: Privacy, Settings, Hardening & Android Release Candidate
* **Features Covered**: FR-20 (Privacy, Security & Settings), Complete Hardening.
* **Key Deliverables**:
  1. Security & Privacy Settings: Change password, biometric lock toggle, active sessions viewer.
  2. GDPR Compliance: Data export endpoint generating zipped archive; permanent account deletion cascading across all database records and local file storage.
  3. Automated IDOR Security Test Suite: 100% passing cross-tenant isolation tests.
  4. Android Performance Optimization: Hermes engine tuning, memory leak inspection, TalkBack accessibility audit.
  5. EAS Build Configuration: Production `.apk` and `.aab` builds signed with Android keystore.
* **Dependencies**: Phases 1 through 6.
* **Acceptance Criteria**:
  * Account deletion completely purges all user database rows and associated disk files.
  * App cold start achieves $< 1.2$s on target Android devices.
  * 100% test pass rate across backend pytest suite and mobile Jest tests.

---

### Phase 8: Web Admin Panel & Platform Governance (Post-Core)
* **Features Covered**: AR-01 through AR-06.
* **Key Deliverables**:
  1. Dedicated Web Dashboard (React + Vite / Tailwind CSS).
  2. Admin Auth & RBAC: Multi-factor authentication, `super_admin`, `support_admin`, `content_manager` roles.
  3. User Moderation: Search students, inspect account activity, suspend/reactivate with token revocation.
  4. AI Provider Management: Switch active LLM models, set daily token/cost caps, review API burn rates.
  5. System Audit Logs & Operational Health Monitoring.
* **Dependencies**: Phase 7 completion.
* **Acceptance Criteria**:
  * Public signups cannot access or grant admin roles.
  * Suspending a user immediately terminates their active mobile JWT sessions.

---

## 4. Phase Schedule & Release Mapping

| Phase | Description | Release Tier | Primary Deliverable |
| :---: | :--- | :---: | :--- |
| **Phase 0** | Foundations & Tooling | Infrastructure | Local Postgres, FastAPI & Expo scaffolds |
| **Phase 1** | Auth, Profiles & Academic Taxonomy | V1 Essential | Secure JWT Auth, Semesters & Subjects, Themes |
| **Phase 2** | Core Productivity Suite | V1 Essential | Notes, Tasks, Timetable, Dashboard |
| **Phase 3** | Focus & Habit Engine | V1 Essential | Pomodoro Timer, Background Persistence, Session Logs |
| **Phase 4** | Configurable AI & PDF Ingestion | V1 Essential | Streaming Chat, Local PDF Upload, Note Generator |
| **Phase 5** | Active Recall & Mastery | V1 Essential / Adv | Flashcards (SM-2), AI Quizzes, Exam Planner |
| **Phase 6** | Notifications, Search & Analytics | V1 Advanced | Android Push Alerts, GIN Search, Heatmap |
| **Phase 7** | Privacy, Hardening & Android Release | Release Candidate | GDPR Export/Delete, EAS Release AAB, Tests |
| **Phase 8** | Web Admin Panel | Post-Core | Governance Web UI, User Moderation, AI Budget |
| **Phase 9** | Future Enhancements | Post-V1 | S3/R2 Cloud Storage, Celery/Redis, iOS Port |
