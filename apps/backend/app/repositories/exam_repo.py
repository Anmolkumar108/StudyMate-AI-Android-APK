from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.exam import Exam


class ExamRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_by_user(
        self,
        user_id: UUID,
        subject_id: UUID | None = None,
        upcoming_only: bool = False,
    ) -> Sequence[Exam]:
        """Fetch exams strictly scoped by user_id with optional subject and upcoming filters."""
        stmt = (
            select(Exam)
            .options(selectinload(Exam.subject))
            .where(Exam.user_id == user_id)
        )

        if subject_id is not None:
            stmt = stmt.where(Exam.subject_id == subject_id)

        if upcoming_only:
            now = datetime.now(UTC)
            stmt = stmt.where(Exam.exam_date >= now)

        stmt = stmt.order_by(Exam.exam_date.asc())
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_by_id_and_user(
        self, exam_id: UUID, user_id: UUID
    ) -> Exam | None:
        """Fetch a single exam strictly verifying user_id ownership. Never queries by id alone."""
        stmt = (
            select(Exam)
            .options(selectinload(Exam.subject))
            .where(Exam.id == exam_id, Exam.user_id == user_id)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def create(self, exam: Exam) -> Exam:
        """Persist a new exam."""
        self.session.add(exam)
        await self.session.flush()
        # Reload with subject relationship populated
        return await self.get_by_id_and_user(exam.id, exam.user_id) or exam

    async def update(self, exam: Exam) -> Exam:
        """Update existing exam."""
        exam.updated_at = datetime.now(UTC)
        await self.session.flush()
        return await self.get_by_id_and_user(exam.id, exam.user_id) or exam

    async def delete(self, exam: Exam) -> None:
        """Delete an exam."""
        await self.session.delete(exam)
        await self.session.flush()

    async def get_earliest_upcoming(self, user_id: UUID) -> Exam | None:
        """Fetch earliest upcoming exam for dashboard summary."""
        now = datetime.now(UTC)
        stmt = (
            select(Exam)
            .options(selectinload(Exam.subject))
            .where(Exam.user_id == user_id, Exam.exam_date >= now)
            .order_by(Exam.exam_date.asc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

