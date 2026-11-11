import uuid
from datetime import UTC, datetime
from typing import Sequence

from sqlalchemy import delete, desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.announcement import (
    Announcement,
    AnnouncementSeverity,
    AnnouncementTarget,
)


class AnnouncementRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        title: str,
        message: str,
        severity: AnnouncementSeverity = AnnouncementSeverity.INFO,
        target_audience: AnnouncementTarget = AnnouncementTarget.ALL,
        created_by: uuid.UUID | None = None,
        expires_at: datetime | None = None,
    ) -> Announcement:
        announcement = Announcement(
            title=title,
            message=message,
            severity=severity,
            target_audience=target_audience,
            created_by=created_by,
            expires_at=expires_at,
            is_active=True,
        )
        self.session.add(announcement)
        await self.session.flush()
        await self.session.refresh(announcement)
        return announcement

    async def get_by_id(self, announcement_id: uuid.UUID) -> Announcement | None:
        stmt = select(Announcement).where(Announcement.id == announcement_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(
        self,
        limit: int = 50,
        offset: int = 0,
        active_only: bool = False,
    ) -> tuple[Sequence[Announcement], int]:
        stmt = select(Announcement)
        if active_only:
            stmt = stmt.where(Announcement.is_active.is_(True))

        count_stmt = select(Announcement.id)
        if active_only:
            count_stmt = count_stmt.where(Announcement.is_active.is_(True))
        count_res = await self.session.execute(count_stmt)
        total = len(count_res.scalars().all())

        stmt = stmt.order_by(desc(Announcement.created_at)).limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return result.scalars().all(), total

    async def list_active_for_students(self, limit: int = 10) -> Sequence[Announcement]:
        now = datetime.now(UTC)
        stmt = (
            select(Announcement)
            .where(
                Announcement.is_active.is_(True),
                or_(Announcement.expires_at.is_(None), Announcement.expires_at > now),
            )
            .order_by(desc(Announcement.created_at))
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def delete(self, announcement_id: uuid.UUID) -> bool:
        stmt = delete(Announcement).where(Announcement.id == announcement_id)
        result = await self.session.execute(stmt)
        return (result.rowcount or 0) > 0

    async def set_active(self, announcement_id: uuid.UUID, is_active: bool) -> Announcement | None:
        announcement = await self.get_by_id(announcement_id)
        if announcement:
            announcement.is_active = is_active
            await self.session.flush()
            await self.session.refresh(announcement)
        return announcement
