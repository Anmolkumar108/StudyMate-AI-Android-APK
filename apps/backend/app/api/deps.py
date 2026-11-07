from collections.abc import AsyncGenerator
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_db_session
from app.models.user import User, UserStatus
from app.repositories.ai_chat_repo import AIChatRepository
from app.repositories.document_repo import DocumentRepository
from app.repositories.exam_repo import ExamRepository
from app.repositories.flashcard_repo import (
    FlashcardDeckRepository,
    FlashcardRepository,
)
from app.repositories.note_repo import NoteRepository
from app.repositories.quiz_repo import QuizRepository
from app.repositories.study_plan_repo import StudyPlanRepository
from app.repositories.subject_repo import SubjectRepository
from app.repositories.task_repo import TaskRepository
from app.repositories.timetable_repo import TimetableRepository
from app.repositories.user_repo import UserRepository
from app.services.ai_chat_service import AIChatService
from app.services.ai_service import AIService
from app.services.analytics_service import AnalyticsService
from app.services.auth_service import AuthService
from app.services.document_service import DocumentService
from app.services.exam_service import ExamService
from app.services.flashcard_service import FlashcardService
from app.services.note_service import NoteService
from app.services.quiz_service import QuizService
from app.services.search_service import SearchService
from app.services.storage_service import get_storage_service
from app.services.study_plan_service import StudyPlannerService
from app.services.subject_service import SubjectService
from app.services.task_service import TaskService
from app.services.timetable_service import TimetableService, timetable_service

security_scheme = HTTPBearer(auto_error=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async for session in get_db_session():
        yield session


def get_auth_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuthService:
    return AuthService(db)


def get_subject_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SubjectService:
    return SubjectService(db)


def get_note_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> NoteService:
    return NoteService(db)


def get_flashcard_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FlashcardService:
    return FlashcardService(db)


def get_document_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> DocumentService:
    repo = DocumentRepository(db)
    storage = get_storage_service()
    ai = AIService()
    return DocumentService(repository=repo, storage_service=storage, ai_service=ai)


def get_ai_chat_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AIChatService:
    repo = AIChatRepository(db)
    subject_repo = SubjectRepository(db)
    ai = AIService()
    return AIChatService(repository=repo, subject_repo=subject_repo, ai_service=ai)


def get_quiz_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> QuizService:
    repo = QuizRepository(db)
    note_repo = NoteRepository(db)
    doc_repo = DocumentRepository(db)
    subject_repo = SubjectRepository(db)
    deck_repo = FlashcardDeckRepository(db)
    card_repo = FlashcardRepository(db)
    ai = AIService()
    return QuizService(
        repository=repo,
        note_repo=note_repo,
        doc_repo=doc_repo,
        subject_repo=subject_repo,
        deck_repo=deck_repo,
        card_repo=card_repo,
        ai_service=ai,
    )


def get_task_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TaskService:
    return TaskService(db)


def get_timetable_service() -> TimetableService:
    return timetable_service


def get_exam_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ExamService:
    return ExamService(db)


def get_ai_service() -> AIService:
    return AIService()


def get_study_planner_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StudyPlannerService:
    study_plan_repo = StudyPlanRepository(db)
    task_repo = TaskRepository(db)
    exam_repo = ExamRepository(db)
    timetable_repo = TimetableRepository(db)
    subject_repo = SubjectRepository(db)
    ai_service = AIService()
    return StudyPlannerService(
        session=db,
        study_plan_repo=study_plan_repo,
        task_repo=task_repo,
        exam_repo=exam_repo,
        timetable_repo=timetable_repo,
        subject_repo=subject_repo,
        ai_service=ai_service,
    )


def get_analytics_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AnalyticsService:
    return AnalyticsService(db)


def get_search_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SearchService:
    return SearchService(db)


async def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(security_scheme)
    ],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(credentials.credentials)
    except (jwt.PyJWTError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = UUID(str(sub))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid subject format in token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e

    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Validate token_version matches current user record
    token_version = payload.get("token_version")
    if user.token_version != token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been invalidated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Reject suspended accounts
    if user.status == UserStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended. Please contact support.",
        )

    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if current_user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account",
        )
    return current_user
