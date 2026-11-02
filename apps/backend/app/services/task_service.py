import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task, TaskPriority, TaskStatus, TaskTemplate
from app.repositories.subject_repo import SubjectRepository
from app.repositories.task_repo import TaskRepository
from app.schemas.task import (
    CreateTaskFromTemplateRequest,
    TaskCreate,
    TaskTemplateCreate,
    TaskUpdate,
)
from app.services.ai_service import AIService
from app.services.storage_service import StorageService, get_storage_service


class TaskError(Exception):
    """Base domain exception for task operations."""


class TaskNotFoundError(TaskError):
    """Raised when a task is not found or does not belong to the user."""


class InvalidTaskSubjectError(TaskError):
    """Raised when an associated subject does not exist or does not belong to the user."""


class CircularDependencyError(TaskError):
    """Raised when a task dependency creates a circular loop or self-reference."""


class DependencyPrerequisiteError(TaskError):
    """Raised when attempting to complete a task whose prerequisite is not completed."""


class TemplateNotFoundError(TaskError):
    """Raised when a template is not found."""


class InvalidAttachmentError(TaskError):
    """Raised when an attachment is invalid, unsupported, or exceeds size limits."""


class TaskService:
    def __init__(
        self,
        session: AsyncSession,
        storage_service: StorageService | None = None,
        ai_service: AIService | None = None,
    ) -> None:
        self.session = session
        self.task_repo = TaskRepository(session)
        self.subject_repo = SubjectRepository(session)
        self.storage_service = storage_service or get_storage_service()
        self.ai_service = ai_service or AIService()

    async def list_tasks(
        self,
        user_id: UUID,
        status: TaskStatus | None = None,
        priority: TaskPriority | None = None,
        subject_id: UUID | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[Sequence[Task], int, dict[str, int]]:
        tasks = await self.task_repo.list_by_user(
            user_id=user_id,
            status=status,
            priority=priority,
            subject_id=subject_id,
            search=search,
            limit=limit,
            offset=offset,
        )
        total = await self.task_repo.count_by_user(
            user_id=user_id,
            status=status,
            priority=priority,
            subject_id=subject_id,
            search=search,
        )
        stats = await self.task_repo.get_stats_by_user(user_id)
        return tasks, total, stats

    async def get_task(self, task_id: UUID, user_id: UUID) -> Task:
        task = await self.task_repo.get_by_id(task_id, user_id)
        if not task:
            raise TaskNotFoundError(f"Task with ID {task_id} not found.")
        return task

    async def _validate_dependency(
        self,
        task_id: UUID | None,
        depends_on_task_id: UUID | None,
        user_id: UUID,
    ) -> None:
        """Enforce acyclic dependencies and ownership."""
        if depends_on_task_id is None:
            return

        if task_id is not None and depends_on_task_id == task_id:
            raise CircularDependencyError("A task cannot depend on itself.")

        prereq = await self.task_repo.get_by_id(depends_on_task_id, user_id)
        if not prereq:
            raise TaskNotFoundError(f"Prerequisite task {depends_on_task_id} not found or not owned by user.")

        # Traverse ancestor chain to prevent cycles
        current_id = prereq.depends_on_task_id
        hops = 0
        while current_id is not None and hops < 25:
            if task_id is not None and current_id == task_id:
                raise CircularDependencyError("Circular task dependency detected: this prerequisite chain forms a loop.")
            ancestor = await self.task_repo.get_by_id(current_id, user_id)
            if not ancestor:
                break
            current_id = ancestor.depends_on_task_id
            hops += 1

    async def _handle_recurrence_on_complete(self, task: Task) -> Task | None:
        """Create next recurring occurrence when a repeating task is marked completed."""
        if not task.recurrence_pattern:
            return None

        pattern = task.recurrence_pattern.lower().strip()
        interval = task.recurrence_interval or 1
        base_date = task.due_datetime or datetime.now(UTC)

        if pattern == "daily":
            next_due = base_date + timedelta(days=interval)
        elif pattern == "weekly":
            next_due = base_date + timedelta(weeks=interval)
        elif pattern == "monthly":
            next_due = base_date + timedelta(days=30 * interval)
        else:
            next_due = base_date + timedelta(days=interval)

        if task.recurrence_end_date and next_due > task.recurrence_end_date:
            return None

        # Reset subtasks for the new occurrence
        fresh_subtasks: list[dict[str, Any]] = []
        for s in (task.subtasks or []):
            item = dict(s)
            item["id"] = str(uuid.uuid4())
            item["is_completed"] = False
            fresh_subtasks.append(item)

        next_task = Task(
            user_id=task.user_id,
            subject_id=task.subject_id,
            title=task.title,
            description=task.description,
            due_datetime=next_due,
            priority=task.priority,
            status=TaskStatus.TODO,
            estimated_minutes=task.estimated_minutes,
            subtasks=fresh_subtasks,
            recurrence_pattern=task.recurrence_pattern,
            recurrence_interval=task.recurrence_interval,
            recurrence_end_date=task.recurrence_end_date,
            attachments=[],
            focus_minutes=0,
            focus_sessions_count=0,
            completed_at=None,
        )
        return await self.task_repo.create(next_task)

    async def create_task(self, user_id: UUID, payload: TaskCreate) -> Task:
        # Validate subject ownership if subject_id is provided
        if payload.subject_id is not None:
            subject = await self.subject_repo.get_by_id(payload.subject_id, user_id)
            if not subject:
                raise InvalidTaskSubjectError(
                    f"Subject {payload.subject_id} not found or not owned by user."
                )

        # Validate prerequisite dependency
        if payload.depends_on_task_id is not None:
            await self._validate_dependency(None, payload.depends_on_task_id, user_id)

        completed_at = datetime.now(UTC) if payload.status == TaskStatus.COMPLETED else None
        serialized_subtasks = [s.model_dump() for s in payload.subtasks]

        task = Task(
            user_id=user_id,
            subject_id=payload.subject_id,
            depends_on_task_id=payload.depends_on_task_id,
            title=payload.title.strip(),
            description=payload.description.strip() if payload.description else None,
            due_datetime=payload.due_datetime,
            priority=payload.priority,
            status=payload.status,
            estimated_minutes=payload.estimated_minutes,
            subtasks=serialized_subtasks,
            recurrence_pattern=payload.recurrence_pattern,
            recurrence_interval=payload.recurrence_interval or 1,
            recurrence_end_date=payload.recurrence_end_date,
            attachments=[],
            focus_minutes=0,
            focus_sessions_count=0,
            completed_at=completed_at,
        )

        created_task = await self.task_repo.create(task)
        return await self.get_task(created_task.id, user_id)

    async def update_task(self, task_id: UUID, user_id: UUID, payload: TaskUpdate) -> Task:
        task = await self.get_task(task_id, user_id)

        update_data = payload.model_dump(exclude_unset=True)

        if "subject_id" in update_data and update_data["subject_id"] is not None:
            subject = await self.subject_repo.get_by_id(update_data["subject_id"], user_id)
            if not subject:
                raise InvalidTaskSubjectError(
                    f"Subject {update_data['subject_id']} not found or not owned by user."
                )

        if "depends_on_task_id" in update_data:
            target_dep = update_data["depends_on_task_id"]
            if target_dep is not None:
                await self._validate_dependency(task_id, target_dep, user_id)
            task.depends_on_task_id = target_dep

        if "subtasks" in update_data and update_data["subtasks"] is not None:
            task.subtasks = [
                s if isinstance(s, dict) else s.model_dump()
                for s in update_data["subtasks"]
            ]

        # Manage completed_at transitions and prerequisite checks
        if "status" in update_data and update_data["status"] is not None:
            new_status = update_data["status"]
            if new_status == TaskStatus.COMPLETED and task.status != TaskStatus.COMPLETED:
                # Check prerequisite task completion
                if task.depends_on_task_id:
                    prereq = await self.task_repo.get_by_id(task.depends_on_task_id, user_id)
                    if prereq and prereq.status != TaskStatus.COMPLETED:
                        raise DependencyPrerequisiteError(
                            f"Cannot complete task until prerequisite task '{prereq.title}' is completed."
                        )
                task.completed_at = datetime.now(UTC)
                task.status = TaskStatus.COMPLETED
                # Auto-spawn recurring task if recurrence is configured
                await self._handle_recurrence_on_complete(task)
            elif new_status != TaskStatus.COMPLETED and task.status == TaskStatus.COMPLETED:
                task.completed_at = None
                task.status = new_status
            else:
                task.status = new_status

        if "title" in update_data and update_data["title"] is not None:
            task.title = update_data["title"].strip()
        if "description" in update_data:
            task.description = update_data["description"].strip() if update_data["description"] else None
        if "due_datetime" in update_data:
            task.due_datetime = update_data["due_datetime"]
        if "priority" in update_data and update_data["priority"] is not None:
            task.priority = update_data["priority"]
        if "estimated_minutes" in update_data:
            task.estimated_minutes = update_data["estimated_minutes"]
        if "subject_id" in update_data:
            task.subject_id = update_data["subject_id"]
        if "recurrence_pattern" in update_data:
            task.recurrence_pattern = update_data["recurrence_pattern"]
        if "recurrence_interval" in update_data:
            task.recurrence_interval = update_data["recurrence_interval"]
        if "recurrence_end_date" in update_data:
            task.recurrence_end_date = update_data["recurrence_end_date"]

        task.updated_at = datetime.now(UTC)
        await self.task_repo.update(task)
        return await self.get_task(task.id, user_id)

    async def delete_task(self, task_id: UUID, user_id: UUID) -> None:
        task = await self.get_task(task_id, user_id)
        # Delete any physical files stored for attachments
        for att in (task.attachments or []):
            if "storage_key" in att:
                try:
                    await self.storage_service.delete_file(att["storage_key"])
                except Exception:
                    pass
        await self.task_repo.delete(task)

    # Focus Mode Logging
    async def log_focus(
        self,
        task_id: UUID,
        user_id: UUID,
        minutes: int,
        session_count: int = 1,
    ) -> Task:
        task = await self.get_task(task_id, user_id)
        task.focus_minutes = (task.focus_minutes or 0) + minutes
        task.focus_sessions_count = (task.focus_sessions_count or 0) + session_count
        task.updated_at = datetime.now(UTC)
        await self.task_repo.update(task)
        return await self.get_task(task.id, user_id)

    # Attachments Management
    async def add_attachment(
        self,
        task_id: UUID,
        user_id: UUID,
        filename: str,
        content_type: str,
        file_bytes: bytes,
    ) -> Task:
        task = await self.get_task(task_id, user_id)

        if len(file_bytes) > 25 * 1024 * 1024:
            raise InvalidAttachmentError("Attachment file size exceeds maximum limit of 25 MB.")

        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        allowed_exts = {"pdf", "jpg", "jpeg", "png", "webp"}
        allowed_types = {
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
        }
        if ext not in allowed_exts and content_type not in allowed_types:
            raise InvalidAttachmentError("Only PDF and image files (PNG, JPG, WEBP) are supported.")

        att_id = uuid.uuid4()
        storage_key = await self.storage_service.save_file(
            user_id=user_id,
            file_id=att_id,
            filename=filename,
            content=file_bytes,
        )

        attachment_record = {
            "id": str(att_id),
            "file_name": filename,
            "file_type": content_type or f"application/{ext}",
            "file_size": len(file_bytes),
            "storage_key": storage_key,
            "created_at": datetime.now(UTC).isoformat(),
        }

        task.attachments = list(task.attachments or []) + [attachment_record]
        task.updated_at = datetime.now(UTC)
        await self.task_repo.update(task)
        return await self.get_task(task.id, user_id)

    async def get_attachment_data(
        self,
        task_id: UUID,
        user_id: UUID,
        attachment_id: str,
    ) -> tuple[bytes, str, str]:
        task = await self.get_task(task_id, user_id)
        att = next((a for a in (task.attachments or []) if a.get("id") == attachment_id), None)
        if not att:
            raise InvalidAttachmentError("Attachment not found.")

        data = await self.storage_service.read_file(att["storage_key"])
        return data, att["file_name"], att["file_type"]

    async def delete_attachment(
        self,
        task_id: UUID,
        user_id: UUID,
        attachment_id: str,
    ) -> Task:
        task = await self.get_task(task_id, user_id)
        att = next((a for a in (task.attachments or []) if a.get("id") == attachment_id), None)
        if not att:
            raise InvalidAttachmentError("Attachment not found.")

        try:
            await self.storage_service.delete_file(att["storage_key"])
        except Exception:
            pass

        task.attachments = [a for a in (task.attachments or []) if a.get("id") != attachment_id]
        task.updated_at = datetime.now(UTC)
        await self.task_repo.update(task)
        return await self.get_task(task.id, user_id)

    # Template Management
    async def list_templates(self, user_id: UUID) -> Sequence[TaskTemplate]:
        return await self.task_repo.list_templates(user_id)

    async def get_template(self, template_id: UUID, user_id: UUID) -> TaskTemplate:
        tmpl = await self.task_repo.get_template_by_id(template_id, user_id)
        if not tmpl:
            raise TemplateNotFoundError(f"Task template with ID {template_id} not found.")
        return tmpl

    async def create_template(self, user_id: UUID, payload: TaskTemplateCreate) -> TaskTemplate:
        serialized_subtasks = [s.model_dump() for s in payload.subtasks]
        tmpl = TaskTemplate(
            user_id=user_id,
            title=payload.title.strip(),
            description=payload.description.strip() if payload.description else None,
            default_priority=payload.default_priority,
            estimated_minutes=payload.estimated_minutes,
            subtasks=serialized_subtasks,
            category=payload.category,
            is_system=False,
        )
        return await self.task_repo.create_template(tmpl)

    async def delete_template(self, template_id: UUID, user_id: UUID) -> None:
        tmpl = await self.get_template(template_id, user_id)
        if tmpl.is_system:
            raise TaskError("Built-in system templates cannot be deleted.")
        if tmpl.user_id != user_id:
            raise TemplateNotFoundError("Template not owned by user.")
        await self.task_repo.delete_template(tmpl)

    async def create_task_from_template(
        self,
        user_id: UUID,
        payload: CreateTaskFromTemplateRequest,
    ) -> Task:
        tmpl = await self.get_template(payload.template_id, user_id)

        # Clone subtasks with new UUIDs
        fresh_subtasks: list[dict[str, Any]] = []
        for s in (tmpl.subtasks or []):
            item = dict(s)
            item["id"] = str(uuid.uuid4())
            item["is_completed"] = False
            fresh_subtasks.append(item)

        task = Task(
            user_id=user_id,
            subject_id=payload.subject_id,
            title=payload.custom_title.strip() if payload.custom_title else tmpl.title,
            description=tmpl.description,
            due_datetime=payload.due_datetime,
            priority=tmpl.default_priority,
            status=TaskStatus.TODO,
            estimated_minutes=tmpl.estimated_minutes,
            subtasks=fresh_subtasks,
            attachments=[],
            focus_minutes=0,
            focus_sessions_count=0,
        )
        created = await self.task_repo.create(task)
        return await self.get_task(created.id, user_id)

    # Analytics
    async def get_analytics(self, user_id: UUID) -> dict[str, Any]:
        return await self.task_repo.get_analytics_by_user(user_id)

    # AI Task Assistance
    async def breakdown_task(
        self,
        title: str,
        description: str | None = None,
        estimated_minutes: int | None = None,
    ) -> list[dict[str, Any]]:
        return await self.ai_service.breakdown_task(title, description, estimated_minutes)

    async def suggest_schedule(
        self,
        user_id: UUID,
        available_hours_per_day: float = 3.0,
    ) -> dict[str, Any]:
        tasks, _, _ = await self.list_tasks(user_id, status=TaskStatus.TODO, limit=30)
        serialized = [
            {
                "id": str(t.id),
                "title": t.title,
                "priority": t.priority.value,
                "due_datetime": t.due_datetime.isoformat() if t.due_datetime else None,
                "estimated_minutes": t.estimated_minutes or 45,
            }
            for t in tasks
        ]
        return await self.ai_service.suggest_schedule(serialized, available_hours_per_day)

    async def parse_natural_task(self, prompt: str) -> dict[str, Any]:
        return await self.ai_service.parse_natural_task(prompt)

    async def get_daily_briefing(self, user_id: UUID) -> dict[str, Any]:
        tasks, _, _ = await self.list_tasks(user_id, limit=20)
        pending = [
            {
                "id": str(t.id),
                "title": t.title,
                "priority": t.priority.value,
                "due_datetime": t.due_datetime.isoformat() if t.due_datetime else None,
            }
            for t in tasks
            if t.status in (TaskStatus.TODO, TaskStatus.IN_PROGRESS)
        ]
        return await self.ai_service.get_daily_briefing(pending)
