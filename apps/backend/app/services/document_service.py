import hashlib
import io
import logging
from collections.abc import Sequence
from uuid import UUID

from pypdf import PdfReader

from app.models.document import DocStatus, Document
from app.repositories.document_repo import DocumentRepository
from app.services.ai_service import AIService
from app.services.storage_service import StorageService, get_storage_service

logger = logging.getLogger(__name__)

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25MB
PDF_MAGIC_BYTES = b"%PDF-"


class DocumentValidationError(Exception):
    """Raised when uploaded file fails MIME, magic byte, or size constraints."""


class DocumentNotFoundError(Exception):
    """Raised when document does not exist or user is unauthorized."""


class DocumentService:
    def __init__(
        self,
        repository: DocumentRepository,
        storage_service: StorageService | None = None,
        ai_service: AIService | None = None,
    ) -> None:
        self.repository = repository
        self.storage = storage_service or get_storage_service()
        self.ai = ai_service or AIService()

    async def list_documents(
        self,
        user_id: UUID,
        subject_id: UUID | None = None,
        status: DocStatus | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[Document]:
        return await self.repository.list_by_user(
            user_id=user_id,
            subject_id=subject_id,
            status=status,
            search=search,
            limit=limit,
            offset=offset,
        )

    async def count_documents(
        self,
        user_id: UUID,
        subject_id: UUID | None = None,
        status: DocStatus | None = None,
    ) -> int:
        return await self.repository.count_by_user(
            user_id=user_id,
            subject_id=subject_id,
            status=status,
        )

    async def get_document(self, document_id: UUID, user_id: UUID) -> Document:
        doc = await self.repository.get_by_id(document_id, user_id)
        if not doc:
            raise DocumentNotFoundError(f"Document {document_id} not found or not owned by user.")
        return doc

    async def get_document_file_bytes(self, document_id: UUID, user_id: UUID) -> tuple[Document, bytes]:
        doc = await self.get_document(document_id, user_id)
        file_bytes = await self.storage.read_file(doc.storage_key)
        return doc, file_bytes

    async def delete_document(self, document_id: UUID, user_id: UUID) -> None:
        doc = await self.get_document(document_id, user_id)
        # Attempt to delete from underlying physical storage safely
        try:
            await self.storage.delete_file(doc.storage_key)
        except Exception as exc:
            logger.warning("Could not delete physical storage file %s: %s", doc.storage_key, exc)
        # Always delete from database
        await self.repository.delete(doc)

    async def initiate_upload(
        self,
        user_id: UUID,
        filename: str,
        content: bytes,
        title: str,
        subject_id: UUID | None = None,
    ) -> Document:
        """Validate, store file on disk, and create an upload_pending document record."""
        # 1. Size Check
        file_size = len(content)
        if file_size > MAX_FILE_SIZE_BYTES:
            raise DocumentValidationError(
                f"File size exceeds 25MB limit (received {file_size / (1024 * 1024):.2f}MB)."
            )
        if file_size == 0:
            raise DocumentValidationError("File is empty.")

        # 2. Magic byte check
        if not content.startswith(PDF_MAGIC_BYTES):
            raise DocumentValidationError(
                "Invalid file format. Uploaded file does not possess valid PDF header magic bytes."
            )

        # 3. Compute SHA256
        sha256_hash = hashlib.sha256(content).hexdigest()

        # 4. Create document entity
        doc = Document(
            user_id=user_id,
            subject_id=subject_id,
            title=title,
            file_name=filename,
            file_size_bytes=file_size,
            mime_type="application/pdf",
            storage_key="temporary_pending_key",
            file_hash_sha256=sha256_hash,
            status=DocStatus.UPLOAD_PENDING,
        )
        doc = await self.repository.create(doc)

        # 5. Persist file via StorageService
        storage_key = await self.storage.save_file(
            user_id=user_id,
            file_id=doc.id,
            filename=filename,
            content=content,
        )
        doc.storage_key = storage_key
        doc = await self.repository.update(doc)
        return doc

    async def create_text_document(
        self,
        user_id: UUID,
        title: str,
        content: str,
        subject_id: UUID | None = None,
    ) -> Document:
        """Create a course document directly from typed or pasted study text."""
        clean_title = title.strip()
        clean_content = content.strip()
        safe_content = clean_content.replace("(", r"\(").replace(")", r"\)")[:1500]

        pdf_stream = (
            f"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
            f"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
            f"3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources <<>> /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n"
            f"4 0 obj\n<< /Length {len(safe_content)} >>\nstream\nBT /F1 12 Tf 50 720 Td ({safe_content}) Tj ET\nendstream\nendobj\n"
            f"xref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000069 00000 n \n0000000139 00000 n \n0000000249 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n470\n%%EOF"
        ).encode("latin-1", errors="replace")

        sha256_hash = hashlib.sha256(pdf_stream).hexdigest()
        clean_filename = f"{clean_title.lower().replace(' ', '_')[:30]}.pdf"

        # Request AI Summary immediately for fast user feedback
        summary_data = await self.ai.summarize_document(clean_content, clean_title)

        doc = Document(
            user_id=user_id,
            subject_id=subject_id,
            title=clean_title,
            file_name=clean_filename,
            file_size_bytes=len(pdf_stream),
            mime_type="application/pdf",
            storage_key="temporary_pending_key",
            file_hash_sha256=sha256_hash,
            page_count=1,
            status=DocStatus.READY,
            extracted_text_snippet=clean_content[:4000],
            summary_tldr=summary_data.get("summary_tldr"),
            summary_key_concepts=summary_data.get("summary_key_concepts"),
        )
        doc = await self.repository.create(doc)

        storage_key = await self.storage.save_file(
            user_id=user_id,
            file_id=doc.id,
            filename=clean_filename,
            content=pdf_stream,
        )
        doc.storage_key = storage_key
        doc = await self.repository.update(doc)
        return doc

    async def process_document_background(
        self,
        document_id: UUID,
        user_id: UUID,
    ) -> None:
        """Background worker task for non-blocking PDF text extraction and summarization."""
        doc = await self.repository.get_by_id(document_id, user_id)
        if not doc:
            logger.error("Background job cannot find document %s for user %s", document_id, user_id)
            return

        doc.status = DocStatus.PROCESSING
        await self.repository.update(doc)

        try:
            # 1. Read file bytes from storage
            content = await self.storage.read_file(doc.storage_key)

            # 2. Extract text with pypdf
            reader = PdfReader(io.BytesIO(content))
            page_count = len(reader.pages)
            extracted_pages: list[str] = []
            for i, page in enumerate(reader.pages):
                text_page = page.extract_text() or ""
                extracted_pages.append(text_page)
                # Cap extracted text to avoid unbounded memory/token explosion
                if i >= 60:
                    break

            full_text = "\n\n".join(extracted_pages).strip()
            snippet = full_text[:4000]

            # 3. Request AI Summary
            summary_data = await self.ai.summarize_document(full_text, doc.title)

            # 4. Update document record
            doc.page_count = page_count
            doc.extracted_text_snippet = snippet
            doc.summary_tldr = summary_data.get("summary_tldr")
            doc.summary_key_concepts = summary_data.get("summary_key_concepts")
            doc.status = DocStatus.READY
            doc.error_message = None
            await self.repository.update(doc)
            logger.info("Successfully processed document %s (%d pages)", document_id, page_count)

        except Exception as exc:
            logger.exception("Failed to process document %s: %s", document_id, exc)
            doc.status = DocStatus.FAILED
            doc.error_message = f"Processing failed: {str(exc)[:200]}"
            await self.repository.update(doc)

