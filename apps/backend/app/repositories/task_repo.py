from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.subject import Subject
from app.models.task import Task, TaskPriority, TaskStatus, TaskTemplate


class TaskRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, task: Task) -> Task:
        self.session.add(task)
        await self.session.flush()
        await self.session.refresh(task)
        return task

    async def get_by_id(self, task_id: UUID, user_id: UUID) -> Task | None:
        """Fetch a task ensuring application-level ownership isolation."""
        stmt = (
            select(Task)
            .options(selectinload(Task.subject), selectinload(Task.depends_on))
            .where(Task.id == task_id, Task.user_id == user_id)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def list_by_user(
        self,
        user_id: UUID,
        status: TaskStatus | None = None,
        priority: TaskPriority | None = None,
        subject_id: UUID | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[Task]:
        """Fetch tasks owned by user with filters and deterministic sorting."""
        stmt = (
            select(Task)
            .options(selectinload(Task.subject), selectinload(Task.depends_on))
            .where(Task.user_id == user_id)
        )

        if status is not None:
            stmt = stmt.where(Task.status == status)

        if priority is not None:
            stmt = stmt.where(Task.priority == priority)

        if subject_id is not None:
            stmt = stmt.where(Task.subject_id == subject_id)

        if search is not None and search.strip():
            cleaned = search.strip()
            escaped = (
                cleaned.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            )
            pattern = f"%{escaped}%"
            stmt = stmt.where(
                or_(
                    Task.title.ilike(pattern, escape="\\"),
                    Task.description.ilike(pattern, escape="\\"),
                )
            )

        # Order: Active tasks first, then by earliest due date, then updated_at
        stmt = (
            stmt.order_by(
                (Task.status == TaskStatus.COMPLETED).asc(),
                (Task.status == TaskStatus.CANCELLED).asc(),
                Task.due_datetime.asc().nulls_last(),
                Task.updated_at.desc(),
            )
            .limit(limit)
            .offset(offset)
        )

        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_by_user(
        self,
        user_id: UUID,
        status: TaskStatus | None = None,
        priority: TaskPriority | None = None,
        subject_id: UUID | None = None,
        search: str | None = None,
    ) -> int:
        stmt = select(func.count(Task.id)).where(Task.user_id == user_id)

        if status is not None:
            stmt = stmt.where(Task.status == status)

        if priority is not None:
            stmt = stmt.where(Task.priority == priority)

        if subject_id is not None:
            stmt = stmt.where(Task.subject_id == subject_id)

        if search is not None and search.strip():
            cleaned = search.strip()
            escaped = (
                cleaned.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            )
            pattern = f"%{escaped}%"
            stmt = stmt.where(
                or_(
                    Task.title.ilike(pattern, escape="\\"),
                    Task.description.ilike(pattern, escape="\\"),
                )
            )

        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def get_stats_by_user(self, user_id: UUID) -> dict[str, int]:
        now = datetime.now(UTC)

        stmt = select(
            func.count(Task.id).label("total"),
            func.count(Task.id).filter(Task.status == TaskStatus.COMPLETED).label("completed"),
            func.count(Task.id).filter(Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS])).label("pending"),
            func.count(Task.id).filter(
                Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS]),
                Task.due_datetime < now,
            ).label("overdue"),
        ).where(Task.user_id == user_id)

        result = await self.session.execute(stmt)
        row = result.first()
        if not row:
            return {"total": 0, "completed": 0, "pending": 0, "overdue": 0}

        return {
            "total": row.total or 0,
            "completed": row.completed or 0,
            "pending": row.pending or 0,
            "overdue": row.overdue or 0,
        }

    async def get_analytics_by_user(self, user_id: UUID) -> dict[str, Any]:
        """Compute comprehensive analytics using real DB aggregation."""
        now = datetime.now(UTC)

        # 1. High-level counts
        summary_stmt = select(
            func.count(Task.id).label("total"),
            func.count(Task.id).filter(Task.status == TaskStatus.COMPLETED).label("completed"),
            func.count(Task.id).filter(Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS])).label("pending"),
            func.count(Task.id).filter(
                Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS]),
                Task.due_datetime < now,
            ).label("overdue"),
            func.coalesce(func.sum(Task.focus_minutes), 0).label("total_focus_minutes"),
            func.coalesce(func.sum(Task.focus_sessions_count), 0).label("total_focus_sessions"),
        ).where(Task.user_id == user_id)

        summary_res = await self.session.execute(summary_stmt)
        row = summary_res.first()

        total = row.total or 0 if row else 0
        completed = row.completed or 0 if row else 0
        pending = row.pending or 0 if row else 0
        overdue = row.overdue or 0 if row else 0
        focus_mins = int(row.total_focus_minutes or 0) if row else 0
        focus_sess = int(row.total_focus_sessions or 0) if row else 0
        completion_rate = round((completed / total * 100), 1) if total > 0 else 0.0

        # 2. Weekly trend (past 7 days including today)
        weekly_trends: list[dict[str, Any]] = []
        for i in range(6, -1, -1):
            day_target = (now - timedelta(days=i)).date()
            day_start = datetime.combine(day_target, datetime.min.time(), tzinfo=UTC)
            day_end = datetime.combine(day_target, datetime.max.time(), tzinfo=UTC)

            trend_stmt = select(
                func.count(Task.id).filter(
                    Task.completed_at >= day_start,
                    Task.completed_at <= day_end,
                ).label("completed"),
                func.count(Task.id).filter(
                    Task.created_at >= day_start,
                    Task.created_at <= day_end,
                ).label("created"),
            ).where(Task.user_id == user_id)

            t_res = await self.session.execute(trend_stmt)
            t_row = t_res.first()
            weekly_trends.append({
                "day": day_target.strftime("%a"),
                "completed": t_row.completed or 0 if t_row else 0,
                "created": t_row.created or 0 if t_row else 0,
            })

        # 3. Subject-wise workload
        workload_stmt = (
            select(
                Task.subject_id,
                Subject.name.label("subject_name"),
                Subject.color.label("color"),
                func.count(Task.id).label("total_tasks"),
                func.count(Task.id).filter(Task.status == TaskStatus.COMPLETED).label("completed_tasks"),
                func.count(Task.id).filter(Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS])).label("pending_tasks"),
            )
            .outerjoin(Subject, Task.subject_id == Subject.id)
            .where(Task.user_id == user_id)
            .group_by(Task.subject_id, Subject.name, Subject.color)
        )
        workload_res = await self.session.execute(workload_stmt)
        subject_workload: list[dict[str, Any]] = []
        for w_row in workload_res.all():
            subject_workload.append({
                "subject_id": w_row.subject_id,
                "subject_name": w_row.subject_name or "General",
                "color": w_row.color or "#6366F1",
                "total_tasks": w_row.total_tasks or 0,
                "completed_tasks": w_row.completed_tasks or 0,
                "pending_tasks": w_row.pending_tasks or 0,
            })

        return {
            "total_tasks": total,
            "completed_tasks": completed,
            "pending_tasks": pending,
            "overdue_tasks": overdue,
            "completion_rate": completion_rate,
            "total_focus_minutes": focus_mins,
            "total_focus_sessions": focus_sess,
            "weekly_trends": weekly_trends,
            "subject_workload": subject_workload,
        }

    # Template Management
    async def list_templates(self, user_id: UUID | None) -> Sequence[TaskTemplate]:
        stmt = (
            select(TaskTemplate)
            .where(
                or_(
                    TaskTemplate.is_system.is_(True),
                    TaskTemplate.user_id == user_id if user_id else False,
                )
            )
            .order_by(TaskTemplate.is_system.desc(), TaskTemplate.category.asc(), TaskTemplate.title.asc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_template_by_id(self, template_id: UUID, user_id: UUID | None = None) -> TaskTemplate | None:
        stmt = select(TaskTemplate).where(
            TaskTemplate.id == template_id,
            or_(
                TaskTemplate.is_system.is_(True),
                TaskTemplate.user_id == user_id if user_id else False,
            ),
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def create_template(self, template: TaskTemplate) -> TaskTemplate:
        self.session.add(template)
        await self.session.flush()
        await self.session.refresh(template)
        return template

    async def delete_template(self, template: TaskTemplate) -> None:
        await self.session.delete(template)
        await self.session.flush()

    async def update(self, task: Task) -> Task:
        await self.session.flush()
        await self.session.refresh(task)
        return task

    async def delete(self, task: Task) -> None:
        await self.session.delete(task)
        await self.session.flush()
