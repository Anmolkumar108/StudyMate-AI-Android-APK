from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class NoteBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Note title")
    content: str = Field(..., min_length=1, description="Note content")
    subject_id: UUID | None = Field(
        default=None,
        description="Optional associated subject ID",
    )
    is_pinned: bool = Field(
        default=False,
        description="Whether the note is pinned",
    )

    @field_validator("title", mode="after")
    @classmethod
    def validate_title(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Note title cannot be blank or whitespace only.")
        return cleaned

    @field_validator("content", mode="after")
    @classmethod
    def validate_content(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Note content cannot be blank or whitespace only.")
        return cleaned


class NoteCreate(NoteBase):
    model_config = ConfigDict(extra="forbid")


class NoteUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=200,
        description="Note title",
    )
    content: str | None = Field(
        default=None,
        min_length=1,
        description="Note content",
    )
    subject_id: UUID | None = Field(
        default=None,
        description="Optional associated subject ID (null to remove subject)",
    )
    is_pinned: bool | None = Field(
        default=None,
        description="Whether the note is pinned",
    )

    @field_validator("title", mode="after")
    @classmethod
    def validate_title(cls, v: str | None) -> str | None:
        if v is not None:
            cleaned = v.strip()
            if not cleaned:
                raise ValueError("Note title cannot be blank or whitespace only.")
            return cleaned
        return None

    @field_validator("content", mode="after")
    @classmethod
    def validate_content(cls, v: str | None) -> str | None:
        if v is not None:
            cleaned = v.strip()
            if not cleaned:
                raise ValueError("Note content cannot be blank or whitespace only.")
            return cleaned
        return None


class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    subject_id: UUID | None = None
    title: str
    content: str
    is_pinned: bool
    created_at: datetime
    updated_at: datetime
