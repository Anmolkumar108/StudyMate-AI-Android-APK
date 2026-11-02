from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ai_chat import AIChatMessage, AIChatSession


class AIChatRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_sessions_by_user(
        self,
        user_id: UUID,
        subject_id: UUID | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[AIChatSession]:
        stmt = (
            select(AIChatSession)
            .where(AIChatSession.user_id == user_id)
            .options(selectinload(AIChatSession.messages))
        )
        if subject_id is not None:
            stmt = stmt.where(AIChatSession.subject_id == subject_id)

        stmt = stmt.order_by(AIChatSession.updated_at.desc()).limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_sessions_by_user(
        self,
        user_id: UUID,
        subject_id: UUID | None = None,
    ) -> int:
        stmt = select(func.count(AIChatSession.id)).where(AIChatSession.user_id == user_id)
        if subject_id is not None:
            stmt = stmt.where(AIChatSession.subject_id == subject_id)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def get_session_by_id(
        self,
        session_id: UUID,
        user_id: UUID,
        load_messages: bool = True,
    ) -> AIChatSession | None:
        stmt = select(AIChatSession).where(
            AIChatSession.id == session_id,
            AIChatSession.user_id == user_id,
        )
        if load_messages:
            stmt = stmt.options(selectinload(AIChatSession.messages))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_session(self, chat_session: AIChatSession) -> AIChatSession:
        self.session.add(chat_session)
        await self.session.flush()
        await self.session.refresh(chat_session)
        return chat_session

    async def update_session(self, chat_session: AIChatSession) -> AIChatSession:
        await self.session.flush()
        await self.session.refresh(chat_session)
        return chat_session

    async def delete_session(self, chat_session: AIChatSession) -> None:
        await self.session.delete(chat_session)
        await self.session.flush()

    async def add_message(self, message: AIChatMessage) -> AIChatMessage:
        self.session.add(message)
        await self.session.flush()
        await self.session.refresh(message)
        return message

    async def get_session_messages(
        self,
        session_id: UUID,
        limit: int = 100,
    ) -> Sequence[AIChatMessage]:
        stmt = (
            select(AIChatMessage)
            .where(AIChatMessage.session_id == session_id)
            .order_by(AIChatMessage.created_at.asc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

