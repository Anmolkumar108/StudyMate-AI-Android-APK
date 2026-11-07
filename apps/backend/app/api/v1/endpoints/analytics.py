from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_analytics_service, get_current_user
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsHeatmapResponse,
    AnalyticsOverviewResponse,
    StudySessionCreateRequest,
    StudySessionResponse,
    TodayStudySummary,
)
from app.services.analytics_service import AnalyticsService

router = APIRouter()
study_sessions_router = APIRouter()


# -----------------------------------------------------------------------------
# Study Sessions Endpoints (/api/v1/study-sessions)
# -----------------------------------------------------------------------------

@study_sessions_router.post(
    "/log",
    response_model=StudySessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log completed focus session",
    description="Records a completed focus study block to PostgreSQL with optional task/subject linkage.",
)
async def log_study_session(
    payload: StudySessionCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    analytics_service: Annotated[AnalyticsService, Depends(get_analytics_service)],
) -> StudySessionResponse:
    return await analytics_service.log_session(current_user.id, payload)


@study_sessions_router.get(
    "/today",
    response_model=TodayStudySummary,
    status_code=status.HTTP_200_OK,
    summary="Get today's study focus summary",
    description="Returns today's accumulated focus minutes and goal progress.",
)
async def get_today_study_summary(
    current_user: Annotated[User, Depends(get_current_user)],
    analytics_service: Annotated[AnalyticsService, Depends(get_analytics_service)],
) -> TodayStudySummary:
    goal = current_user.daily_study_goal_minutes or 60
    return await analytics_service.get_today_summary(current_user.id, daily_goal_minutes=goal)


# -----------------------------------------------------------------------------
# Analytics & Heatmap Endpoints (/api/v1/analytics)
# -----------------------------------------------------------------------------

@router.get(
    "/overview",
    response_model=AnalyticsOverviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Get comprehensive study analytics overview",
    description="Returns high-level statistics, subject distribution, 7-day trend, and mastery progression.",
)
async def get_analytics_overview(
    current_user: Annotated[User, Depends(get_current_user)],
    analytics_service: Annotated[AnalyticsService, Depends(get_analytics_service)],
    timeframe: str = Query("all", description="Timeframe filter: 'week', 'month', or 'all'"),
) -> AnalyticsOverviewResponse:
    return await analytics_service.get_overview(current_user.id, timeframe=timeframe)


@router.get(
    "/heatmap",
    response_model=AnalyticsHeatmapResponse,
    status_code=status.HTTP_200_OK,
    summary="Get consistency heatmap matrix",
    description="Returns 6-month daily activity matrix for the GitHub-style consistency calendar grid.",
)
async def get_analytics_heatmap(
    current_user: Annotated[User, Depends(get_current_user)],
    analytics_service: Annotated[AnalyticsService, Depends(get_analytics_service)],
    days: int = Query(180, ge=7, le=365, description="Number of historical days to include in the matrix"),
) -> AnalyticsHeatmapResponse:
    return await analytics_service.get_heatmap(current_user.id, days=days)

