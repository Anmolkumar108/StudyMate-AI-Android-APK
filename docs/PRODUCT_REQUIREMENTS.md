# StudyMate AI — Product Requirements Document (PRD)

## 1. Document Control & Scope Overview

This document specifies the complete functional and non-functional requirements for **StudyMate AI**. It encompasses all **20 student features** planned for the Android phone release, along with foundational specifications for the **Web Admin Panel** planned for post-core stability.

To ensure focused delivery, features are classified into:
* **[V1 Essential]**: Fundamental features required for a complete, delightful first release.
* **[V1 Advanced]**: Sophisticated capabilities built incrementally on top of the essential foundation.
* **[Phase 8 Admin]**: Administrative oversight and platform governance.

---

## 2. Student Feature Specifications (FR-01 through FR-20)

### FR-01: Authentication & Student Profiles [V1 Essential]
* **User Story**: As a student, I want to securely register and log in to my account, set up my academic profile (institution, major, year, study goals), so that my experience is personalized and my data is safe.
* **Functional Requirements**:
  1. Email and password registration with strict password strength validation (min 8 chars, uppercase, lowercase, number, special character).
  2. Argon2id password hashing on the backend.
  3. Short-lived JWT access tokens (15 minutes) and secure refresh tokens (30 days).
  4. Android Secure Storage: Tokens are saved strictly in **Expo SecureStore** (interfacing with Android Keystore), never in plaintext `AsyncStorage`.
  5. Student profile management: full name, avatar selection, institution name, major, graduation year, target daily study minutes.
  6. Biometric authentication (Fingerprint / Face Unlock via Expo LocalAuthentication) to resume local sessions.
* **Validation & Constraints**:
  * Email must be unique and RFC 5322 compliant.
  * Public registration defaults strictly to the `student` role; admin privileges can never be granted at signup.
* **Acceptance Criteria**:
  * Unauthenticated requests to protected routes return `401 Unauthorized`.
  * Public registration endpoint rejects attempts to specify `role = 'admin'` or `role = 'super_admin'`.
  * Biometric prompt seamlessly unlocks an existing active session.

---

### FR-02: Premium Student Dashboard [V1 Essential]
* **User Story**: As a student, I want a centralized dashboard showing my daily study progress, upcoming classes, due assignments, and quick actions so I can immediately focus on what matters today.
* **Functional Requirements**:
  1. **Greeting & Dynamic Streak Counter**: Displays consecutive study days with a visual flame icon.
  2. **Daily Goal Ring**: Progress circle tracking completed focus minutes vs. daily goal.
  3. **Today's Schedule Widget**: Cards for today's classes and planned study blocks sorted chronologically.
  4. **Upcoming Deadlines Widget**: Tasks due within the next 48 hours with countdown tags.
  5. **Quick Action Hub**: 1-tap shortcuts: "Start Pomodoro", "Ask AI Tutor", "Upload PDF", "Add Task", "Review Flashcards".
  6. **Recent Activity**: Quick resume cards for recently accessed notes and flashcard decks.
* **Validation & Constraints**:
  * Dashboard data is retrieved via an aggregated endpoint (`GET /api/v1/dashboard/summary`) to prevent mobile waterfall requests.
  * Pull-to-refresh support with shimmer skeleton loading states.
* **Acceptance Criteria**:
  * Screen renders skeleton placeholders within 100ms and loads data cleanly.
  * Tapping any schedule or task card navigates directly to its detail screen.

---

### FR-03: AI Chat Assistant [V1 Essential]
* **User Story**: As a student, I want to converse with an AI study tutor that can explain complex academic concepts, answer specific course questions, and provide guided hints.
* **Functional Requirements**:
  1. Multi-turn conversational interface with markdown rendering (math formulas via KaTeX, code blocks with syntax highlighting, bullet points).
  2. Context grounding: Students can scope chat to a specific enrolled subject.
  3. Socratic Tutoring Mode toggle: When enabled, the AI asks probing questions to help the student derive answers rather than spoon-feeding complete solutions.
  4. Conversation persistence: Saved chat threads with rename, archive, and delete options.
  5. Streaming responses: AI tokens stream via Server-Sent Events (SSE) for low perceived latency.
  6. Actions: 1-tap "Save message as Study Note".
* **Validation & Constraints**:
  * Zero AI API keys in the Android app. All calls route through `/api/v1/ai/chat/stream`.
  * Configurable AI provider backend (e.g., Gemini 3.8 Flash, Gemini 3.1 Flash-Lite, or GPT-4o mini).
* **Acceptance Criteria**:
  * Streaming begins within 1.5 seconds under normal network conditions.
  * Socratic mode guides through questions rather than dumping full solutions.

---

### FR-04: AI Topic Explanations [V1 Essential]
* **User Story**: As a student, I want to input any difficult academic topic and receive structured explanations at varying difficulty levels so that I can bridge gaps in my understanding.
* **Functional Requirements**:
  1. Topic inquiry with adjustable parameters:
     * **Depth Level**: "Explain like I'm 5 (Feynman technique)", "High School Level", "Undergraduate Academic", or "Deep Technical/Expert".
     * **Format**: Conceptual breakdown, Real-world analogies, or Worked examples.
  2. Key Takeaways bullet list and auto-generated "Self-check Comprehension Question".
  3. 1-tap action: "Save as Note" or "Generate Flashcards from this Explanation".
* **Validation & Constraints**:
  * Topic input limited to 300 characters; backend enforces prompt injection safety boundaries.
* **Acceptance Criteria**:
  * Explanation matches the selected depth level accurately.
  * 1-tap export creates a linked note under the selected subject.

---

### FR-05: AI Notes Generation [V1 Advanced]
* **User Story**: As a student, I want the AI to transform raw lecture transcripts, rough scribbles, or bullet points into structured, beautifully formatted Cornell notes or study guides.
* **Functional Requirements**:
  1. Input methods: Raw text paste, voice-to-text transcript, or an uploaded course document.
  2. Output formats supported:
     * **Cornell Notes Format**: Cue column/keywords, main lecture notes, and summary block.
     * **Executive Summary**: High-level synthesis with key terminology.
     * **Actionable Study Guide**: Definitions, core formulas, worked examples, and likely exam questions.
  3. Note editor integration: Generated notes can be manually edited and annotated.
* **Validation & Constraints**:
  * Raw input text capped at 25,000 characters per single synchronous generation.
* **Acceptance Criteria**:
  * Generated notes accurately reflect source input without fabricating unsupported claims.
  * Notes are saved with complete rich-text representation and plaintext fallback.

---

### FR-06: PDF Upload & Document Summarization [V1 Essential & Scalable]
* **User Story**: As a student, I want to upload my lecture slide PDFs and course readings to generate concise summaries and review them on my phone.
* **Functional Requirements**:
  1. **Minimum Viable Ingestion (Local Development)**:
     * Mobile client uploads PDF via multipart/form-data directly to `POST /api/v1/documents/upload`.
     * Backend validates MIME type (`application/pdf`) and magic bytes (`%PDF-`), enforces a 25MB file size limit, and saves the file to a secure local folder (`uploads/documents/{user_id}/{doc_id}.pdf`) outside the web root.
     * Background text extraction and summarization executes via FastAPI's `BackgroundTasks`.
  2. **Production Storage Architecture (Scalable)**:
     * A `StorageService` interface abstracts file storage:
       - `LocalStorageBackend` for local development.
       - `S3StorageBackend` (Cloudflare R2 / AWS S3) for production environments.
  3. **Access Control**:
     * Uploaded documents are private; they are served only through authenticated routes (`GET /api/v1/documents/{id}/file`) verifying `user_id == current_user.id`.
  4. Multi-mode Summaries:
     * **TL;DR**: 3-sentence summary for quick review.
     * **Key Concepts**: Bullet points of critical ideas.
     * **Glossary**: Extracted definitions of technical jargon.
* **Validation & Constraints**:
  * Strict file type validation: MIME type `application/pdf` and magic byte verification (`%PDF-`).
  * File size strictly capped at 25MB.
* **Acceptance Criteria**:
  * Uploading a valid PDF generates a document record, extracts text, and produces summaries.
  * Attempting to upload non-PDF files or files exceeding 25MB returns `400 Bad Request`.

---

### FR-07: Subject & Semester Management [V1 Essential]
* **User Story**: As a student, I want to organize my academic life by semesters and individual subjects with custom color tags and credit hours.
* **Functional Requirements**:
  1. **Semester Management**: Create semesters (e.g., "Fall 2026") with start/end dates, mark "Current Active Semester".
  2. **Subject Management**: Create subjects linked to a semester (e.g., "CS 301 - Algorithms").
  3. Metadata per subject: Course code, subject name, instructor name/email, credit hours, color code (from curated 8-color palette), and icon.
  4. Archive past semesters to keep the active dashboard clean while preserving historical materials.
* **Validation & Constraints**:
  * Only one semester can be designated as "Current Active" at any time.
  * Application-level check: Students can only read, edit, or delete subjects they own.
* **Acceptance Criteria**:
  * Archiving a semester removes its subjects from the active dashboard while keeping them searchable.

---

### FR-08: Notes & Document Library [V1 Essential]
* **User Story**: As a student, I want a centralized library to create, organize, and read my personal notes and course materials.
* **Functional Requirements**:
  1. Organization: Browse by Semester $\rightarrow$ Subject $\rightarrow$ Folder/Tag.
  2. Note creation: Markdown/rich-text editor supporting headings, bold/italic, lists, checkboxes, blockquotes, code blocks, and math equations (KaTeX).
  3. Favorite/pin important notes to the top of subject feeds.
  4. Local autosaving to prevent data loss on sudden app termination.
* **Validation & Constraints**:
  * Note content autosaves locally within 2 seconds of user typing cessation and syncs when online.
* **Acceptance Criteria**:
  * Notes render formatting and math equations properly.
  * Offline-created notes sync reliably upon network restoration.

---

### FR-09: Tasks & Assignment Management [V1 Essential]
* **User Story**: As a student, I want to track assignments and homework with due dates and priority levels so I never miss a deadline.
* **Functional Requirements**:
  1. Task creation: Title, description, associated Subject, due date/time, priority (Low, Medium, High, Urgent), estimated minutes.
  2. Task categorization: "To Do", "In Progress", "Completed", "Overdue".
  3. Subtask checklist items inside individual tasks.
  4. Sorting and filtering by due date, priority, or subject.
  5. 1-tap completion with celebratory haptic feedback.
* **Validation & Constraints**:
  * Due dates in the past are permitted but flagged with an "Overdue" status badge.
* **Acceptance Criteria**:
  * Marking a task complete updates the daily dashboard productivity score.
  * Overdue tasks display distinct warning indicators.

---

### FR-10: Smart Study Planner [V1 Advanced]
* **User Story**: As a student, I want an AI-assisted study planner that balances my available study hours and upcoming deadlines to create an achievable daily study agenda.
* **Functional Requirements**:
  1. Workload calculator: Analyzes pending assignments, upcoming exams, and student daily study targets.
  2. Plan Generation: Produces a prioritized daily schedule allocating 30/45/60-minute blocks to high-urgency subjects.
  3. Spaced review recommendations based on forgetting curve intervals.
  4. "Rebalance" action: Shifts pending blocks without breaking consistency if a student falls behind.
* **Validation & Constraints**:
  * Total planned study hours per day cannot exceed the student's configured daily maximum limit.
* **Acceptance Criteria**:
  * Planner produces a conflict-free study schedule with visual time blocks.

---

### FR-11: Timetable & Calendar [V1 Essential]
* **User Story**: As a student, I want to view my weekly class schedule alongside assignment due dates in a unified calendar.
* **Functional Requirements**:
  1. **Weekly Timetable Grid**: Configurable recurring classes with room number, professor, and color-coded subject tags.
  2. **Calendar Views**: Toggle between "Day View", "3-Day View", and "Week View".
  3. Unified events: Displays classes (subject color) and assignment deadlines (urgency color).
  4. Tap event to view details or linked subject notes.
* **Validation & Constraints**:
  * Overlapping class intervals trigger visual warnings during entry.
* **Acceptance Criteria**:
  * Weekly grid renders smoothly with proper Android touch scrolling.
  * Day view highlights the current real-time horizontal time indicator.

---

### FR-12: Pomodoro Focus Timer [V1 Essential]
* **User Story**: As a student, I want a dedicated Pomodoro focus timer linked to my subjects and tasks so that I can maintain deep focus and log my actual study hours.
* **Functional Requirements**:
  1. Standard modes: Focus (25 min), Short Break (5 min), Long Break (15 min) with customizable durations.
  2. Metadata tagging: Link session to a specific Subject and optional Task.
  3. Visual feedback: Clean countdown timer, circular progress ring.
  4. Ambient audio generator: Offline white noise, rain, and library ambiance sounds.
  5. Background persistence: Timer continues running if the app is minimized; uses Android native notification when time expires.
  6. Session logging: Logs exact minutes studied to the backend for analytics tracking.
* **Validation & Constraints**:
  * Interrupted sessions prompt: "Log partial time (X mins) or Discard?".
* **Acceptance Criteria**:
  * Background timer accurately calculates elapsed time using target epoch timestamps.
  * Successfully logged sessions immediately reflect on Dashboard Goal Ring.

---

### FR-13: Exam Preparation & Revision Planning [V1 Advanced]
* **User Story**: As a student, I want to register an upcoming exam, map out syllabus modules, and follow a structured revision countdown.
* **Functional Requirements**:
  1. Exam registration: Subject, exam name, date/time, location, target grade, and syllabus topics list.
  2. Exam countdown banner displayed prominently on the dashboard.
  3. **Revision Phase Generator**: AI divides remaining days into 3 phases:
     * Phase 1: Comprehension & Note Review.
     * Phase 2: Active Recall & Flashcard Drilling.
     * Phase 3: Timed Practice Quizzes.
  4. Syllabus completion checklist: Check off individual topics as mastered.
* **Validation & Constraints**:
  * Exam date must be in the future.
* **Acceptance Criteria**:
  * Displays accurate days/hours countdown.
  * Checkoff progress automatically updates exam readiness percentage.

---

### FR-14: AI Quiz Generation [V1 Advanced]
* **User Story**: As a student, I want to generate custom quizzes from my notes or uploaded PDFs to test my knowledge under realistic test conditions.
* **Functional Requirements**:
  1. Quiz configuration:
     * Question types: Multiple Choice (MCQ), True/False, Short Answer.
     * Question count: 5, 10, 15, or 20 questions.
     * Source: Select Subject, specific Note, or uploaded document.
  2. Interactive test environment:
     * Question cards with progress bar and optional timer.
  3. Comprehensive Results Review:
     * Score percentage and time spent.
     * Question-by-question breakdown with detailed AI explanations for correct and incorrect answers.
     * 1-tap "Save Missed Questions as Flashcards".
* **Validation & Constraints**:
  * Backend enforces strict Pydantic JSON schema output from the AI provider.
* **Acceptance Criteria**:
  * Quizzes generate valid questions with exactly one unambiguous correct answer for MCQs.
  * Score and missed questions log into user analytics.

---

### FR-15: Flashcards & Spaced Repetition (SRS) [V1 Essential]
* **User Story**: As a student, I want to review flashcards using an intelligent spaced repetition algorithm (SuperMemo SM-2) so that I retain information with minimal review time.
* **Functional Requirements**:
  1. Flashcard Deck management: Decks organized by Subject and Topic.
  2. Creation methods:
     * Manual creation: Front (prompt) and Back (answer) with markdown support.
     * AI Auto-generation: Generate flashcards from a note or document in one click.
  3. Active Recall Study Session:
     * Flip card animation (3D card rotation).
     * Rating buttons (SM-2 standard): "Again", "Hard", "Good", "Easy".
  4. Algorithm scheduling:
     * Dynamically calculates Next Review Date, Interval, and Ease Factor based on student response.
     * "Due Today" counter badge on deck cards.
* **Validation & Constraints**:
  * Cards due today are presented before new unstudied cards.
* **Acceptance Criteria**:
  * Rating a card correctly schedules its subsequent appearance according to SM-2 mathematical rules.
  * Review progress is saved after each card.

---

### FR-16: Study Analytics & Progress Tracking [V1 Essential (Base) / Advanced (Heatmap)]
* **User Story**: As a student, I want to see visual analytics of my study hours, subject time distribution, and consistency streaks to stay motivated.
* **Functional Requirements**:
  1. **Time Breakdown [Essential]**: Daily and weekly charts showing hours studied.
  2. **Subject Distribution [Essential]**: Visual percentage of time spent per subject.
  3. **Productivity Metrics [Essential]**: Total focus hours, flashcards reviewed, current streak.
  4. **Consistency Heatmap [Advanced]**: Activity grid showing study intensity per day over the past 3-6 months.
  5. **Quiz Mastery Curve [Advanced]**: Line chart tracking quiz score trends over time.
* **Acceptance Criteria**:
  * Base charts render cleanly and display accurate aggregated Pomodoro logs.

---

### FR-17: Push Notifications & Reminders [V1 Advanced]
* **User Story**: As a student, I want to receive timely notifications for class schedules, assignment deadlines, and daily study reminders so I stay on track.
* **Functional Requirements**:
  1. Notification triggers:
     * Upcoming class reminder (e.g., 15 minutes before lecture).
     * Assignment deadline reminder (24 hours and 2 hours before due time).
     * Daily study habit reminder.
  2. Delivery: Expo Notifications integrated with Android system notification channels.
  3. Notification preferences center: Granular toggles to enable/disable categories; quiet hours scheduling.
* **Acceptance Criteria**:
  * Tapping a notification deep-links directly to the relevant screen.
  * No notifications fire during configured quiet hours.

---

### FR-18: Global & Scoped Search [V1 Advanced]
* **User Story**: As a student, I want to search across all my subjects, notes, PDFs, assignments, and flashcards from a single search bar.
* **Functional Requirements**:
  1. Unified search input with categorized result tabs ("All", "Notes", "Tasks", "Flashcards").
  2. Highlighting query term in preview snippets.
  3. Backend full-text search powered by PostgreSQL `tsvector` and `GIN` indexes.
* **Validation & Constraints**:
  * Application-level check: Search queries are strictly scoped to `user_id == current_user.id`.
* **Acceptance Criteria**:
  * Search queries return relevant matches within 200ms.

---

### FR-19: Dark Mode & Light Mode System [V1 Essential]
* **User Story**: As a student, I want to switch between dark and light themes so that reading is comfortable during daytime lectures and late-night study sessions.
* **Functional Requirements**:
  1. Three selectable modes: "System Default", "Pure Dark (AMOLED friendly)", and "Clean Light".
  2. Cohesive design token usage across surfaces, text, borders, and status badges.
  3. High contrast compliance (WCAG 2.1 AA standard).
  4. Instantaneous theme switching without application reload.
* **Validation & Constraints**:
  * Preference stored in MMKV for zero-flicker startup.
* **Acceptance Criteria**:
  * Dark mode uses deep black surfaces (`#0B0F19`, `#131B2E`) to conserve battery on Android OLED screens.

---

### FR-20: Privacy, Security & Application Settings [V1 Essential]
* **User Story**: As a student, I want complete control over my account, data privacy, and security settings so that I trust StudyMate AI with my personal academic work.
* **Functional Requirements**:
  1. **Security Settings**:
     * Change password with old password verification.
     * Biometric lock toggle (require fingerprint on app open).
     * Active sessions view with "Log out of all devices".
  2. **Data Privacy & GDPR Controls**:
     * **Data Export [Advanced]**: 1-tap request to export all user data as a downloadable archive.
     * **Account Deletion [Essential]**: Permanent self-serve account deletion with password confirmation; triggers cascading hard-deletion of all user data and files.
  3. **Application Preferences**: Default Pomodoro durations, week start day.
* **Acceptance Criteria**:
  * Account deletion completely purges all user database records and associated uploaded files.

---

## 3. Web Admin Panel Requirements (Phase 8 - Post-Core)

* **AR-01: Secure Administrator Authentication & RBAC**: Admin login with MFA; roles: `super_admin`, `support_admin`, `content_manager`. Zero public signup.
* **AR-02: User Management & Moderation**: View student accounts, suspend/reactivate accounts with immediate token revocation.
* **AR-03: AI Provider Configuration & Budget Limits**: Configure active AI provider model, set daily/monthly budget caps, monitor token burn rates.
* **AR-04: System Analytics & Operational Health**: Aggregate platform metrics (DAU/MAU, total focus hours, error rates).
* **AR-05: Learning Content Management**: Curate subject templates and broadcast maintenance announcements.
* **AR-06: Comprehensive Audit Logs**: Tamper-evident operational audit trail.

---

## 4. Non-Functional Requirements (NFR)

| Category | Requirement Specification |
| :--- | :--- |
| **Performance** | Mobile app cold start $< 1.2$s on mid-tier Android devices. Screen animations at 60 fps. API responses $< 200$ms ($p95$) excluding AI generation. |
| **Scalability** | Modular monolith design with decoupled service interfaces allowing horizontal scaling and cloud object storage integration without architectural rewrite. |
| **Reliability** | 99.9% API uptime target. Native background task handling for async jobs. |
| **Battery & Data** | Background timers use Android native epoch calculations to prevent CPU wake-lock battery drain. |
| **Accessibility** | Minimum touch target size $48 \times 48\text{ dp}$. Dynamic font scaling support. High contrast ratio compliance (WCAG 2.1 AA). TalkBack accessibility labels. |
| **Security** | Zero API keys in mobile code. Argon2id password hashing. Application-level user ownership verification on every database query. |
