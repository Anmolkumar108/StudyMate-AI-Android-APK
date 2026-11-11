import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import (
    get_admin_service,
    get_current_active_user,
    get_current_admin_user,
    require_super_admin,
    require_support_admin,
)
from app.core.security import hash_password
from app.main import app
from app.models.subject import Subject
from app.models.subject_template import SubjectTemplate
from app.models.task import TaskPriority, TaskTemplate
from app.models.user import User, UserRole, UserStatus


@pytest.fixture
def super_admin_user() -> User:
    return User(
        id=uuid.uuid4(),
        email="superadmin@studymate.ai",
        hashed_password=hash_password("SuperSecret123!"),
        full_name="Super Administrator",
        role=UserRole.SUPER_ADMIN,
        status=UserStatus.ACTIVE,
        created_at=datetime.now(UTC),
        token_version=1,
    )


@pytest.fixture
def student_user() -> User:
    return User(
        id=uuid.uuid4(),
        email="student@studymate.ai",
        hashed_password=hash_password("StudentPass123!"),
        full_name="Regular Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
        created_at=datetime.now(UTC),
        token_version=1,
    )


@pytest.fixture
def mock_admin_service() -> MagicMock:
    service = MagicMock()
    service.list_subject_templates = AsyncMock()
    service.create_subject_template = AsyncMock()
    service.update_subject_template = AsyncMock()
    service.delete_subject_template = AsyncMock()
    service.seed_default_subject_templates = AsyncMock()
    service.enroll_student_in_template = AsyncMock()
    service.list_system_task_templates = AsyncMock()
    service.create_system_task_template = AsyncMock()
    service.delete_system_task_template = AsyncMock()
    service.list_staff_users = AsyncMock()
    service.create_staff_user = AsyncMock()
    service.update_staff_status = AsyncMock()
    service.update_staff_role = AsyncMock()
    service.reset_staff_password = AsyncMock()
    service.delete_staff_user = AsyncMock()
    return service


@pytest.fixture
async def admin_client(
    super_admin_user: User,
    mock_admin_service: MagicMock,
) -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides[get_current_active_user] = lambda: super_admin_user
    app.dependency_overrides[get_current_admin_user] = lambda: super_admin_user
    app.dependency_overrides[require_super_admin] = lambda: super_admin_user
    app.dependency_overrides[require_support_admin] = lambda: super_admin_user
    app.dependency_overrides[get_admin_service] = lambda: mock_admin_service

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_list_and_create_subject_templates(
    admin_client: AsyncClient, mock_admin_service: MagicMock, super_admin_user: User
) -> None:
    template_id = uuid.uuid4()
    mock_template = SubjectTemplate(
        id=template_id,
        name="Data Structures & Algorithms",
        code="CS-201",
        category="Computer Science",
        description="Core CS curriculum",
        color="#6366F1",
        credits=4,
        difficulty_level="intermediate",
        suggested_units=[{"title": "Unit 1: Trees", "weeks": 3}],
        is_active=True,
        enrolled_count=12,
        created_by=super_admin_user.id,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    mock_admin_service.list_subject_templates.return_value = ([mock_template], 1, ["Computer Science"])
    mock_admin_service.create_subject_template.return_value = mock_template

    # 1. List
    list_resp = await admin_client.get("/api/v1/admin/templates/subjects")
    assert list_resp.status_code == 200
    data = list_resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Data Structures & Algorithms"
    assert "Computer Science" in data["categories"]

    # 2. Create
    create_resp = await admin_client.post(
        "/api/v1/admin/templates/subjects",
        json={
            "name": "Data Structures & Algorithms",
            "code": "CS-201",
            "category": "Computer Science",
            "description": "Core CS curriculum",
            "color": "#6366F1",
            "credits": 4,
            "difficulty_level": "intermediate",
            "suggested_units": [{"title": "Unit 1: Trees", "weeks": 3}],
            "is_active": True,
        },
    )
    assert create_resp.status_code == 201
    assert create_resp.json()["name"] == "Data Structures & Algorithms"


@pytest.mark.asyncio
async def test_seed_and_modify_subject_templates(
    admin_client: AsyncClient, mock_admin_service: MagicMock
) -> None:
    template_id = uuid.uuid4()
    mock_template = SubjectTemplate(
        id=template_id,
        name="Calculus I",
        code="MATH-101",
        category="Mathematics",
        color="#10B981",
        credits=4,
        difficulty_level="intermediate",
        suggested_units=[],
        is_active=True,
        enrolled_count=0,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    mock_admin_service.seed_default_subject_templates.return_value = [mock_template]
    mock_admin_service.update_subject_template.return_value = mock_template
    mock_admin_service.delete_subject_template.return_value = True

    # Seed
    seed_resp = await admin_client.post("/api/v1/admin/templates/subjects/seed-defaults")
    assert seed_resp.status_code == 200
    assert len(seed_resp.json()) == 1

    # Update
    update_resp = await admin_client.patch(
        f"/api/v1/admin/templates/subjects/{template_id}",
        json={"credits": 5},
    )
    assert update_resp.status_code == 200

    # Delete
    del_resp = await admin_client.delete(f"/api/v1/admin/templates/subjects/{template_id}")
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_system_task_templates(
    admin_client: AsyncClient, mock_admin_service: MagicMock
) -> None:
    task_id = uuid.uuid4()
    mock_task = TaskTemplate(
        id=task_id,
        title="7-Day Final Exam Sprint",
        description="Comprehensive review roadmap",
        default_priority=TaskPriority.HIGH,
        estimated_minutes=120,
        category="exam_prep",
        subtasks=[{"title": "Review formula sheet", "is_completed": False}],
        is_system=True,
        created_at=datetime.now(UTC),
    )
    mock_admin_service.list_system_task_templates.return_value = [mock_task]
    mock_admin_service.create_system_task_template.return_value = mock_task
    mock_admin_service.delete_system_task_template.return_value = True

    # 1. List
    list_resp = await admin_client.get("/api/v1/admin/templates/tasks")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1
    assert list_resp.json()[0]["title"] == "7-Day Final Exam Sprint"

    # 2. Create
    create_resp = await admin_client.post(
        "/api/v1/admin/templates/tasks",
        json={
            "title": "7-Day Final Exam Sprint",
            "description": "Comprehensive review roadmap",
            "default_priority": "high",
            "estimated_minutes": 120,
            "category": "exam_prep",
            "subtasks": [{"title": "Review formula sheet", "is_completed": False}],
        },
    )
    assert create_resp.status_code == 201

    # 3. Delete
    del_resp = await admin_client.delete(f"/api/v1/admin/templates/tasks/{task_id}")
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_staff_management(
    admin_client: AsyncClient, mock_admin_service: MagicMock
) -> None:
    staff_user = User(
        id=uuid.uuid4(),
        email="support@studymate.ai",
        full_name="Support Agent",
        role=UserRole.SUPPORT_ADMIN,
        status=UserStatus.ACTIVE,
        hashed_password="hashed_pw",
        created_at=datetime.now(UTC),
    )
    mock_admin_service.list_staff_users.return_value = [staff_user]
    mock_admin_service.create_staff_user.return_value = staff_user

    # 1. List staff
    list_resp = await admin_client.get("/api/v1/admin/staff")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1
    assert list_resp.json()[0]["role"] == "support_admin"

    # 2. Create staff
    create_resp = await admin_client.post(
        "/api/v1/admin/staff",
        json={
            "email": "support@studymate.ai",
            "full_name": "Support Agent",
            "role": "support_admin",
            "password": "SecurePassword123!",
        },
    )
    assert create_resp.status_code == 201
    assert create_resp.json()["email"] == "support@studymate.ai"


@pytest.mark.asyncio
async def test_student_enroll_in_subject_template(
    mock_admin_service: MagicMock, student_user: User
) -> None:
    template_id = uuid.uuid4()
    mock_subject = Subject(
        id=uuid.uuid4(),
        user_id=student_user.id,
        name="Data Structures & Algorithms",
        code="CS-201",
        color="#6366F1",
    )
    mock_admin_service.enroll_student_in_template.return_value = mock_subject

    app.dependency_overrides[get_current_active_user] = lambda: student_user
    app.dependency_overrides[get_admin_service] = lambda: mock_admin_service

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.post(f"/api/v1/subject-templates/{template_id}/enroll")

    app.dependency_overrides.clear()

    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Data Structures & Algorithms"
    assert data["code"] == "CS-201"
    assert "enrolled" in data["message"].lower()


@pytest.mark.asyncio
async def test_staff_management_actions(
    admin_client: AsyncClient, mock_admin_service: MagicMock
) -> None:
    staff_id = uuid.uuid4()
    staff_user = User(
        id=staff_id,
        email="agent@studymate.ai",
        full_name="Agent Zero",
        role=UserRole.SUPPORT_ADMIN,
        status=UserStatus.ACTIVE,
        hashed_password="hashed_pw",
        created_at=datetime.now(UTC),
    )

    # 1. Update status
    staff_user.status = UserStatus.SUSPENDED
    mock_admin_service.update_staff_status.return_value = staff_user
    status_resp = await admin_client.patch(
        f"/api/v1/admin/staff/{staff_id}/status",
        json={"status": "suspended"},
    )
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "suspended"

    # 2. Update role
    staff_user.role = UserRole.CONTENT_MANAGER
    mock_admin_service.update_staff_role.return_value = staff_user
    role_resp = await admin_client.patch(
        f"/api/v1/admin/staff/{staff_id}/role",
        json={"role": "content_manager"},
    )
    assert role_resp.status_code == 200
    assert role_resp.json()["role"] == "content_manager"

    # 3. Reset password
    mock_admin_service.reset_staff_password.return_value = staff_user
    reset_resp = await admin_client.post(
        f"/api/v1/admin/staff/{staff_id}/reset-password",
        json={"new_password": "NewSecretPassword123!"},
    )
    assert reset_resp.status_code == 200

    # 4. Delete staff
    mock_admin_service.delete_staff_user.return_value = True
    delete_resp = await admin_client.delete(f"/api/v1/admin/staff/{staff_id}")
    assert delete_resp.status_code == 204


