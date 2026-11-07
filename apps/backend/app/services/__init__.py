"""Domain services encapsulating business logic."""

from app.services.ai_chat_service import AIChatService
from app.services.ai_service import AIService
from app.services.auth_service import (
    AccountPendingVerificationError,
    AccountSuspendedError,
    AuthService,
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    InvalidRefreshTokenError,
    SessionNotFoundError,
)
from app.services.document_service import (
    DocumentNotFoundError,
    DocumentService,
    DocumentValidationError,
)
from app.services.flashcard_service import (
    CardNotFoundError,
    DeckNotFoundError,
    FlashcardError,
    FlashcardService,
    InvalidDeckSubjectError,
)
from app.services.note_service import (
    InvalidNoteSubjectError,
    NoteError,
    NoteNotFoundError,
    NoteService,
)
from app.services.quiz_service import (
    QuizAttemptNotFoundError,
    QuizNotFoundError,
    QuizService,
)
from app.services.storage_service import (
    LocalStorageService,
    StorageService,
    get_storage_service,
)
from app.services.subject_service import (
    DuplicateSubjectNameError,
    SubjectError,
    SubjectNotFoundError,
    SubjectService,
)

__all__ = [
    "AIChatService",
    "AIService",
    "AccountPendingVerificationError",
    "AccountSuspendedError",
    "AuthService",
    "CardNotFoundError",
    "DeckNotFoundError",
    "DocumentNotFoundError",
    "DocumentService",
    "DocumentValidationError",
    "DuplicateSubjectNameError",
    "EmailAlreadyRegisteredError",
    "FlashcardError",
    "FlashcardService",
    "InvalidCredentialsError",
    "InvalidDeckSubjectError",
    "InvalidNoteSubjectError",
    "InvalidRefreshTokenError",
    "LocalStorageService",
    "NoteError",
    "NoteNotFoundError",
    "NoteService",
    "QuizAttemptNotFoundError",
    "QuizNotFoundError",
    "QuizService",
    "SessionNotFoundError",
    "StorageService",
    "SubjectError",
    "SubjectNotFoundError",
    "SubjectService",
    "get_storage_service",
]
