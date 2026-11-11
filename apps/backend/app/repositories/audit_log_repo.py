import inspect
import uuid
from typing import Sequence

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.audit_log import AuditLog


class AuditLogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def log(
        self,
        action: str,
        target_type: str,
        actor_id: uuid.UUID | None = None,
        target_id: str | None = None,
        details: str | None = None,
        ip_address: str | None = None,
        commit: bool = False,
    ) -> AuditLog:
        audit_entry = AuditLog(
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details,
            ip_address=ip_address,
        )
        res = self.session.add(audit_entry)
        if inspect.isawaitable(res):
            await res
        await self.session.flush()
        if commit:
            commit_res = self.session.commit()
            if inspect.isawaitable(commit_res):
                await commit_res
        else:
            await self.session.refresh(audit_entry)
        return audit_entry

    async def list_logs(
        self,
        limit: int = 50,
        offset: int = 0,
        action: str | None = None,
        target_type: str | None = None,
        actor_id: uuid.UUID | None = None,
    ) -> tuple[Sequence[AuditLog], int]:
        stmt = select(AuditLog).options(joinedload(AuditLog.actor))

        if action:
            stmt = stmt.where(AuditLog.action == action)
        if target_type:
            stmt = stmt.where(AuditLog.target_type == target_type)
        if actor_id:
            stmt = stmt.where(AuditLog.actor_id == actor_id)

        # Count total
        count_stmt = select(AuditLog.id)
        if action:
            count_stmt = count_stmt.where(AuditLog.action == action)
        if target_type:
            count_stmt = count_stmt.where(AuditLog.target_type == target_type)
        if actor_id:
            count_stmt = count_stmt.where(AuditLog.actor_id == actor_id)

        count_res = await self.session.execute(count_stmt)
        total = len(count_res.scalars().all())

        stmt = stmt.order_by(desc(AuditLog.created_at)).limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return result.scalars().all(), total

