import tempfile
import uuid
import pytest
from pathlib import Path

from app.services.storage_service import LocalStorageService


@pytest.mark.asyncio
async def test_local_storage_service_save_read_delete() -> None:
    with tempfile.TemporaryDirectory() as tmp_dir:
        storage = LocalStorageService(base_dir=tmp_dir)
        user_id = uuid.uuid4()
        file_id = uuid.uuid4()
        test_content = b"%PDF-1.4 test binary data for storage"

        # 1. Save
        key = await storage.save_file(
            user_id=user_id,
            file_id=file_id,
            filename="lecture1.pdf",
            content=test_content,
        )
        assert f"local://documents/{user_id}/{file_id}.pdf" == key

        # 2. Read
        read_bytes = await storage.read_file(key)
        assert read_bytes == test_content

        # 3. Delete
        deleted = await storage.delete_file(key)
        assert deleted is True

        # 4. Verify gone
        with pytest.raises(FileNotFoundError):
            await storage.read_file(key)


@pytest.mark.asyncio
async def test_local_storage_traversal_guard() -> None:
    with tempfile.TemporaryDirectory() as tmp_dir:
        storage = LocalStorageService(base_dir=tmp_dir)
        malicious_key = "local://documents/../../secret.txt"
        with pytest.raises(ValueError, match="Illegal storage key path traversal"):
            await storage.read_file(malicious_key)

