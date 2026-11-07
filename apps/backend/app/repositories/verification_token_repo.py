from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.verification_token import VerificationToken


class VerificationTokenRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, token: VerificationToken) -> VerificationToken:
        self.session.add(token)
        await self.session.flush()
        return token

    async def get_valid_token(
        self, token_hash: str, token_type: str
    ) -> VerificationToken | None:
        now = datetime.now(UTC)
        query = select(VerificationToken).where(
            VerificationToken.token_hash == token_hash,
            VerificationToken.token_type == token_type,
            VerificationToken.used_at.is_(None),
            VerificationToken.expires_at > now,
        )
        result = await self.session.execute(query)
        return result.scalars().first()

    async def get_latest_for_user(
        self, user_id: UUID, token_type: str
    ) -> VerificationToken | None:
        query = (
            select(VerificationToken)
            .where(
                VerificationToken.user_id == user_id,
                VerificationToken.token_type == token_type,
            )
            .order_by(VerificationToken.created_at.desc())
            .limit(1)
        )
        result = await self.session.execute(query)
        return result.scalars().first()

    async def mark_as_used(self, token_id: UUID) -> None:
        now = datetime.now(UTC)
        stmt = (
            update(VerificationToken)
            .where(VerificationToken.id == token_id)
            .values(used_at=now)
        )
        await self.session.execute(stmt)

    async def invalidate_user_tokens(self, user_id: UUID, token_type: str) -> None:
        now = datetime.now(UTC)
        stmt = (
            update(VerificationToken)
            .where(
                VerificationToken.user_id == user_id,
                VerificationToken.token_type == token_type,
                VerificationToken.used_at.is_(None),
            )
            .values(used_at=now)
        )
        await self.session.execute(stmt)

