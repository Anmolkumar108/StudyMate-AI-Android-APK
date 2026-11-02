from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import DocStatus, Document


class DocumentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_by_user(
        self,
        user_id: UUID,
        subject_id: UUID | None = None,
        status: DocStatus | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[Document]:
        """Fetch documents owned by a specific user with strict tenant isolation."""
        stmt = select(Document).where(Document.user_id == user_id)

        if subject_id is not None:
            stmt = stmt.where(Document.subject_id == subject_id)

        if status is not None:
            stmt = stmt.where(Document.status == status)

        if search is not None and search.strip():
            cleaned = search.strip()
            escaped = (
                cleaned.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            )
            pattern = f"%{escaped}%"
            stmt = stmt.where(
                or_(
                    Document.title.ilike(pattern, escape="\\"),
                    Document.file_name.ilike(pattern, escape="\\"),
                )
            )

        stmt = stmt.order_by(Document.created_at.desc()).limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_by_user(
        self,
        user_id: UUID,
        subject_id: UUID | None = None,
        status: DocStatus | None = None,
    ) -> int:
        stmt = select(func.count(Document.id)).where(Document.user_id == user_id)
        if subject_id is not None:
            stmt = stmt.where(Document.subject_id == subject_id)
        if status is not None:
            stmt = stmt.where(Document.status == status)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def get_by_id(self, document_id: UUID, user_id: UUID) -> Document | None:
        """Fetch a single document strictly verifying tenant ownership."""
        stmt = select(Document).where(
            Document.id == document_id,
            Document.user_id == user_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, document: Document) -> Document:
        self.session.add(document)
        await self.session.flush()
        await self.session.refresh(document)
        return document

    async def update(self, document: Document) -> Document:
        await self.session.flush()
        await self.session.refresh(document)
        return document

    async def delete(self, document: Document) -> None:
        await self.session.delete(document)
        await self.session.flush()

