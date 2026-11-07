import tempfile
import uuid
from unittest.mock import AsyncMock

import pytest

from app.models.document import DocStatus, Document
from app.services.document_service import (
    MAX_FILE_SIZE_BYTES,
    DocumentService,
    DocumentValidationError,
)
from app.services.storage_service import LocalStorageService


@pytest.mark.asyncio
async def test_initiate_upload_valid_pdf() -> None:
    with tempfile.TemporaryDirectory() as tmp_dir:
        storage = LocalStorageService(base_dir=tmp_dir)
        repo = AsyncMock()
        user_id = uuid.uuid4()
        doc_id = uuid.uuid4()

        # Mock repository create & update
        async def mock_create(doc: Document) -> Document:
            doc.id = doc_id
            return doc

        repo.create.side_effect = mock_create
        repo.update.side_effect = lambda doc: doc

        service = DocumentService(repository=repo, storage_service=storage)
        valid_pdf_bytes = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"

        doc = await service.initiate_upload(
            user_id=user_id,
            filename="math_slides.pdf",
            content=valid_pdf_bytes,
            title="Linear Algebra Slides",
        )

        assert doc.id == doc_id
        assert doc.user_id == user_id
        assert doc.status == DocStatus.UPLOAD_PENDING
        assert doc.title == "Linear Algebra Slides"
        assert doc.storage_key.startswith(f"local://documents/{user_id}/")


@pytest.mark.asyncio
async def test_initiate_upload_invalid_magic_bytes() -> None:
    repo = AsyncMock()
    service = DocumentService(repository=repo)
    user_id = uuid.uuid4()
    bad_bytes = b"NOT_A_PDF_FILE"

    with pytest.raises(DocumentValidationError, match="valid PDF header magic bytes"):
        await service.initiate_upload(
            user_id=user_id,
            filename="fake.pdf",
            content=bad_bytes,
            title="Fake Doc",
        )


@pytest.mark.asyncio
async def test_initiate_upload_file_too_large() -> None:
    repo = AsyncMock()
    service = DocumentService(repository=repo)
    user_id = uuid.uuid4()
    oversized_bytes = b"%PDF-" + (b"0" * (MAX_FILE_SIZE_BYTES + 10))

    with pytest.raises(DocumentValidationError, match="exceeds 25MB limit"):
        await service.initiate_upload(
            user_id=user_id,
            filename="huge.pdf",
            content=oversized_bytes,
            title="Huge Doc",
        )

