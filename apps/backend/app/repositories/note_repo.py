from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.note import Note


class NoteRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_by_user(
        self,
        user_id: UUID,
        search: str | None = None,
        subject_id: UUID | None = None,
        is_pinned: bool | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[Note]:
        """Fetch notes owned by a specific user with optional search, filters, and pagination.

        Strictly filtered by user_id to enforce cross-user isolation.
        """
        stmt = select(Note).where(Note.user_id == user_id)

        if subject_id is not None:
            stmt = stmt.where(Note.subject_id == subject_id)

        if is_pinned is not None:
            stmt = stmt.where(Note.is_pinned == is_pinned)

        if search is not None and search.strip():
            cleaned = search.strip()
            # Escape SQL wildcards to prevent unintended pattern matching
            escaped = (
                cleaned.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            )
            pattern = f"%{escaped}%"
            stmt = stmt.where(
                or_(
                    Note.title.ilike(pattern, escape="\\"),
                    Note.content.ilike(pattern, escape="\\"),
                )
            )

        stmt = (
            stmt.order_by(
                Note.is_pinned.desc(),
                Note.updated_at.desc(),
                Note.created_at.desc(),
            )
            .limit(limit)
            .offset(offset)
        )

        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_by_id_and_user(self, note_id: UUID, user_id: UUID) -> Note | None:
        """Fetch a single note strictly matching both note_id and user_id.

        Never queries by ID alone to enforce cross-user isolation.
        """
        stmt = select(Note).where(
            Note.id == note_id,
            Note.user_id == user_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id(self, note_id: UUID, user_id: UUID) -> Note | None:
        """Alias for get_by_id_and_user."""
        return await self.get_by_id_and_user(note_id, user_id)

    async def create(self, note: Note) -> Note:
        """Persist a new note to the database."""
        self.session.add(note)
        await self.session.flush()
        return note

    async def update(self, note: Note) -> Note:
        """Flush changes to an existing note."""
        await self.session.flush()
        return note

    async def delete(self, note: Note) -> None:
        """Delete an existing note from the database."""
        await self.session.delete(note)
        await self.session.flush()
