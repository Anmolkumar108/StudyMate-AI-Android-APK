"""Database repository implementations for data access."""

from app.repositories.ai_chat_repo import AIChatRepository
from app.repositories.document_repo import DocumentRepository
from app.repositories.flashcard_repo import (
    FlashcardDeckRepository,
    FlashcardRepository,
)
from app.repositories.note_repo import NoteRepository
from app.repositories.quiz_repo import QuizRepository
from app.repositories.session_repo import SessionRepository
from app.repositories.subject_repo import SubjectRepository
from app.repositories.user_repo import UserRepository

__all__ = [
    "AIChatRepository",
    "DocumentRepository",
    "FlashcardDeckRepository",
    "FlashcardRepository",
    "NoteRepository",
    "QuizRepository",
    "SessionRepository",
    "SubjectRepository",
    "UserRepository",
]
