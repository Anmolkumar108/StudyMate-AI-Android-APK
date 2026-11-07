from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db, get_timetable_service
from app.models.user import User
from app.schemas.timetable import (
    AttendanceMarkRequest,
    AttendanceRecordResponse,
    AttendanceSummaryResponse,
    TimetableConflictCheckRequest,
    TimetableConflictResponse,
    TimetableEntryBatchCreate,
    TimetableEntryCreate,
    TimetableEntryResponse,
    TimetableEntryUpdate,
    WeeklyTimetableResponse,
)
from app.services.timetable_service import TimetableService

router = APIRouter()


@router.get(
    "",
    response_model=list[TimetableEntryResponse],
    status_code=status.HTTP_200_OK,
    summary="List all timetable entries for the authenticated student",
)
async def list_timetable_entries(
    day_of_week: int | None = Query(None, ge=1, le=7, description="Filter by day (1=Mon ... 7=Sun)"),
    subject_id: UUID | None = Query(None, description="Filter by subject"),
    current_user: User = Depends(get_current_active_user),
    service: TimetableService = Depends(get_timetable_service),
    db: AsyncSession = Depends(get_db),
) -> list[TimetableEntryResponse]:
    return await service.list_entries(
        db,
        user_id=current_user.id,
        day_of_week=day_of_week,
        subject_id=subject_id,
    )


@router.get(
    "/weekly",
    response_model=WeeklyTimetableResponse,
    status_code=status.HTTP_200_OK,
    summary="Get full weekly timetable grid grouped by day of week",
)
async def get_weekly_schedule(
    current_user: User = Depends(get_current_active_user),
    service: TimetableService = Depends(get_timetable_service),
    db: AsyncSession = Depends(get_db),
) -> WeeklyTimetableResponse:
    return await service.get_weekly_schedule(db, user_id=current_user.id)


@router.get(
    "/today",
    response_model=list[TimetableEntryResponse],
    status_code=status.HTTP_200_OK,
    summary="Get today's scheduled classes sorted chronologically",
)
async def get_today_schedule(
    current_user: User = Depends(get_current_active_user),
    service: TimetableService = Depends(get_timetable_service),
    db: AsyncSession = Depends(get_db),
) -> list[TimetableEntryResponse]:
    return await service.get_today_schedule(db, user_id=current_user.id)


@router.post(
    "",
    response_model=TimetableEntryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new recurring class entry to the student's timetable",
)
async def create_timetable_entry(
    payload: TimetableEntryCreate,
    current_user: User = Depends(get_current_active_user),
    service: TimetableService = Depends(get_timetable_service),
    db: AsyncSession = Depends(get_db),
) -> TimetableEntryResponse:
    return await service.create_entry(
        db,
        user_id=current_user.id,
        payload=payload,
    )


@router.post(
    "/check-conflict",
    response_model=TimetableConflictResponse,
    status_code=status.HTTP_200_OK,
    summary="Dry-run check for time conflicts on a specific day",
)
async def check_conflict(
    payload: TimetableConflictCheckRequest,
    current_user: User = Depends(get_current_active_user),
    service: TimetableService = Depends(get_timetable_service),
    db: AsyncSession = Depends(get_db),
) -> TimetableConflictResponse:
    return await service.check_conflicts(
        db,
        user_id=current_user.id,
        day_of_week=payload.day_of_week,
        start_time=payload.start_time,
        end_time=payload.end_time,
        exclude_id=payload.exclude_id,
    )


@router.post(
    "/batch",
    response_model=list[TimetableEntryResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Batch add recurring class entries across multiple weekdays",
)
async def batch_create_timetable_entries(
    payload: TimetableEntryBatchCreate,
    current_user: User = Depends(get_current_active_user),
    service: TimetableService = Depends(get_timetable_service),
    db: AsyncSession = Depends(get_db),
) -> list[TimetableEntryResponse]:
    return await service.batch_create_entries(
        db,
        user_id=current_user.id,
        payload=payload,
    )


@router.post(
    "/attendance",
    response_model=AttendanceRecordResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark or update attendance for a specific class on a date",
)
async def mark_attendance(
    payload: AttendanceMarkRequest,
    current_user: User = Depends(get_current_active_user),
    service: TimetableService = Depends(get_timetable_service),
    db: AsyncSession = Depends(get_db),
) -> AttendanceRecordResponse:
    return await service.mark_attendance(
        db,
        user_id=current_user.id,
        payload=payload,
    )


@router.get(
    "/attendance",
    response_model=list[AttendanceRecordResponse],
    status_code=status.HTTP_200_OK,
    summary="List attendance records with optional date and subject filters",
)
async def list_attendance(
    attendance_date: date | None = Query(None, description="Filter by date (YYYY-MM-DD)"),
    subject_id: UUID | None = Query(None, description="Filter by subject"),
    current_user: User = Depends(get_current_active_user),
    service: TimetableService = Depends(get_timetable_service),
    db: AsyncSession = Depends(get_db),
) -> list[AttendanceRecordResponse]:
    return await service.list_attendance(
        db,
        user_id=current_user.id,
        attendance_date=attendance_date,
        subject_id=subject_id,
    )


@router.get(
    "/attendance/summary",
    response_model=AttendanceSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get overall and subject-wise attendance analytics and low-attendance warnings",
)
async def get_attendance_summary(
    minimum_required: float = Query(75.0, ge=0.0, le=100.0, description="Minimum required percentage"),
    current_user: User = Depends(get_current_active_user),
    service: TimetableService = Depends(get_timetable_service),
    db: AsyncSession = Depends(get_db),
) -> AttendanceSummaryResponse:
    return await service.get_attendance_summary(
        db,
        user_id=current_user.id,
        minimum_required=minimum_required,
    )


@router.get(
    "/{id}",
    response_model=TimetableEntryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get a single timetable entry by ID",
)
async def get_timetable_entry(
    id: UUID,
    current_user: User = Depends(get_current_active_user),
    service: TimetableService = Depends(get_timetable_service),
    db: AsyncSession = Depends(get_db),
) -> TimetableEntryResponse:
    return await service.get_entry_by_id(
        db,
        user_id=current_user.id,
        entry_id=id,
    )


@router.patch(
    "/{id}",
    response_model=TimetableEntryResponse,
    status_code=status.HTTP_200_OK,
    summary="Update an existing timetable entry",
)
async def update_timetable_entry(
    id: UUID,
    payload: TimetableEntryUpdate,
    current_user: User = Depends(get_current_active_user),
    service: TimetableService = Depends(get_timetable_service),
    db: AsyncSession = Depends(get_db),
) -> TimetableEntryResponse:
    return await service.update_entry(
        db,
        user_id=current_user.id,
        entry_id=id,
        payload=payload,
    )


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a timetable entry",
)
async def delete_timetable_entry(
    id: UUID,
    current_user: User = Depends(get_current_active_user),
    service: TimetableService = Depends(get_timetable_service),
    db: AsyncSession = Depends(get_db),
) -> None:
    await service.delete_entry(
        db,
        user_id=current_user.id,
        entry_id=id,
    )
