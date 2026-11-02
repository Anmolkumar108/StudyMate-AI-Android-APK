from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subject import Subject


class SubjectRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_by_user(self, user_id: UUID) -> Sequence[Subject]:
        """Fetch all subjects owned by a specific user.

        Strictly filtered by user_id.
        """
        stmt = (
            select(Subject)
            .where(Subject.user_id == user_id)
            .order_by(Subject.created_at.desc(), Subject.name.asc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_by_id_and_user(
        self, subject_id: UUID, user_id: UUID
    ) -> Subject | None:
        """Fetch a single subject strictly matching both subject_id and user_id.

        Never queries by ID alone to enforce cross-user isolation.
        """
        stmt = select(Subject).where(
            Subject.id == subject_id,
            Subject.user_id == user_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id(
        self, subject_id: UUID, user_id: UUID
    ) -> Subject | None:
        """Alias for get_by_id_and_user."""
        return await self.get_by_id_and_user(subject_id, user_id)

    async def get_by_user_and_name_lower(
        self, user_id: UUID, name: str
    ) -> Subject | None:
        """Fetch a subject matching user_id and case-insensitive trimmed name."""
        normalized = name.strip()
        stmt = select(Subject).where(
            Subject.user_id == user_id,
            func.lower(Subject.name) == func.lower(normalized),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, subject: Subject) -> Subject:
        """Persist a new subject to the database."""
        self.session.add(subject)
        await self.session.flush()
        return subject

    async def update(self, subject: Subject) -> Subject:
        """Flush changes to an existing subject."""
        await self.session.flush()
        return subject

    async def delete(self, subject: Subject) -> None:
        """Delete an existing subject from the database."""
        await self.session.delete(subject)
        await self.session.flush()
