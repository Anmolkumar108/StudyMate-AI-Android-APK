import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_active_user, get_task_service
from app.main import app
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import User, UserRole, UserStatus
from app.services.task_service import (
    InvalidTaskSubjectError,
    TaskNotFoundError,
)


@pytest.fixture
def test_user() -> User:
    return User(
        id=uuid.uuid4(),
        email="taskstudent@test.com",
        hashed_password="argon2id$test",
        full_name="Task Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
    )


@pytest.fixture
def mock_task_service() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
async def authed_client(
    test_user: User,
    mock_task_service: AsyncMock,
) -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides[get_current_active_user] = lambda: test_user
    app.dependency_overrides[get_task_service] = lambda: mock_task_service
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def sample_task(test_user: User) -> Task:
    return Task(
        id=uuid.uuid4(),
        user_id=test_user.id,
        title="Software Engineering Milestone 1",
        description="Write SRS and architecture diagrams",
        priority=TaskPriority.HIGH,
        status=TaskStatus.TODO,
        estimated_minutes=90,
        subtasks=[{"id": str(uuid.uuid4()), "title": "Draw UML", "is_completed": False}],
        completed_at=None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
async def test_create_task_endpoint(
    authed_client: AsyncClient,
    mock_task_service: AsyncMock,
    sample_task: Task,
) -> None:
    mock_task_service.create_task.return_value = sample_task

    payload = {
        "title": "Software Engineering Milestone 1",
        "description": "Write SRS and architecture diagrams",
        "priority": "high",
        "estimated_minutes": 90,
    }
    response = await authed_client.post("/api/v1/tasks", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Software Engineering Milestone 1"
    assert data["priority"] == "high"


@pytest.mark.asyncio
async def test_list_tasks_endpoint(
    authed_client: AsyncClient,
    mock_task_service: AsyncMock,
    sample_task: Task,
) -> None:
    mock_task_service.list_tasks.return_value = (
        [sample_task],
        1,
        {"total": 1, "completed": 0, "pending": 1, "overdue": 0},
    )

    response = await authed_client.get("/api/v1/tasks?status=todo")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["title"] == sample_task.title
    assert data["pending_count"] == 1


@pytest.mark.asyncio
async def test_get_task_by_id_endpoint(
    authed_client: AsyncClient,
    mock_task_service: AsyncMock,
    sample_task: Task,
) -> None:
    mock_task_service.get_task.return_value = sample_task

    response = await authed_client.get(f"/api/v1/tasks/{sample_task.id}")
    assert response.status_code == 200
    assert response.json()["id"] == str(sample_task.id)


@pytest.mark.asyncio
async def test_get_task_not_found(
    authed_client: AsyncClient,
    mock_task_service: AsyncMock,
) -> None:
    mock_task_service.get_task.side_effect = TaskNotFoundError("Not found")

    response = await authed_client.get(f"/api/v1/tasks/{uuid.uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_task_endpoint(
    authed_client: AsyncClient,
    mock_task_service: AsyncMock,
    sample_task: Task,
) -> None:
    sample_task.status = TaskStatus.COMPLETED
    sample_task.completed_at = datetime.now(UTC)
    mock_task_service.update_task.return_value = sample_task

    response = await authed_client.patch(
        f"/api/v1/tasks/{sample_task.id}",
        json={"status": "completed"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_delete_task_endpoint(
    authed_client: AsyncClient,
    mock_task_service: AsyncMock,
    sample_task: Task,
) -> None:
    mock_task_service.delete_task.return_value = None

    response = await authed_client.delete(f"/api/v1/tasks/{sample_task.id}")
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_task_analytics_endpoint(
    authed_client: AsyncClient,
    mock_task_service: AsyncMock,
) -> None:
    mock_task_service.get_analytics.return_value = {
        "total_tasks": 10,
        "completed_tasks": 6,
        "pending_tasks": 4,
        "overdue_tasks": 1,
        "completion_rate": 60.0,
        "total_focus_minutes": 150,
        "total_focus_sessions": 6,
        "weekly_trends": [{"day": "Mon", "completed": 2, "created": 3}],
        "subject_workload": [
            {
                "subject_id": None,
                "subject_name": "General",
                "color": "#6366F1",
                "total_tasks": 10,
                "completed_tasks": 6,
                "pending_tasks": 4,
            }
        ],
    }

    response = await authed_client.get("/api/v1/tasks/analytics")
    assert response.status_code == 200
    data = response.json()
    assert data["total_tasks"] == 10
    assert data["completion_rate"] == 60.0


@pytest.mark.asyncio
async def test_ai_task_endpoints(
    authed_client: AsyncClient,
    mock_task_service: AsyncMock,
) -> None:
    mock_task_service.breakdown_task.return_value = [
        {"title": "Step 1: Read requirements", "estimated_minutes": 20},
        {"title": "Step 2: Implement code", "estimated_minutes": 60},
    ]

    mock_task_service.parse_natural_task.return_value = {
        "title": "Finish Math HW",
        "description": "Due tomorrow",
        "priority": "high",
        "due_datetime": None,
        "estimated_minutes": 60,
        "suggested_subtasks": ["Solve set 1"],
    }

    # 1. Breakdown
    res_b = await authed_client.post(
        "/api/v1/tasks/ai/breakdown",
        json={"title": "Math Assignment"},
    )
    assert res_b.status_code == 200
    assert len(res_b.json()["subtasks"]) == 2

    # 2. Parse natural
    res_p = await authed_client.post(
        "/api/v1/tasks/ai/parse-natural",
        json={"prompt": "Submit math homework tomorrow"},
    )
    assert res_p.status_code == 200
    assert res_p.json()["title"] == "Finish Math HW"


@pytest.mark.asyncio
async def test_log_focus_endpoint(
    authed_client: AsyncClient,
    mock_task_service: AsyncMock,
    sample_task: Task,
) -> None:
    sample_task.focus_minutes = 25
    sample_task.focus_sessions_count = 1
    mock_task_service.log_focus.return_value = sample_task

    res = await authed_client.post(
        f"/api/v1/tasks/{sample_task.id}/log-focus",
        json={"minutes": 25, "session_count": 1},
    )
    assert res.status_code == 200
    assert res.json()["focus_minutes"] == 25


