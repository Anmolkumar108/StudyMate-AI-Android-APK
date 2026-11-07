import uuid
from collections.abc import Sequence
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.study_session import StudySession


class StudySessionRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, study_session: StudySession) -> StudySession:
        self.session.add(study_session)
        await self.session.flush()
        await self.session.refresh(study_session)
        return study_session

    async def get_by_id(self, session_id: uuid.UUID, user_id: uuid.UUID) -> StudySession | None:
        stmt = (
            sa.select(StudySession)
            .where(StudySession.id == session_id)
            .where(StudySession.user_id == user_id)
            .options(
                selectinload(StudySession.subject),
                selectinload(StudySession.task),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        start_datetime: datetime | None = None,
        end_datetime: datetime | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[StudySession]:
        stmt = (
            sa.select(StudySession)
            .where(StudySession.user_id == user_id)
            .options(
                selectinload(StudySession.subject),
                selectinload(StudySession.task),
            )
            .order_by(StudySession.started_at.desc())
        )
        if start_datetime:
            stmt = stmt.where(StudySession.started_at >= start_datetime)
        if end_datetime:
            stmt = stmt.where(StudySession.started_at <= end_datetime)
        stmt = stmt.limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_sessions_in_range(
        self,
        user_id: uuid.UUID,
        start_datetime: datetime,
        end_datetime: datetime,
    ) -> Sequence[StudySession]:
        stmt = (
            sa.select(StudySession)
            .where(StudySession.user_id == user_id)
            .where(StudySession.started_at >= start_datetime)
            .where(StudySession.started_at <= end_datetime)
            .order_by(StudySession.started_at.asc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def delete(self, study_session: StudySession) -> None:
        await self.session.delete(study_session)
        await self.session.flush()

