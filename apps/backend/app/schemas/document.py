import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.document import DocStatus


class DocumentBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=250, description="Document display title")
    subject_id: uuid.UUID | None = Field(default=None, description="Associated subject ID")


class DocumentCreate(DocumentBase):
    pass


class DocumentTextCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=250, description="Document display title")
    content: str = Field(..., min_length=5, max_length=50000, description="Text notes, lecture transcription or study material")
    subject_id: uuid.UUID | None = Field(default=None, description="Optional associated subject ID")


class DocumentBase64UploadRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=250, description="Document display title")
    filename: str = Field(..., min_length=1, max_length=255, description="Original PDF filename")
    file_base64: str = Field(..., min_length=10, description="Base64-encoded PDF binary data")
    subject_id: uuid.UUID | None = Field(default=None, description="Optional associated subject ID")


class DocumentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=250)
    subject_id: uuid.UUID | None = None


class DocumentResponse(DocumentBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    file_name: str
    file_size_bytes: int
    mime_type: str
    page_count: int | None = None
    status: DocStatus
    error_message: str | None = None
    summary_tldr: str | None = None
    summary_key_concepts: list[Any] | dict[str, Any] | None = None
    extracted_text_snippet: str | None = None
    created_at: datetime
    updated_at: datetime


class DocumentListResponse(BaseModel):
    items: list[DocumentResponse]
    total: int


class DocumentSummaryResponse(BaseModel):
    id: uuid.UUID
    title: str
    status: DocStatus
    summary_tldr: str | None
    summary_key_concepts: list[Any] | dict[str, Any] | None

