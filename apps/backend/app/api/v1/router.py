from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin,
    ai,
    analytics,
    announcements,
    auth,
    documents,
    exams,
    flashcards,
    health,
    notes,
    quizzes,
    search,
    study_planner,
    subject_templates,
    subjects,
    tasks,
    telemetry,
    timetable,
    users,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(telemetry.router, tags=["Telemetry & Device Intelligence"])
api_router.include_router(users.router, prefix="/users", tags=["User Profile & Security"])
api_router.include_router(subjects.router, prefix="/subjects", tags=["Subjects"])
api_router.include_router(notes.router, prefix="/notes", tags=["Notes"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["Tasks"])
api_router.include_router(timetable.router, prefix="/timetable", tags=["Timetable & Schedule"])
api_router.include_router(exams.router, prefix="/exams", tags=["Exams & Revision"])
api_router.include_router(study_planner.router, prefix="/study-planner", tags=["Smart Study Planner"])
api_router.include_router(flashcards.router, prefix="/flashcards", tags=["Flashcards"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI Tutor"])
api_router.include_router(quizzes.router, prefix="/quizzes", tags=["AI Quizzes"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Study Analytics"])
api_router.include_router(analytics.study_sessions_router, prefix="/study-sessions", tags=["Study Sessions"])
api_router.include_router(search.router, prefix="/search", tags=["Universal Search"])
api_router.include_router(announcements.router, tags=["Announcements"])
api_router.include_router(subject_templates.router, tags=["Subject Templates"])
api_router.include_router(admin.router)
