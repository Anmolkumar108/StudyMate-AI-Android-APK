from fastapi import APIRouter

from app.api.v1.endpoints import (
    ai,
    auth,
    documents,
    flashcards,
    health,
    notes,
    quizzes,
    subjects,
    tasks,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(subjects.router, prefix="/subjects", tags=["Subjects"])
api_router.include_router(notes.router, prefix="/notes", tags=["Notes"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["Tasks"])
api_router.include_router(flashcards.router, prefix="/flashcards", tags=["Flashcards"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI Tutor"])
api_router.include_router(quizzes.router, prefix="/quizzes", tags=["AI Quizzes"])
