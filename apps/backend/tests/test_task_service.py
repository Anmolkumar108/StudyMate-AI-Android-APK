import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock
from uuid import UUID

import pytest

from app.models.task import Task, TaskPriority, TaskStatus, TaskTemplate
from app.schemas.task import (
    CreateTaskFromTemplateRequest,
    TaskCreate,
    TaskUpdate,
)
from app.services.task_service import (
    CircularDependencyError,
    DependencyPrerequisiteError,
    InvalidAttachmentError,
    InvalidTaskSubjectError,
    TaskNotFoundError,
    TaskService,
)


@pytest.fixture
def mock_session() -> AsyncMock:
    session = AsyncMock()
    session.add = AsyncMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.delete = AsyncMock()
    return session


@pytest.fixture
def user_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def subject_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.mark.asyncio
async def test_create_task_success(mock_session: AsyncMock, user_id: uuid.UUID) -> None:
    service = TaskService(mock_session)

    sample_task = Task(
        id=uuid.uuid4(),
        user_id=user_id,
        title="Physics Lab Report",
        priority=TaskPriority.HIGH,
        status=TaskStatus.TODO,
        subtasks=[],
    )

    service.task_repo.create = AsyncMock(return_value=sample_task)
    service.task_repo.get_by_id = AsyncMock(return_value=sample_task)

    payload = TaskCreate(
        title="Physics Lab Report",
        priority=TaskPriority.HIGH,
    )

    created = await service.create_task(user_id, payload)
    assert created.title == "Physics Lab Report"
    assert created.priority == TaskPriority.HIGH
    assert service.task_repo.create.called


@pytest.mark.asyncio
async def test_create_task_invalid_subject(
    mock_session: AsyncMock, user_id: uuid.UUID, subject_id: uuid.UUID
) -> None:
    service = TaskService(mock_session)
    service.subject_repo.get_by_id = AsyncMock(return_value=None)

    payload = TaskCreate(
        title="Math Homework",
        subject_id=subject_id,
    )

    with pytest.raises(InvalidTaskSubjectError):
        await service.create_task(user_id, payload)


@pytest.mark.asyncio
async def test_get_task_not_found(mock_session: AsyncMock, user_id: uuid.UUID) -> None:
    service = TaskService(mock_session)
    service.task_repo.get_by_id = AsyncMock(return_value=None)

    with pytest.raises(TaskNotFoundError):
        await service.get_task(uuid.uuid4(), user_id)


@pytest.mark.asyncio
async def test_update_task_completed_at_transition(
    mock_session: AsyncMock, user_id: uuid.UUID
) -> None:
    service = TaskService(mock_session)

    task = Task(
        id=uuid.uuid4(),
        user_id=user_id,
        title="Database Project",
        status=TaskStatus.TODO,
        completed_at=None,
    )

    service.task_repo.get_by_id = AsyncMock(return_value=task)
    service.task_repo.update = AsyncMock(return_value=task)

    # 1. Mark completed -> completed_at should be populated
    payload = TaskUpdate(status=TaskStatus.COMPLETED)
    updated = await service.update_task(task.id, user_id, payload)
    assert updated.status == TaskStatus.COMPLETED
    assert task.status == TaskStatus.COMPLETED
    assert task.completed_at is not None

    # 2. Mark back to in_progress -> completed_at should be cleared
    payload2 = TaskUpdate(status=TaskStatus.IN_PROGRESS)
    updated2 = await service.update_task(task.id, user_id, payload2)
    assert updated2.status == TaskStatus.IN_PROGRESS
    assert task.status == TaskStatus.IN_PROGRESS
    assert task.completed_at is None


@pytest.mark.asyncio
async def test_delete_task(mock_session: AsyncMock, user_id: uuid.UUID) -> None:
    service = TaskService(mock_session)
    task = Task(id=uuid.uuid4(), user_id=user_id, title="Test Task", attachments=[])
    service.task_repo.get_by_id = AsyncMock(return_value=task)
    service.task_repo.delete = AsyncMock()

    await service.delete_task(task.id, user_id)
    service.task_repo.delete.assert_called_once_with(task)


# Advanced Tests: Dependencies & Cycles
@pytest.mark.asyncio
async def test_self_dependency_rejected(mock_session: AsyncMock, user_id: uuid.UUID) -> None:
    service = TaskService(mock_session)
    task_id = uuid.uuid4()
    task = Task(id=task_id, user_id=user_id, title="Self dependent task")
    service.task_repo.get_by_id = AsyncMock(return_value=task)

    with pytest.raises(CircularDependencyError):
        await service.update_task(task_id, user_id, TaskUpdate(depends_on_task_id=task_id))


@pytest.mark.asyncio
async def test_circular_dependency_detected(mock_session: AsyncMock, user_id: uuid.UUID) -> None:
    service = TaskService(mock_session)
    id_a = uuid.uuid4()
    id_b = uuid.uuid4()

    task_a = Task(id=id_a, user_id=user_id, title="Task A", depends_on_task_id=None)
    task_b = Task(id=id_b, user_id=user_id, title="Task B", depends_on_task_id=id_a)

    def mock_get(tid: UUID, uid: UUID) -> Task | None:
        if tid == id_a:
            return task_a
        if tid == id_b:
            return task_b
        return None

    service.task_repo.get_by_id = AsyncMock(side_effect=mock_get)

    # Task A setting depends_on Task B (which already depends on A) -> Cycle!
    with pytest.raises(CircularDependencyError):
        await service.update_task(id_a, user_id, TaskUpdate(depends_on_task_id=id_b))


@pytest.mark.asyncio
async def test_dependency_prerequisite_must_be_completed(
    mock_session: AsyncMock, user_id: uuid.UUID
) -> None:
    service = TaskService(mock_session)
    prereq_id = uuid.uuid4()
    task_id = uuid.uuid4()

    prereq_task = Task(id=prereq_id, user_id=user_id, title="Draft Document", status=TaskStatus.TODO)
    task = Task(
        id=task_id,
        user_id=user_id,
        title="Submit Document",
        status=TaskStatus.TODO,
        depends_on_task_id=prereq_id,
    )

    def mock_get(tid: UUID, uid: UUID) -> Task | None:
        if tid == prereq_id:
            return prereq_task
        if tid == task_id:
            return task
        return None

    service.task_repo.get_by_id = AsyncMock(side_effect=mock_get)

    # Trying to complete task when prereq is still TODO should raise DependencyPrerequisiteError
    with pytest.raises(DependencyPrerequisiteError):
        await service.update_task(task_id, user_id, TaskUpdate(status=TaskStatus.COMPLETED))


# Advanced Tests: Recurring Tasks
@pytest.mark.asyncio
async def test_recurring_task_spawns_next_occurrence(
    mock_session: AsyncMock, user_id: uuid.UUID
) -> None:
    service = TaskService(mock_session)
    task_id = uuid.uuid4()
    due = datetime.now(UTC)

    task = Task(
        id=task_id,
        user_id=user_id,
        title="Weekly Problem Set",
        due_datetime=due,
        status=TaskStatus.TODO,
        recurrence_pattern="weekly",
        recurrence_interval=1,
        subtasks=[{"id": "s1", "title": "Section A", "is_completed": True, "order": 0}],
    )

    service.task_repo.get_by_id = AsyncMock(return_value=task)
    service.task_repo.update = AsyncMock(return_value=task)

    created_tasks: list[Task] = []
    async def mock_create(t: Task) -> Task:
        created_tasks.append(t)
        return t
    service.task_repo.create = AsyncMock(side_effect=mock_create)

    # Completing recurring task
    await service.update_task(task_id, user_id, TaskUpdate(status=TaskStatus.COMPLETED))

    assert task.status == TaskStatus.COMPLETED
    assert task.completed_at is not None
    assert len(created_tasks) == 1
    next_task = created_tasks[0]
    assert next_task.title == "Weekly Problem Set"
    assert next_task.status == TaskStatus.TODO
    assert next_task.subtasks[0]["is_completed"] is False  # Reset for next week
    assert next_task.due_datetime > due


# Advanced Tests: Focus Mode Logging
@pytest.mark.asyncio
async def test_log_focus_session(mock_session: AsyncMock, user_id: uuid.UUID) -> None:
    service = TaskService(mock_session)
    task_id = uuid.uuid4()
    task = Task(
        id=task_id,
        user_id=user_id,
        title="Coding Assignment",
        focus_minutes=25,
        focus_sessions_count=1,
    )
    service.task_repo.get_by_id = AsyncMock(return_value=task)
    service.task_repo.update = AsyncMock(return_value=task)

    updated = await service.log_focus(task_id, user_id, minutes=50, session_count=2)
    assert updated.focus_minutes == 75
    assert task.focus_minutes == 75
    assert task.focus_sessions_count == 3


# Advanced Tests: Attachments
@pytest.mark.asyncio
async def test_add_and_delete_attachment(mock_session: AsyncMock, user_id: uuid.UUID) -> None:
    service = TaskService(mock_session)
    task_id = uuid.uuid4()
    task = Task(id=task_id, user_id=user_id, title="Assignment 1", attachments=[])
    service.task_repo.get_by_id = AsyncMock(return_value=task)
    service.task_repo.update = AsyncMock(return_value=task)

    service.storage_service.save_file = AsyncMock(return_value="local://documents/att-1.pdf")
    service.storage_service.read_file = AsyncMock(return_value=b"%PDF-1.4 dummy content")
    service.storage_service.delete_file = AsyncMock(return_value=True)

    # 1. Add PDF attachment
    updated = await service.add_attachment(
        task_id=task_id,
        user_id=user_id,
        filename="lecture.pdf",
        content_type="application/pdf",
        file_bytes=b"%PDF-1.4 dummy content",
    )
    assert len(updated.attachments) == 1
    assert len(task.attachments) == 1
    att_id = task.attachments[0]["id"]
    assert task.attachments[0]["file_name"] == "lecture.pdf"

    # 2. Read attachment
    data, fname, ctype = await service.get_attachment_data(task_id, user_id, att_id)
    assert data == b"%PDF-1.4 dummy content"
    assert fname == "lecture.pdf"

    # 3. Reject oversized file
    with pytest.raises(InvalidAttachmentError):
        await service.add_attachment(
            task_id=task_id,
            user_id=user_id,
            filename="huge.pdf",
            content_type="application/pdf",
            file_bytes=b"0" * (26 * 1024 * 1024),
        )

    # 4. Delete attachment
    await service.delete_attachment(task_id, user_id, att_id)
    assert len(task.attachments) == 0


# Advanced Tests: Templates
@pytest.mark.asyncio
async def test_task_template_workflow(mock_session: AsyncMock, user_id: uuid.UUID) -> None:
    service = TaskService(mock_session)
    tmpl_id = uuid.uuid4()
    tmpl = TaskTemplate(
        id=tmpl_id,
        user_id=user_id,
        title="Sprint Milestone",
        description="Deliverable sprint checklist",
        default_priority=TaskPriority.HIGH,
        estimated_minutes=120,
        subtasks=[{"title": "Task 1", "is_completed": False}],
        category="project",
        is_system=False,
    )

    service.task_repo.list_templates = AsyncMock(return_value=[tmpl])
    service.task_repo.get_template_by_id = AsyncMock(return_value=tmpl)
    service.task_repo.create_template = AsyncMock(return_value=tmpl)

    templates = await service.list_templates(user_id)
    assert len(templates) == 1

    # Create task from template
    created_task = Task(id=uuid.uuid4(), user_id=user_id, title="Sprint Milestone")
    service.task_repo.create = AsyncMock(return_value=created_task)
    service.task_repo.get_by_id = AsyncMock(return_value=created_task)

    task = await service.create_task_from_template(
        user_id,
        CreateTaskFromTemplateRequest(template_id=tmpl_id, custom_title="Custom Sprint 1"),
    )
    assert task is not None


# Advanced Tests: AI Assistance
@pytest.mark.asyncio
async def test_ai_task_breakdown(mock_session: AsyncMock) -> None:
    service = TaskService(mock_session)
    subtasks = await service.breakdown_task(title="Organic Chemistry Midterm Prep", description="Chapters 1 to 5")
    assert isinstance(subtasks, list)
    assert len(subtasks) >= 3
    assert "title" in subtasks[0]


@pytest.mark.asyncio
async def test_ai_parse_natural_prompt(mock_session: AsyncMock) -> None:
    service = TaskService(mock_session)
    parsed = await service.parse_natural_task("Submit urgent physics lab report tomorrow 2 hours")
    assert "title" in parsed
    assert parsed["priority"] in ("urgent", "high", "medium", "low")
    assert len(parsed["suggested_subtasks"]) > 0
