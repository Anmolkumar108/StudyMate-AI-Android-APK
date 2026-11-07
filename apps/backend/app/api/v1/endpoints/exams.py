from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_current_active_user, get_exam_service
from app.models.user import User
from app.schemas.exam import (
    ExamCreate,
    ExamListResponse,
    ExamResponse,
    ExamUpcomingSummaryResponse,
    ExamUpdate,
    SyllabusTopicToggleRequest,
)
from app.services.ai_service import AIService
from app.services.exam_service import ExamService

router = APIRouter()


@router.get(
    "",
    response_model=ExamListResponse,
    status_code=status.HTTP_200_OK,
    summary="List all registered exams for the current user",
)
async def list_exams(
    subject_id: UUID | None = Query(None, description="Filter exams by subject"),
    upcoming_only: bool = Query(False, description="Filter for upcoming exams only"),
    current_user: User = Depends(get_current_active_user),
    service: ExamService = Depends(get_exam_service),
) -> ExamListResponse:
    return await service.list_exams(
        user_id=current_user.id,
        subject_id=subject_id,
        upcoming_only=upcoming_only,
    )


@router.post(
    "",
    response_model=ExamResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new exam with syllabus topics",
)
async def create_exam(
    payload: ExamCreate,
    current_user: User = Depends(get_current_active_user),
    service: ExamService = Depends(get_exam_service),
) -> ExamResponse:
    return await service.create_exam(
        user_id=current_user.id,
        payload=payload,
    )


@router.get(
    "/upcoming/summary",
    response_model=ExamUpcomingSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get upcoming exam countdown summary for home dashboard",
)
async def get_upcoming_exam_summary(
    current_user: User = Depends(get_current_active_user),
    service: ExamService = Depends(get_exam_service),
) -> ExamUpcomingSummaryResponse:
    return await service.get_upcoming_summary(user_id=current_user.id)


@router.get(
    "/{exam_id}",
    response_model=ExamResponse,
    status_code=status.HTTP_200_OK,
    summary="Get exam details by ID",
)
async def get_exam(
    exam_id: UUID,
    current_user: User = Depends(get_current_active_user),
    service: ExamService = Depends(get_exam_service),
) -> ExamResponse:
    return await service.get_exam(
        user_id=current_user.id,
        exam_id=exam_id,
    )


@router.patch(
    "/{exam_id}",
    response_model=ExamResponse,
    status_code=status.HTTP_200_OK,
    summary="Update exam details or syllabus topics",
)
async def update_exam(
    exam_id: UUID,
    payload: ExamUpdate,
    current_user: User = Depends(get_current_active_user),
    service: ExamService = Depends(get_exam_service),
) -> ExamResponse:
    return await service.update_exam(
        user_id=current_user.id,
        exam_id=exam_id,
        payload=payload,
    )


@router.delete(
    "/{exam_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an exam",
)
async def delete_exam(
    exam_id: UUID,
    current_user: User = Depends(get_current_active_user),
    service: ExamService = Depends(get_exam_service),
) -> None:
    await service.delete_exam(
        user_id=current_user.id,
        exam_id=exam_id,
    )


@router.patch(
    "/{exam_id}/topics/{topic_id}/toggle",
    response_model=ExamResponse,
    status_code=status.HTTP_200_OK,
    summary="Toggle syllabus topic completion status",
)
async def toggle_syllabus_topic(
    exam_id: UUID,
    topic_id: str,
    payload: SyllabusTopicToggleRequest | None = None,
    current_user: User = Depends(get_current_active_user),
    service: ExamService = Depends(get_exam_service),
) -> ExamResponse:
    return await service.toggle_topic(
        user_id=current_user.id,
        exam_id=exam_id,
        topic_id=topic_id,
        is_completed=payload.is_completed if payload else None,
        confidence=payload.confidence if payload else None,
    )


@router.post(
    "/{exam_id}/generate-plan",
    response_model=ExamResponse,
    status_code=status.HTTP_200_OK,
    summary="Trigger AI to generate a 3-phase revision timeline",
)
async def generate_revision_plan(
    exam_id: UUID,
    current_user: User = Depends(get_current_active_user),
    service: ExamService = Depends(get_exam_service),
) -> ExamResponse:
    ai = AIService()
    return await service.generate_revision_plan(
        user_id=current_user.id,
        exam_id=exam_id,
        ai_service=ai,
    )

