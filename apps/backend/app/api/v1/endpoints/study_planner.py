import logging
import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.deps import get_current_user, get_study_planner_service
from app.models.user import User
from app.schemas.study_plan import (
    StudyBlockToggleRequest,
    StudyPlanGenerateRequest,
    StudyPlanRebalanceRequest,
    StudyPlanResponse,
)
from app.services.study_plan_service import StudyPlannerService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/today", response_model=StudyPlanResponse | None)
async def get_today_study_plan(
    current_user: Annotated[User, Depends(get_current_user)],
    planner_service: Annotated[StudyPlannerService, Depends(get_study_planner_service)],
) -> StudyPlanResponse | None:
    """Fetch today's active study plan for the authenticated student."""
    today = date.today()
    return await planner_service.get_plan_by_date(current_user.id, today)


@router.get("/date/{plan_date}", response_model=StudyPlanResponse | None)
async def get_study_plan_by_date(
    plan_date: date,
    current_user: Annotated[User, Depends(get_current_user)],
    planner_service: Annotated[StudyPlannerService, Depends(get_study_planner_service)],
) -> StudyPlanResponse | None:
    """Fetch a study plan for a specific date."""
    return await planner_service.get_plan_by_date(current_user.id, plan_date)


@router.get("/{plan_id}", response_model=StudyPlanResponse)
async def get_study_plan_by_id(
    plan_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    planner_service: Annotated[StudyPlannerService, Depends(get_study_planner_service)],
) -> StudyPlanResponse:
    """Fetch a single study plan strictly verifying user ownership."""
    plan = await planner_service.get_plan_by_id(current_user.id, plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study plan not found",
        )
    return plan


@router.post("/generate", response_model=StudyPlanResponse, status_code=status.HTTP_201_CREATED)
async def generate_study_plan(
    payload: StudyPlanGenerateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    planner_service: Annotated[StudyPlannerService, Depends(get_study_planner_service)],
) -> StudyPlanResponse:
    """Generate or update an AI-assisted daily study plan with conflict-free timetable allocation."""
    try:
        return await planner_service.generate_daily_plan(
            user_id=current_user.id,
            plan_date=payload.plan_date,
            target_study_minutes=payload.target_study_minutes,
            focus_subject_ids=payload.focus_subject_ids,
            pace_mode=payload.pace_mode,
            start_hour=payload.start_hour,
            include_breaks=payload.include_breaks,
        )
    except Exception as e:
        logger.exception(f"Error generating study plan for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not generate study schedule: {e!s}",
        )


@router.patch("/{plan_id}/blocks/{block_id}/toggle", response_model=StudyPlanResponse)
async def toggle_study_block(
    plan_id: uuid.UUID,
    block_id: str,
    payload: StudyBlockToggleRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    planner_service: Annotated[StudyPlannerService, Depends(get_study_planner_service)],
) -> StudyPlanResponse:
    """Toggle a study block completion status and re-calculate completed minutes."""
    updated = await planner_service.toggle_block_completion(
        user_id=current_user.id,
        plan_id=plan_id,
        block_id=block_id,
        is_completed=payload.is_completed,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study plan or block not found",
        )
    return updated


@router.post("/{plan_id}/rebalance", response_model=StudyPlanResponse)
async def rebalance_study_plan(
    plan_id: uuid.UUID,
    payload: StudyPlanRebalanceRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    planner_service: Annotated[StudyPlannerService, Depends(get_study_planner_service)],
) -> StudyPlanResponse:
    """Rebalance unfinished study blocks across the remaining available hours of the day."""
    rebalanced = await planner_service.rebalance_plan(
        user_id=current_user.id,
        plan_id=plan_id,
        remaining_available_minutes=payload.remaining_available_minutes,
    )
    if not rebalanced:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study plan not found",
        )
    return rebalanced


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_study_plan(
    plan_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    planner_service: Annotated[StudyPlannerService, Depends(get_study_planner_service)],
) -> Response:
    """Delete a study plan strictly verifying user ownership."""
    deleted = await planner_service.delete_plan(current_user.id, plan_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Study plan not found",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)

