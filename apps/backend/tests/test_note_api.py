import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_active_user, get_note_service
from app.main import app
from app.models.note import Note
from app.models.user import User, UserRole, UserStatus
from app.services.note_service import (
    InvalidNoteSubjectError,
    NoteNotFoundError,
)


@pytest.fixture
def test_user() -> User:
    return User(
        id=uuid.uuid4(),
        email="notestudent@test.com",
        hashed_password="argon2id$test",
        full_name="Note Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
    )


@pytest.fixture
def mock_note_service() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
async def authed_client(
    test_user: User,
    mock_note_service: AsyncMock,
) -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides[get_current_active_user] = lambda: test_user
    app.dependency_overrides[get_note_service] = lambda: mock_note_service
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
def sample_note(test_user: User) -> Note:
    return Note(
        id=uuid.uuid4(),
        user_id=test_user.id,
        subject_id=None,
        title="Dynamic Programming",
        content="Memoization vs Tabulation explanations.",
        is_pinned=False,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
async def test_create_note_success(
    authed_client: AsyncClient,
    mock_note_service: AsyncMock,
    sample_note: Note,
) -> None:
    mock_note_service.create_note.return_value = sample_note

    response = await authed_client.post(
        "/api/v1/notes",
        json={
            "title": "Dynamic Programming",
            "content": "Memoization vs Tabulation explanations.",
            "is_pinned": False,
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["id"] == str(sample_note.id)
    assert data["title"] == "Dynamic Programming"
    assert data["content"] == "Memoization vs Tabulation explanations."
    assert data["is_pinned"] is False
    assert data["subject_id"] is None


@pytest.mark.asyncio
async def test_create_note_invalid_subject_400(
    authed_client: AsyncClient,
    mock_note_service: AsyncMock,
) -> None:
    mock_note_service.create_note.side_effect = InvalidNoteSubjectError(
        "Subject does not exist or does not belong to the user."
    )

    response = await authed_client.post(
        "/api/v1/notes",
        json={
            "title": "Invalid Subject Note",
            "content": "Testing foreign subject rejection.",
            "subject_id": str(uuid.uuid4()),
        },
    )

    assert response.status_code == 400
    assert "Subject does not exist" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_note_empty_title_422(authed_client: AsyncClient) -> None:
    response = await authed_client.post(
        "/api/v1/notes",
        json={"title": "", "content": "Valid content"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_note_empty_content_422(authed_client: AsyncClient) -> None:
    response = await authed_client.post(
        "/api/v1/notes",
        json={"title": "Valid title", "content": "   "},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_note_unauthenticated(unauthed_client: AsyncClient) -> None:
    response = await unauthed_client.post(
        "/api/v1/notes",
        json={"title": "Unauthed", "content": "Content"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_notes_success(
    authed_client: AsyncClient,
    mock_note_service: AsyncMock,
    sample_note: Note,
) -> None:
    mock_note_service.list_notes.return_value = [sample_note]

    response = await authed_client.get("/api/v1/notes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == str(sample_note.id)


@pytest.mark.asyncio
async def test_list_notes_with_search_and_filters(
    authed_client: AsyncClient,
    mock_note_service: AsyncMock,
    sample_note: Note,
) -> None:
    subj_id = uuid.uuid4()
    mock_note_service.list_notes.return_value = [sample_note]

    response = await authed_client.get(
        f"/api/v1/notes?search=Dynamic&subject_id={subj_id}&is_pinned=true&limit=20&offset=5"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1


@pytest.mark.asyncio
async def test_list_notes_invalid_subject_filter_400(
    authed_client: AsyncClient,
    mock_note_service: AsyncMock,
) -> None:
    mock_note_service.list_notes.side_effect = InvalidNoteSubjectError(
        "Subject not found or does not belong to the user."
    )

    response = await authed_client.get(f"/api/v1/notes?subject_id={uuid.uuid4()}")
    assert response.status_code == 400
    assert "Subject not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_list_notes_unauthenticated(unauthed_client: AsyncClient) -> None:
    response = await unauthed_client.get("/api/v1/notes")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_note_by_id_success(
    authed_client: AsyncClient,
    mock_note_service: AsyncMock,
    sample_note: Note,
) -> None:
    mock_note_service.get_note.return_value = sample_note

    response = await authed_client.get(f"/api/v1/notes/{sample_note.id}")
    assert response.status_code == 200
    assert response.json()["id"] == str(sample_note.id)


@pytest.mark.asyncio
async def test_get_note_not_found(
    authed_client: AsyncClient,
    mock_note_service: AsyncMock,
) -> None:
    mock_note_service.get_note.side_effect = NoteNotFoundError("Note not found.")

    response = await authed_client.get(f"/api/v1/notes/{uuid.uuid4()}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Note not found."


@pytest.mark.asyncio
async def test_get_note_invalid_uuid(authed_client: AsyncClient) -> None:
    response = await authed_client.get("/api/v1/notes/not-a-valid-uuid")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_patch_note_success(
    authed_client: AsyncClient,
    mock_note_service: AsyncMock,
    sample_note: Note,
) -> None:
    sample_note.is_pinned = True
    mock_note_service.update_note.return_value = sample_note

    response = await authed_client.patch(
        f"/api/v1/notes/{sample_note.id}",
        json={"is_pinned": True},
    )
    assert response.status_code == 200
    assert response.json()["is_pinned"] is True


@pytest.mark.asyncio
async def test_patch_note_invalid_subject_400(
    authed_client: AsyncClient,
    mock_note_service: AsyncMock,
    sample_note: Note,
) -> None:
    mock_note_service.update_note.side_effect = InvalidNoteSubjectError(
        "Subject does not exist or does not belong to the user."
    )

    response = await authed_client.patch(
        f"/api/v1/notes/{sample_note.id}",
        json={"subject_id": str(uuid.uuid4())},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_patch_note_not_found(
    authed_client: AsyncClient,
    mock_note_service: AsyncMock,
) -> None:
    mock_note_service.update_note.side_effect = NoteNotFoundError("Note not found.")

    response = await authed_client.patch(
        f"/api/v1/notes/{uuid.uuid4()}",
        json={"title": "New Title"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_put_note_success(
    authed_client: AsyncClient,
    mock_note_service: AsyncMock,
    sample_note: Note,
) -> None:
    mock_note_service.update_note.return_value = sample_note

    response = await authed_client.put(
        f"/api/v1/notes/{sample_note.id}",
        json={"title": "Updated Title"},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_delete_note_success(
    authed_client: AsyncClient,
    mock_note_service: AsyncMock,
    sample_note: Note,
) -> None:
    mock_note_service.delete_note.return_value = None

    response = await authed_client.delete(f"/api/v1/notes/{sample_note.id}")
    assert response.status_code == 204
    mock_note_service.delete_note.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_note_not_found(
    authed_client: AsyncClient,
    mock_note_service: AsyncMock,
) -> None:
    mock_note_service.delete_note.side_effect = NoteNotFoundError("Note not found.")

    response = await authed_client.delete(f"/api/v1/notes/{uuid.uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_note_unauthenticated(unauthed_client: AsyncClient) -> None:
    response = await unauthed_client.delete(f"/api/v1/notes/{uuid.uuid4()}")
    assert response.status_code == 401
