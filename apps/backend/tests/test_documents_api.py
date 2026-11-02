import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_active_user, get_document_service
from app.main import app
from app.models.document import DocStatus, Document
from app.models.user import User, UserRole, UserStatus
from app.services.document_service import DocumentNotFoundError, DocumentValidationError


@pytest.fixture
def test_user() -> User:
    return User(
        id=uuid.uuid4(),
        email="docstudent@test.com",
        hashed_password="argon2id$test",
        full_name="Doc Student",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
    )


@pytest.fixture
def mock_doc_service() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
async def authed_client(
    test_user: User,
    mock_doc_service: AsyncMock,
) -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides[get_current_active_user] = lambda: test_user
    app.dependency_overrides[get_document_service] = lambda: mock_doc_service
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def sample_document(test_user: User) -> Document:
    return Document(
        id=uuid.uuid4(),
        user_id=test_user.id,
        title="Physics 101 Notes",
        file_name="physics.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        storage_key=f"local://documents/{test_user.id}/dummy.pdf",
        file_hash_sha256="abc123hash",
        page_count=5,
        status=DocStatus.READY,
        summary_tldr="Overview of Newtonian mechanics.",
        summary_key_concepts=[{"concept": "Force", "explanation": "F=ma"}],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
async def test_upload_document_success(
    authed_client: AsyncClient,
    mock_doc_service: AsyncMock,
    sample_document: Document,
) -> None:
    mock_doc_service.initiate_upload.return_value = sample_document

    files = {"file": ("test.pdf", b"%PDF-1.4 test bytes", "application/pdf")}
    data = {"title": "Uploaded Slides"}

    response = await authed_client.post("/api/v1/documents/upload", files=files, data=data)
    assert response.status_code == 202
    body = response.json()
    assert body["title"] == sample_document.title
    assert body["status"] == "ready"


@pytest.mark.asyncio
async def test_upload_document_validation_failure(
    authed_client: AsyncClient,
    mock_doc_service: AsyncMock,
) -> None:
    mock_doc_service.initiate_upload.side_effect = DocumentValidationError("Invalid magic bytes")

    files = {"file": ("bad.pdf", b"INVALID", "application/pdf")}
    data = {"title": "Bad PDF"}

    response = await authed_client.post("/api/v1/documents/upload", files=files, data=data)
    assert response.status_code == 400
    assert "Invalid magic bytes" in response.json()["detail"]


@pytest.mark.asyncio
async def test_list_documents(
    authed_client: AsyncClient,
    mock_doc_service: AsyncMock,
    sample_document: Document,
) -> None:
    mock_doc_service.list_documents.return_value = [sample_document]
    mock_doc_service.count_documents.return_value = 1

    response = await authed_client.get("/api/v1/documents")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["title"] == "Physics 101 Notes"


@pytest.mark.asyncio
async def test_get_document_by_id(
    authed_client: AsyncClient,
    mock_doc_service: AsyncMock,
    sample_document: Document,
) -> None:
    mock_doc_service.get_document.return_value = sample_document

    response = await authed_client.get(f"/api/v1/documents/{sample_document.id}")
    assert response.status_code == 200
    assert response.json()["id"] == str(sample_document.id)


@pytest.mark.asyncio
async def test_get_document_not_found(
    authed_client: AsyncClient,
    mock_doc_service: AsyncMock,
) -> None:
    mock_doc_service.get_document.side_effect = DocumentNotFoundError("Not found")

    response = await authed_client.get(f"/api/v1/documents/{uuid.uuid4()}")
    assert response.status_code == 404

