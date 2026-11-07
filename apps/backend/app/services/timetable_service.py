from datetime import UTC, date, datetime, time
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.timetable import AttendanceRecord, TimetableEntry
from app.repositories.subject_repo import SubjectRepository
from app.repositories.timetable_repo import TimetableRepository
from app.schemas.timetable import (
    AttendanceMarkRequest,
    AttendanceRecordResponse,
    AttendanceSummaryResponse,
    SubjectAttendanceStats,
    TimetableConflictResponse,
    TimetableEntryBatchCreate,
    TimetableEntryCreate,
    TimetableEntryResponse,
    TimetableEntryUpdate,
    WeeklyTimetableResponse,
)


class TimetableService:
    @staticmethod
    def _to_response(entry: TimetableEntry) -> TimetableEntryResponse:
        subject = entry.subject
        return TimetableEntryResponse(
            id=entry.id,
            user_id=entry.user_id,
            subject_id=entry.subject_id,
            day_of_week=entry.day_of_week,
            start_time=entry.start_time,
            end_time=entry.end_time,
            room=entry.room,
            building=entry.building,
            professor=entry.professor,
            color=entry.color or (subject.color if subject else None),
            is_online=entry.is_online,
            virtual_url=entry.virtual_url,
            reminder_minutes_before=entry.reminder_minutes_before,
            start_date=entry.start_date,
            end_date=entry.end_date,
            subject_name=subject.name if subject else None,
            subject_color=subject.color if subject else None,
            subject_code=subject.code if subject else None,
            created_at=entry.created_at,
            updated_at=entry.updated_at,
        )

    async def list_entries(
        self,
        db: AsyncSession,
        user_id: UUID,
        day_of_week: int | None = None,
        subject_id: UUID | None = None,
    ) -> list[TimetableEntryResponse]:
        repo = TimetableRepository(db)
        entries = await repo.list_by_user(user_id, day_of_week=day_of_week, subject_id=subject_id)
        return [self._to_response(e) for e in entries]

    async def get_weekly_schedule(
        self,
        db: AsyncSession,
        user_id: UUID,
    ) -> WeeklyTimetableResponse:
        repo = TimetableRepository(db)
        entries = await repo.list_by_user(user_id)
        by_day: dict[int, list[TimetableEntryResponse]] = {day: [] for day in range(1, 8)}

        responses: list[TimetableEntryResponse] = []
        for e in entries:
            resp = self._to_response(e)
            responses.append(resp)
            by_day[e.day_of_week].append(resp)

        return WeeklyTimetableResponse(
            entries=responses,
            by_day=by_day,
            total_classes=len(responses),
        )

    async def get_today_schedule(
        self,
        db: AsyncSession,
        user_id: UUID,
    ) -> list[TimetableEntryResponse]:
        # Python weekday: 0=Monday ... 6=Sunday; our schema: 1=Monday ... 7=Sunday
        today_dow = datetime.now(UTC).isoweekday()
        return await self.list_entries(db, user_id, day_of_week=today_dow)

    async def check_conflicts(
        self,
        db: AsyncSession,
        user_id: UUID,
        day_of_week: int,
        start_time: time,
        end_time: time,
        exclude_id: UUID | None = None,
    ) -> TimetableConflictResponse:
        repo = TimetableRepository(db)
        conflicts = await repo.find_conflicts(
            user_id=user_id,
            day_of_week=day_of_week,
            start_time=start_time,
            end_time=end_time,
            exclude_id=exclude_id,
        )
        responses = [self._to_response(c) for c in conflicts]
        return TimetableConflictResponse(
            has_conflict=len(responses) > 0,
            conflicting_entries=responses,
        )

    async def get_entry_by_id(
        self,
        db: AsyncSession,
        user_id: UUID,
        entry_id: UUID,
    ) -> TimetableEntryResponse:
        repo = TimetableRepository(db)
        entry = await repo.get_by_id_and_user(entry_id, user_id)
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Timetable entry not found",
            )
        return self._to_response(entry)

    async def create_entry(
        self,
        db: AsyncSession,
        user_id: UUID,
        payload: TimetableEntryCreate,
    ) -> TimetableEntryResponse:
        subject_repo = SubjectRepository(db)
        subject = await subject_repo.get_by_id_and_user(payload.subject_id, user_id)
        if not subject:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subject not found or does not belong to the authenticated user",
            )

        repo = TimetableRepository(db)
        entry = TimetableEntry(
            user_id=user_id,
            subject_id=payload.subject_id,
            day_of_week=payload.day_of_week,
            start_time=payload.start_time,
            end_time=payload.end_time,
            room=payload.room,
            building=payload.building,
            professor=payload.professor,
            color=payload.color,
            is_online=payload.is_online,
            virtual_url=payload.virtual_url,
            reminder_minutes_before=payload.reminder_minutes_before,
            start_date=payload.start_date,
            end_date=payload.end_date,
        )
        saved = await repo.create(entry)
        return self._to_response(saved)

    async def batch_create_entries(
        self,
        db: AsyncSession,
        user_id: UUID,
        payload: TimetableEntryBatchCreate,
    ) -> list[TimetableEntryResponse]:
        subject_repo = SubjectRepository(db)
        subject = await subject_repo.get_by_id_and_user(payload.subject_id, user_id)
        if not subject:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subject not found or does not belong to the authenticated user",
            )

        repo = TimetableRepository(db)
        created_entries: list[TimetableEntryResponse] = []
        for d in payload.days_of_week:
            entry = TimetableEntry(
                user_id=user_id,
                subject_id=payload.subject_id,
                day_of_week=d,
                start_time=payload.start_time,
                end_time=payload.end_time,
                room=payload.room,
                building=payload.building,
                professor=payload.professor,
                color=payload.color,
                is_online=payload.is_online,
                virtual_url=payload.virtual_url,
                reminder_minutes_before=payload.reminder_minutes_before,
                start_date=payload.start_date,
                end_date=payload.end_date,
            )
            saved = await repo.create(entry)
            created_entries.append(self._to_response(saved))
        return created_entries

    async def update_entry(
        self,
        db: AsyncSession,
        user_id: UUID,
        entry_id: UUID,
        payload: TimetableEntryUpdate,
    ) -> TimetableEntryResponse:
        repo = TimetableRepository(db)
        entry = await repo.get_by_id_and_user(entry_id, user_id)
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Timetable entry not found",
            )

        if payload.subject_id is not None and payload.subject_id != entry.subject_id:
            subject_repo = SubjectRepository(db)
            subject = await subject_repo.get_by_id_and_user(payload.subject_id, user_id)
            if not subject:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Subject not found or does not belong to the authenticated user",
                )
            entry.subject_id = payload.subject_id

        # Validate effective times
        effective_start = payload.start_time if payload.start_time is not None else entry.start_time
        effective_end = payload.end_time if payload.end_time is not None else entry.end_time
        if effective_end <= effective_start:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="end_time must be strictly after start_time",
            )

        if payload.day_of_week is not None:
            entry.day_of_week = payload.day_of_week
        if payload.start_time is not None:
            entry.start_time = payload.start_time
        if payload.end_time is not None:
            entry.end_time = payload.end_time
        if payload.room is not None:
            entry.room = payload.room
        if payload.building is not None:
            entry.building = payload.building
        if payload.professor is not None:
            entry.professor = payload.professor
        if payload.color is not None:
            entry.color = payload.color
        if payload.is_online is not None:
            entry.is_online = payload.is_online
        if payload.virtual_url is not None:
            entry.virtual_url = payload.virtual_url
        if payload.reminder_minutes_before is not None:
            entry.reminder_minutes_before = payload.reminder_minutes_before
        if payload.start_date is not None:
            entry.start_date = payload.start_date
        if payload.end_date is not None:
            entry.end_date = payload.end_date

        updated = await repo.update(entry)
        return self._to_response(updated)

    async def delete_entry(
        self,
        db: AsyncSession,
        user_id: UUID,
        entry_id: UUID,
    ) -> None:
        repo = TimetableRepository(db)
        entry = await repo.get_by_id_and_user(entry_id, user_id)
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Timetable entry not found",
            )
        await repo.delete(entry)

    # ================= Attendance Service Logic =================

    @staticmethod
    def _attendance_to_response(rec: AttendanceRecord) -> AttendanceRecordResponse:
        sub = rec.subject
        return AttendanceRecordResponse(
            id=rec.id,
            user_id=rec.user_id,
            timetable_entry_id=rec.timetable_entry_id,
            subject_id=rec.subject_id,
            attendance_date=rec.attendance_date,
            status=rec.status,
            notes=rec.notes,
            subject_name=sub.name if sub else None,
            subject_color=sub.color if sub else None,
            created_at=rec.created_at,
            updated_at=rec.updated_at,
        )

    async def mark_attendance(
        self,
        db: AsyncSession,
        user_id: UUID,
        payload: AttendanceMarkRequest,
    ) -> AttendanceRecordResponse:
        subject_repo = SubjectRepository(db)
        subject = await subject_repo.get_by_id_and_user(payload.subject_id, user_id)
        if not subject:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subject not found",
            )

        repo = TimetableRepository(db)
        existing = await repo.get_attendance(
            user_id=user_id,
            timetable_entry_id=payload.timetable_entry_id,
            attendance_date=payload.attendance_date,
        )
        if existing:
            existing.status = payload.status.value
            existing.notes = payload.notes
            existing.subject_id = payload.subject_id
            saved = await repo.save_attendance(existing)
        else:
            rec = AttendanceRecord(
                user_id=user_id,
                timetable_entry_id=payload.timetable_entry_id,
                subject_id=payload.subject_id,
                attendance_date=payload.attendance_date,
                status=payload.status.value,
                notes=payload.notes,
            )
            saved = await repo.save_attendance(rec)
        return self._attendance_to_response(saved)

    async def list_attendance(
        self,
        db: AsyncSession,
        user_id: UUID,
        attendance_date: date | None = None,
        subject_id: UUID | None = None,
    ) -> list[AttendanceRecordResponse]:
        repo = TimetableRepository(db)
        records = await repo.list_attendance(
            user_id=user_id,
            attendance_date=attendance_date,
            subject_id=subject_id,
        )
        return [self._attendance_to_response(r) for r in records]

    async def get_attendance_summary(
        self,
        db: AsyncSession,
        user_id: UUID,
        minimum_required: float = 75.0,
    ) -> AttendanceSummaryResponse:
        repo = TimetableRepository(db)
        records = await repo.list_attendance(user_id=user_id)
        subject_repo = SubjectRepository(db)
        all_subjects = await subject_repo.list_by_user(user_id)
        subject_map = {s.id: s for s in all_subjects}

        by_sub: dict[UUID, dict[str, int]] = {}
        for r in records:
            if r.subject_id not in by_sub:
                by_sub[r.subject_id] = {"total": 0, "present": 0, "absent": 0, "late": 0}
            by_sub[r.subject_id]["total"] += 1
            if r.status == "present":
                by_sub[r.subject_id]["present"] += 1
            elif r.status == "absent":
                by_sub[r.subject_id]["absent"] += 1
            elif r.status == "late":
                by_sub[r.subject_id]["late"] += 1

        subject_stats: list[SubjectAttendanceStats] = []
        total_all = 0
        present_all = 0
        absent_all = 0
        late_all = 0

        for sub_id, counts in by_sub.items():
            sub = subject_map.get(sub_id)
            total = counts["total"]
            pres = counts["present"]
            absn = counts["absent"]
            late = counts["late"]
            total_all += total
            present_all += pres
            absent_all += absn
            late_all += late

            pct = round(((pres + late) / total) * 100, 1) if total > 0 else 0.0
            subject_stats.append(
                SubjectAttendanceStats(
                    subject_id=sub_id,
                    subject_name=sub.name if sub else "Unknown Subject",
                    subject_color=sub.color if sub else None,
                    total_classes=total,
                    present_count=pres,
                    absent_count=absn,
                    late_count=late,
                    percentage=pct,
                    is_low_attendance=pct < minimum_required if total > 0 else False,
                )
            )

        overall_pct = round(((present_all + late_all) / total_all) * 100, 1) if total_all > 0 else 0.0
        return AttendanceSummaryResponse(
            total_classes=total_all,
            present_count=present_all,
            absent_count=absent_all,
            late_count=late_all,
            overall_percentage=overall_pct,
            minimum_required_percentage=minimum_required,
            is_overall_low=overall_pct < minimum_required if total_all > 0 else False,
            subjects=subject_stats,
        )


timetable_service = TimetableService()

