import os
from pathlib import Path
from typing import Protocol
from uuid import UUID

from app.core.config import BACKEND_DIR, settings


class StorageService(Protocol):
    async def save_file(
        self,
        user_id: UUID,
        file_id: UUID,
        filename: str,
        content: bytes,
    ) -> str:
        """Save file bytes and return the canonical storage_key."""
        ...

    async def read_file(self, storage_key: str) -> bytes:
        """Read and return file content bytes."""
        ...

    async def delete_file(self, storage_key: str) -> bool:
        """Delete file by its storage key."""
        ...


class LocalStorageService:
    def __init__(self, base_dir: str | None = None) -> None:
        if base_dir is None:
            raw_path = settings.LOCAL_STORAGE_DIR
            if os.path.isabs(raw_path):
                self.base_path = Path(raw_path)
            else:
                self.base_path = BACKEND_DIR / raw_path
        else:
            self.base_path = Path(base_dir)

        self.base_path.mkdir(parents=True, exist_ok=True)

    def _resolve_path(self, storage_key: str) -> Path:
        # Expected storage_key format: "local://documents/{user_id}/{file_id}.pdf"
        # Or relative path inside base_path
        clean_key = storage_key.replace("local://", "").replace("documents/", "")
        target_path = (self.base_path / clean_key).resolve()

        # Guard against directory traversal attacks
        base_resolved = self.base_path.resolve()
        if not str(target_path).startswith(str(base_resolved)):
            raise ValueError(f"Illegal storage key path traversal attempt: {storage_key}")
        return target_path

    async def save_file(
        self,
        user_id: UUID,
        file_id: UUID,
        filename: str,
        content: bytes,
    ) -> str:
        user_folder = self.base_path / str(user_id)
        user_folder.mkdir(parents=True, exist_ok=True)

        # Retain original extension safely
        ext = Path(filename).suffix.lower() or ".pdf"
        target_file = user_folder / f"{file_id}{ext}"
        target_file.write_bytes(content)

        return f"local://documents/{user_id}/{file_id}{ext}"

    async def read_file(self, storage_key: str) -> bytes:
        target_path = self._resolve_path(storage_key)
        if not target_path.exists():
            raise FileNotFoundError(f"File not found for key: {storage_key}")
        return target_path.read_bytes()

    async def delete_file(self, storage_key: str) -> bool:
        try:
            target_path = self._resolve_path(storage_key)
            if target_path.exists():
                target_path.unlink()
                return True
            return False
        except Exception:
            return False


def get_storage_service() -> StorageService:
    # Future extension: if settings.STORAGE_BACKEND == "s3", return S3StorageService()
    return LocalStorageService()

