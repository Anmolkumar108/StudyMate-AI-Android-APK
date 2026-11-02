import uuid
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.models.task import TaskPriority, TaskStatus
from app.schemas.task import (
    SubtaskItem,
    TaskCreate,
    TaskListResponse,
    TaskResponse,
    TaskUpdate,
)


def test_subtask_item_valid() -> None:
    sub = SubtaskItem(title="Read Chapter 3")
    assert sub.title == "Read Chapter 3"
    assert sub.is_completed is False
    assert isinstance(sub.id, str)


def test_task_create_minimal() -> None:
    task_in = TaskCreate(title="Complete Algorithms Assignment 2")
    assert task_in.title == "Complete Algorithms Assignment 2"
    assert task_in.priority == TaskPriority.MEDIUM
    assert task_in.status == TaskStatus.TODO
    assert task_in.subtasks == []
    assert task_in.estimated_minutes is None


def test_task_create_full() -> None:
    sub1 = SubtaskItem(title="Draft outline", is_completed=True)
    sub2 = SubtaskItem(title="Write code", is_completed=False)
    now = datetime.now(UTC)

    task_in = TaskCreate(
        title="Final Project",
        description="Implement B-Tree in C++",
        subject_id=uuid.uuid4(),
        due_datetime=now,
        priority=TaskPriority.URGENT,
        status=TaskStatus.IN_PROGRESS,
        estimated_minutes=120,
        subtasks=[sub1, sub2],
    )
    assert task_in.priority == TaskPriority.URGENT
    assert task_in.status == TaskStatus.IN_PROGRESS
    assert len(task_in.subtasks) == 2
    assert task_in.estimated_minutes == 120


def test_task_create_validation_empty_title() -> None:
    with pytest.raises(ValidationError):
        TaskCreate(title="")


def test_task_create_validation_invalid_estimated_minutes() -> None:
    with pytest.raises(ValidationError):
        TaskCreate(title="Test", estimated_minutes=0)

    with pytest.raises(ValidationError):
        TaskCreate(title="Test", estimated_minutes=2000)


def test_task_update_partial() -> None:
    update = TaskUpdate(status=TaskStatus.COMPLETED)
    assert update.status == TaskStatus.COMPLETED
    assert update.title is None

