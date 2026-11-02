import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_active_user, get_subject_service
from app.main import app
from app.models.subject import Subject
from app.models.user import User, UserRole, UserStatus
from app.services.subject_service import (
    DuplicateSubjectNameError,
    SubjectNotFoundError,
)


@pytest.fixture
def test_user() -> User:
    return User(
        id=uuid.uuid4(),
        email="student@test.com",
        hashed_password="argon2id$test",
        full_name="Student One",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
    )


@pytest.fixture
def mock_subject_service() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
async def authed_client(
    test_user: User,
    mock_subject_service: AsyncMock,
) -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides[get_current_active_user] = lambda: test_user
    app.dependency_overrides[get_subject_service] = lambda: mock_subject_service
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
async def unauthed_client() -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides.clear()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.fixture
def sample_subject(test_user: User) -> Subject:
    return Subject(
        id=uuid.uuid4(),
        user_id=test_user.id,
        name="Computer Science 101",
        code="CS-101",
        description="Intro to computing.",
        semester=1,
        color="#6366F1",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
async def test_create_subject_success(
    authed_client: AsyncClient,
    mock_subject_service: AsyncMock,
    sample_subject: Subject,
) -> None:
    mock_subject_service.create_subject.return_value = sample_subject

    payload = {
        "name": "Computer Science 101",
        "code": "CS-101",
        "description": "Intro to computing.",
        "semester": 1,
        "color": "#6366F1",
    }
    response = await authed_client.post("/api/v1/subjects", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] == str(sample_subject.id)
    assert data["name"] == "Computer Science 101"
    assert data["code"] == "CS-101"
    assert data["semester"] == 1


@pytest.mark.asyncio
async def test_create_subject_duplicate_name(
    authed_client: AsyncClient,
    mock_subject_service: AsyncMock,
) -> None:
    mock_subject_service.create_subject.side_effect = DuplicateSubjectNameError(
        "A subject with the name 'Math' already exists."
    )

    payload = {"name": "Math"}
    response = await authed_client.post("/api/v1/subjects", json=payload)
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_subject_invalid_empty_name(
    authed_client: AsyncClient,
) -> None:
    payload = {"name": "   "}
    response = await authed_client.post("/api/v1/subjects", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_subject_invalid_semester(
    authed_client: AsyncClient,
) -> None:
    payload = {"name": "Physics", "semester": 0}
    response = await authed_client.post("/api/v1/subjects", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_subject_unauthenticated(
    unauthed_client: AsyncClient,
) -> None:
    payload = {"name": "Physics"}
    response = await unauthed_client.post("/api/v1/subjects", json=payload)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_subjects_success(
    authed_client: AsyncClient,
    mock_subject_service: AsyncMock,
    sample_subject: Subject,
) -> None:
    mock_subject_service.list_subjects.return_value = [sample_subject]

    response = await authed_client.get("/api/v1/subjects")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["name"] == "Computer Science 101"


@pytest.mark.asyncio
async def test_list_subjects_unauthenticated(
    unauthed_client: AsyncClient,
) -> None:
    response = await unauthed_client.get("/api/v1/subjects")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_subject_by_id_success(
    authed_client: AsyncClient,
    mock_subject_service: AsyncMock,
    sample_subject: Subject,
) -> None:
    mock_subject_service.get_subject.return_value = sample_subject

    response = await authed_client.get(f"/api/v1/subjects/{sample_subject.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(sample_subject.id)
    assert data["name"] == "Computer Science 101"


@pytest.mark.asyncio
async def test_get_subject_not_found(
    authed_client: AsyncClient,
    mock_subject_service: AsyncMock,
) -> None:
    mock_subject_service.get_subject.side_effect = SubjectNotFoundError(
        "Subject not found."
    )

    non_existent_id = uuid.uuid4()
    response = await authed_client.get(f"/api/v1/subjects/{non_existent_id}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Subject not found."


@pytest.mark.asyncio
async def test_get_subject_invalid_uuid(
    authed_client: AsyncClient,
) -> None:
    response = await authed_client.get("/api/v1/subjects/not-a-valid-uuid")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_patch_subject_success(
    authed_client: AsyncClient,
    mock_subject_service: AsyncMock,
    sample_subject: Subject,
) -> None:
    sample_subject.name = "Advanced CS 101"
    mock_subject_service.update_subject.return_value = sample_subject

    payload = {"name": "Advanced CS 101"}
    response = await authed_client.patch(
        f"/api/v1/subjects/{sample_subject.id}", json=payload
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Advanced CS 101"


@pytest.mark.asyncio
async def test_patch_subject_duplicate_name(
    authed_client: AsyncClient,
    mock_subject_service: AsyncMock,
    sample_subject: Subject,
) -> None:
    mock_subject_service.update_subject.side_effect = DuplicateSubjectNameError(
        "A subject with the name 'Existing' already exists."
    )

    payload = {"name": "Existing"}
    response = await authed_client.patch(
        f"/api/v1/subjects/{sample_subject.id}", json=payload
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_patch_subject_not_found(
    authed_client: AsyncClient,
    mock_subject_service: AsyncMock,
) -> None:
    mock_subject_service.update_subject.side_effect = SubjectNotFoundError(
        "Subject not found."
    )

    response = await authed_client.patch(
        f"/api/v1/subjects/{uuid.uuid4()}", json={"name": "New Name"}
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_put_subject_success(
    authed_client: AsyncClient,
    mock_subject_service: AsyncMock,
    sample_subject: Subject,
) -> None:
    sample_subject.name = "Full CS 101 Update"
    mock_subject_service.update_subject.return_value = sample_subject

    payload = {
        "name": "Full CS 101 Update",
        "code": "CS-101B",
        "semester": 2,
    }
    response = await authed_client.put(
        f"/api/v1/subjects/{sample_subject.id}", json=payload
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Full CS 101 Update"


@pytest.mark.asyncio
async def test_delete_subject_success(
    authed_client: AsyncClient,
    mock_subject_service: AsyncMock,
    sample_subject: Subject,
) -> None:
    mock_subject_service.delete_subject.return_value = None

    response = await authed_client.delete(f"/api/v1/subjects/{sample_subject.id}")
    assert response.status_code == 204
    assert response.text == ""


@pytest.mark.asyncio
async def test_delete_subject_not_found(
    authed_client: AsyncClient,
    mock_subject_service: AsyncMock,
) -> None:
    mock_subject_service.delete_subject.side_effect = SubjectNotFoundError(
        "Subject not found."
    )

    response = await authed_client.delete(f"/api/v1/subjects/{uuid.uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_subject_unauthenticated(
    unauthed_client: AsyncClient,
) -> None:
    response = await unauthed_client.delete(f"/api/v1/subjects/{uuid.uuid4()}")
    assert response.status_code == 401
