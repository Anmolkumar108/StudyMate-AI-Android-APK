from collections.abc import Sequence
from datetime import date, time
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.timetable import AttendanceRecord, TimetableEntry


class TimetableRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_by_user(
        self,
        user_id: UUID,
        day_of_week: int | None = None,
        subject_id: UUID | None = None,
    ) -> Sequence[TimetableEntry]:
        """Fetch timetable entries for a user with optional day and subject filters.

        Strictly filtered by user_id to enforce multi-tenant isolation.
        """
        stmt = (
            select(TimetableEntry)
            .options(selectinload(TimetableEntry.subject))
            .where(TimetableEntry.user_id == user_id)
        )

        if day_of_week is not None:
            stmt = stmt.where(TimetableEntry.day_of_week == day_of_week)

        if subject_id is not None:
            stmt = stmt.where(TimetableEntry.subject_id == subject_id)

        stmt = stmt.order_by(TimetableEntry.day_of_week.asc(), TimetableEntry.start_time.asc())
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_by_id_and_user(
        self, entry_id: UUID, user_id: UUID
    ) -> TimetableEntry | None:
        """Fetch a single timetable entry strictly matching both id and user_id.

        Never queries by ID alone.
        """
        stmt = (
            select(TimetableEntry)
            .options(selectinload(TimetableEntry.subject))
            .where(
                TimetableEntry.id == entry_id,
                TimetableEntry.user_id == user_id,
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def find_conflicts(
        self,
        user_id: UUID,
        day_of_week: int,
        start_time: time,
        end_time: time,
        exclude_id: UUID | None = None,
    ) -> Sequence[TimetableEntry]:
        """Detect overlapping timetable entries on the same day for a student.

        Overlap condition: new_start < existing_end AND new_end > existing_start.
        """
        conditions = [
            TimetableEntry.user_id == user_id,
            TimetableEntry.day_of_week == day_of_week,
            TimetableEntry.start_time < end_time,
            TimetableEntry.end_time > start_time,
        ]

        if exclude_id is not None:
            conditions.append(TimetableEntry.id != exclude_id)

        stmt = (
            select(TimetableEntry)
            .options(selectinload(TimetableEntry.subject))
            .where(and_(*conditions))
            .order_by(TimetableEntry.start_time.asc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def create(self, entry: TimetableEntry) -> TimetableEntry:
        """Add and persist a new timetable entry."""
        self.session.add(entry)
        await self.session.flush()
        await self.session.refresh(entry, ["subject"])
        return entry

    async def update(self, entry: TimetableEntry) -> TimetableEntry:
        """Persist changes to an existing timetable entry."""
        self.session.add(entry)
        await self.session.flush()
        await self.session.refresh(entry, ["subject"])
        return entry

    async def delete(self, entry: TimetableEntry) -> None:
        """Delete an existing timetable entry."""
        await self.session.delete(entry)
        await self.session.flush()

    async def get_attendance(
        self,
        user_id: UUID,
        timetable_entry_id: UUID | None,
        attendance_date: date,
    ) -> AttendanceRecord | None:
        """Fetch attendance record for a user, entry, and date."""
        stmt = (
            select(AttendanceRecord)
            .options(selectinload(AttendanceRecord.subject))
            .where(
                AttendanceRecord.user_id == user_id,
                AttendanceRecord.timetable_entry_id == timetable_entry_id,
                AttendanceRecord.attendance_date == attendance_date,
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def save_attendance(self, record: AttendanceRecord) -> AttendanceRecord:
        """Persist or update an attendance record."""
        self.session.add(record)
        await self.session.flush()
        await self.session.refresh(record, ["subject"])
        return record

    async def list_attendance(
        self,
        user_id: UUID,
        attendance_date: date | None = None,
        subject_id: UUID | None = None,
    ) -> Sequence[AttendanceRecord]:
        """Fetch attendance records for a user with optional date and subject filters."""
        stmt = (
            select(AttendanceRecord)
            .options(selectinload(AttendanceRecord.subject))
            .where(AttendanceRecord.user_id == user_id)
        )
        if attendance_date is not None:
            stmt = stmt.where(AttendanceRecord.attendance_date == attendance_date)
        if subject_id is not None:
            stmt = stmt.where(AttendanceRecord.subject_id == subject_id)
        stmt = stmt.order_by(AttendanceRecord.attendance_date.desc(), AttendanceRecord.created_at.desc())
        result = await self.session.execute(stmt)
        return result.scalars().all()

