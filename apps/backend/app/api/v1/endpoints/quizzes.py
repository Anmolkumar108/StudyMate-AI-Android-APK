from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_active_user, get_quiz_service
from app.models.user import User
from app.schemas.quiz import (
    ConvertMissedToCardsRequest,
    ConvertMissedToCardsResponse,
    QuizAttemptResponse,
    QuizDetailResponse,
    QuizGenerateRequest,
    QuizListResponse,
    QuizResponse,
    QuizSubmitRequest,
)
from app.services.quiz_service import (
    QuizAttemptNotFoundError,
    QuizNotFoundError,
    QuizService,
)

router = APIRouter()


@router.post(
    "/generate",
    response_model=QuizDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a customized AI quiz from a note, document, or topic",
)
async def generate_quiz(
    request: QuizGenerateRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    quiz_service: Annotated[QuizService, Depends(get_quiz_service)],
) -> QuizDetailResponse:
    quiz = await quiz_service.generate_quiz(
        user_id=current_user.id,
        request=request,
    )
    return QuizDetailResponse.model_validate(quiz)


@router.get(
    "",
    response_model=QuizListResponse,
    summary="List authenticated user's generated quizzes",
)
async def list_quizzes(
    current_user: Annotated[User, Depends(get_current_active_user)],
    quiz_service: Annotated[QuizService, Depends(get_quiz_service)],
    subject_id: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> QuizListResponse:
    quizzes = await quiz_service.list_quizzes(
        user_id=current_user.id,
        subject_id=subject_id,
        limit=limit,
        offset=offset,
    )
    total = await quiz_service.count_quizzes(
        user_id=current_user.id,
        subject_id=subject_id,
    )
    return QuizListResponse(
        items=[QuizResponse.model_validate(q) for q in quizzes],
        total=total,
    )


@router.get(
    "/{quiz_id}",
    response_model=QuizDetailResponse,
    summary="Get quiz metadata and questions by ID",
)
async def get_quiz(
    quiz_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    quiz_service: Annotated[QuizService, Depends(get_quiz_service)],
) -> QuizDetailResponse:
    try:
        quiz = await quiz_service.get_quiz(quiz_id, current_user.id)
        return QuizDetailResponse.model_validate(quiz)
    except QuizNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found",
        ) from exc


@router.post(
    "/{quiz_id}/submit",
    response_model=QuizAttemptResponse,
    summary="Submit answers for a quiz attempt and receive immediate scoring and rationales",
)
async def submit_quiz(
    quiz_id: UUID,
    request: QuizSubmitRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    quiz_service: Annotated[QuizService, Depends(get_quiz_service)],
) -> QuizAttemptResponse:
    try:
        return await quiz_service.submit_quiz_attempt(
            user_id=current_user.id,
            quiz_id=quiz_id,
            request=request,
        )
    except QuizNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found",
        ) from exc


@router.post(
    "/{quiz_id}/attempts/{attempt_id}/convert-to-flashcards",
    response_model=ConvertMissedToCardsResponse,
    summary="Convert all missed questions from an attempt into Spaced Repetition Flashcards",
)
async def convert_missed_to_cards(
    quiz_id: UUID,
    attempt_id: UUID,
    request: ConvertMissedToCardsRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    quiz_service: Annotated[QuizService, Depends(get_quiz_service)],
) -> ConvertMissedToCardsResponse:
    try:
        deck_id, cards_created = await quiz_service.convert_missed_to_flashcards(
            user_id=current_user.id,
            quiz_id=quiz_id,
            attempt_id=attempt_id,
            target_deck_id=request.target_deck_id,
        )
        return ConvertMissedToCardsResponse(
            deck_id=deck_id,
            cards_created=cards_created,
            message=f"Successfully generated {cards_created} flashcards from missed questions.",
        )
    except QuizAttemptNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.delete(
    "/{quiz_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a quiz and its questions",
)
async def delete_quiz(
    quiz_id: UUID,
    current_user: Annotated[User, Depends(get_current_active_user)],
    quiz_service: Annotated[QuizService, Depends(get_quiz_service)],
) -> None:
    try:
        await quiz_service.delete_quiz(quiz_id, current_user.id)
    except QuizNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found",
        ) from exc

