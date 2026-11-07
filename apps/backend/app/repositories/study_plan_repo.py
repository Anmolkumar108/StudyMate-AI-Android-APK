import uuid
from collections.abc import Sequence
from datetime import date

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.study_plan import StudyPlan


class StudyPlanRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, plan_id: uuid.UUID, user_id: uuid.UUID) -> StudyPlan | None:
        stmt = (
            sa.select(StudyPlan)
            .where(StudyPlan.id == plan_id)
            .where(StudyPlan.user_id == user_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_date(self, plan_date: date, user_id: uuid.UUID) -> StudyPlan | None:
        stmt = (
            sa.select(StudyPlan)
            .where(StudyPlan.plan_date == plan_date)
            .where(StudyPlan.user_id == user_id)
            .order_by(StudyPlan.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def create(self, plan: StudyPlan) -> StudyPlan:
        self.session.add(plan)
        await self.session.flush()
        await self.session.refresh(plan)
        return plan

    async def update(self, plan: StudyPlan) -> StudyPlan:
        await self.session.flush()
        await self.session.refresh(plan)
        return plan

    async def delete(self, plan: StudyPlan) -> None:
        await self.session.delete(plan)
        await self.session.flush()

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        limit: int = 30,
        offset: int = 0,
    ) -> Sequence[StudyPlan]:
        stmt = (
            sa.select(StudyPlan)
            .where(StudyPlan.user_id == user_id)
            .order_by(StudyPlan.plan_date.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

