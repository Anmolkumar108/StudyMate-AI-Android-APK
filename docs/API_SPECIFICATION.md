# StudyMate AI — REST API & SSE Specification

## 1. Architectural Standards & Conventions

### 1.1 Base URL & Versioning
All StudyMate AI endpoints are strictly versioned under the `/api/v1` namespace:
```
https://api.studymate.ai/api/v1
```

### 1.2 Common HTTP Headers
* `Content-Type: application/json` (or `multipart/form-data` for file uploads, `text/event-stream` for AI chat)
* `Authorization: Bearer <access_token>` (for all authenticated routes)
* `X-Request-ID: <uuid>` (traceability correlation identifier)

### 1.3 Uniform Envelope & Response Structure
All successful standard JSON responses conform to the standard payload envelope:
```json
{
  "success": true,
  "data": { ... },
  "message": "Resource retrieved successfully",
  "meta": {
    "timestamp": "2026-10-29T12:00:00Z",
    "request_id": "c73a248f-359a-4f51-b0e7-8b63a92b952b"
  }
}
```

### 1.4 Error Handling (RFC 7807 Problem Details)
When an HTTP status $\ge 400$ is returned, the response body follows RFC 7807 problem details:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The request payload failed schema validation",
    "details": [
      {
        "field": "daily_study_goal_minutes",
        "issue": "Input should be greater than or equal to 15"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-10-29T12:00:00Z",
    "request_id": "c73a248f-359a-4f51-b0e7-8b63a92b952b"
  }
}
```

### 1.5 Pagination Standards
1. **Cursor-Based Pagination** (Used for Feeds, Chat Messages, Activity Logs):
   * Query params: `?cursor=<uuid>&limit=20`
   * Response envelope contains `has_more` and `next_cursor`.
2. **Offset/Limit Pagination** (Used for Search, Catalog & Administration tables):
   * Query params: `?page=1&page_size=25`
   * Response envelope contains `page`, `page_size`, `total_count`, `total_pages`.

---

## 2. Authentication & Session Endpoints (`/auth`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Student self-registration (Argon2id hashing; role is strictly `student`) | No |
| `POST` | `/auth/login` | Email/password login; issues JWT access & refresh tokens | No |
| `POST` | `/auth/refresh` | Rotates refresh token and returns new access token | No (Refresh Token) |
| `POST` | `/auth/logout` | Revokes the current session refresh token in DB | Yes |
| `POST` | `/auth/forgot-password` | Requests a time-limited password reset email token | No |
| `POST` | `/auth/reset-password` | Verifies reset token and sets new password | No |

> [!IMPORTANT]
> Public self-registration (`POST /auth/register`) strictly sets `role = 'student'`. Any attempt to pass `role = 'admin'` or `role = 'super_admin'` in the request body is ignored or rejected with a validation error.

---

## 3. Student Profile & Settings Endpoints (`/users`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/users/me` | Fetch authenticated student profile and targets | Yes |
| `PATCH` | `/users/me` | Update student profile, institution, study goal | Yes |
| `PATCH` | `/users/me/preferences` | Update theme (dark/light), notifications, quiet hours | Yes |
| `POST` | `/users/me/change-password` | Update account password with old password check | Yes |
| `GET` | `/users/me/sessions` | List active device sessions | Yes |
| `DELETE` | `/users/me/sessions/{id}` | Revoke a specific active device session | Yes |
| `POST` | `/users/me/export` | Request complete GDPR data archive (.zip / JSON) | Yes |
| `DELETE` | `/users/me` | Permanent self-serve account and data deletion | Yes |

---

## 4. Academic Structure (`/semesters`, `/subjects`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/semesters` | List all semesters owned by the student | Yes |
| `POST` | `/semesters` | Create a new semester (e.g. "Fall 2026") | Yes |
| `PATCH` | `/semesters/{id}` | Update semester dates or set as current active | Yes |
| `DELETE` | `/semesters/{id}` | Delete or archive semester | Yes |
| `GET` | `/subjects` | List subjects (optionally filtered by `?semester_id=`) | Yes |
| `POST` | `/subjects` | Add a new subject with color code, instructor, credits | Yes |
| `GET` | `/subjects/{id}` | Get subject details, linked note count, and stats | Yes |
| `PATCH` | `/subjects/{id}` | Update subject metadata | Yes |
| `DELETE` | `/subjects/{id}` | Delete subject (cascades or soft-deletes assets) | Yes |

---

## 5. Notes & Document Library (`/notes`, `/documents`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/notes` | List notes (filter by `subject_id`, `is_favorite`, tag) | Yes |
| `POST` | `/notes` | Create a new rich note (standard or Cornell format) | Yes |
| `GET` | `/notes/{id}` | Retrieve note full content (raw markdown & JSON) | Yes |
| `PUT` | `/notes/{id}` | Update note title and content | Yes |
| `DELETE` | `/notes/{id}` | Delete note | Yes |
| `POST` | `/documents/upload` | **Minimum Viable Upload**: Multipart upload; saves to local/cloud storage; triggers background summarization | Yes |
| `POST` | `/documents/upload-intent` | Future/Production: Request presigned S3/R2 upload URL | Yes |
| `GET` | `/documents` | List uploaded course documents and processing status | Yes |
| `GET` | `/documents/{id}` | Retrieve document metadata, TL;DR, and key concepts | Yes |
| `GET` | `/documents/{id}/file` | Download/stream PDF file (verifies student ownership) | Yes |
| `DELETE` | `/documents/{id}` | Delete document record and purge file from storage | Yes |

---

## 6. Productivity & Calendar (`/tasks`, `/timetable`, `/study-sessions`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/tasks` | List tasks (filter by `status`, `subject_id`, `priority`) | Yes |
| `POST` | `/tasks` | Create assignment/task with due date and subtasks | Yes |
| `PATCH` | `/tasks/{id}` | Update task details or mark complete | Yes |
| `DELETE` | `/tasks/{id}` | Delete task | Yes |
| `GET` | `/timetable` | Get recurring weekly timetable schedule | Yes |
| `POST` | `/timetable` | Add recurring class entry (day, start/end time, room) | Yes |
| `DELETE` | `/timetable/{id}` | Remove timetable entry | Yes |
| `POST` | `/study-sessions/log` | Log completed Pomodoro session (minutes, focus rating) | Yes |
| `GET` | `/study-sessions/today` | Fetch total focus minutes logged today vs daily target | Yes |

---

## 7. Active Recall & Mastery (`/flashcards`, `/quizzes`, `/exams`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/flashcards/decks` | List flashcard decks with "Due Today" counter | Yes |
| `POST` | `/flashcards/decks` | Create a new deck linked to a subject | Yes |
| `GET` | `/flashcards/decks/{id}/study` | Fetch cards due for review sorted by SM-2 urgency | Yes |
| `POST` | `/flashcards/{id}/review` | Submit SM-2 review rating (1-4) & update interval | Yes |
| `POST` | `/flashcards/generate-ai` | Trigger AI generation of flashcards from note/document | Yes |
| `POST` | `/quizzes/generate` | Generate custom quiz from note, document, or subject | Yes |
| `GET` | `/quizzes/{id}` | Fetch quiz questions without answers revealed | Yes |
| `POST` | `/quizzes/{id}/submit` | Submit answers, calculate score, receive explanations | Yes |
| `GET` | `/exams` | List upcoming exams and countdown status | Yes |
| `POST` | `/exams` | Register an exam with syllabus topics | Yes |
| `POST` | `/exams/{id}/generate-plan` | Trigger AI to generate 3-phase revision timeline | Yes |

---

## 8. AI Gateway & Streaming (`/ai`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/ai/chat/stream` | Stream conversational tutor response via SSE | Yes |
| `GET` | `/ai/chat/sessions` | List saved chat sessions | Yes |
| `GET` | `/ai/chat/sessions/{id}` | Get conversation history | Yes |
| `POST` | `/ai/explain-topic` | Generate structured explanation at chosen depth | Yes |
| `POST` | `/ai/generate-notes` | Convert raw transcript or text into Cornell notes | Yes |

#### Server-Sent Events (SSE) Contract: `POST /ai/chat/stream`
* Request Body:
  ```json
  {
    "session_id": "4b6b6623-2895-46aa-bdbe-1ea407c088f1",
    "subject_id": "7fa12345-5717-4562-b3fc-2c963f66afa6",
    "prompt": "Can you explain Dijkstra's algorithm using an analogy?",
    "is_socratic": false
  }
  ```
* SSE Response Stream:
  ```
  event: chunk
  data: {"delta": "Imagine "}

  event: chunk
  data: {"delta": "you are planning a road trip "}

  event: done
  data: {"message_id": "99b9...", "total_tokens": 142}
  ```

---

## 9. Dashboard Aggregation, Search & Analytics

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/dashboard/summary` | Aggregated payload for instant mobile home rendering | Yes |
| `GET` | `/search` | Full-text search across notes, PDFs, tasks, decks | Yes |
| `GET` | `/analytics/overview` | Focus hours, subject distribution, quiz accuracy | Yes |
| `GET` | `/analytics/heatmap` | Daily study activity matrix for past 6 months | Yes |

---

## 10. Web Admin Endpoints (`/admin` - Phase 8)

| Method | Endpoint | Description | Role Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/admin/users` | List students with status, filters, and pagination | `support_admin`+ |
| `POST` | `/admin/users/{id}/suspend` | Suspend user account and revoke tokens | `support_admin`+ |
| `POST` | `/admin/users/{id}/reactivate` | Reactivate suspended user account | `support_admin`+ |
| `GET` | `/admin/ai/metrics` | System token consumption, latency, and costs | `super_admin` |
| `POST` | `/admin/ai/config` | Switch active model and adjust budget limits | `super_admin` |
| `GET` | `/admin/audit-logs` | Paginated operational audit logs | `super_admin` |
| `POST` | `/admin/announcements` | Publish system-wide student banner notification | `content_manager`+ |
