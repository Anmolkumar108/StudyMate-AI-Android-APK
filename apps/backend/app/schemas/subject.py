from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SubjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150, description="Subject name")
    code: str | None = Field(
        default=None,
        max_length=50,
        description="Course/Subject code (e.g. CS-101)",
    )
    description: str | None = Field(
        default=None,
        max_length=2000,
        description="Optional subject description or syllabus overview",
    )
    semester: int | None = Field(
        default=None,
        ge=1,
        le=50,
        description="Academic semester number (>= 1)",
    )
    color: str | None = Field(
        default="#6366F1",
        max_length=30,
        description="Color code or hex token (default: #6366F1)",
    )

    @field_validator("name", mode="after")
    @classmethod
    def validate_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Subject name cannot be blank or whitespace only.")
        return cleaned

    @field_validator("code", mode="after")
    @classmethod
    def validate_code(cls, v: str | None) -> str | None:
        if v is not None:
            cleaned = v.strip()
            return cleaned if cleaned else None
        return None

    @field_validator("description", mode="after")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        if v is not None:
            cleaned = v.strip()
            return cleaned if cleaned else None
        return None

    @field_validator("color", mode="after")
    @classmethod
    def validate_color(cls, v: str | None) -> str | None:
        if v is not None:
            cleaned = v.strip()
            return cleaned if cleaned else None
        return "#6366F1"


class SubjectCreate(SubjectBase):
    model_config = ConfigDict(extra="forbid")


class SubjectUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=150,
        description="Subject name",
    )
    code: str | None = Field(
        default=None,
        max_length=50,
        description="Course/Subject code",
    )
    description: str | None = Field(
        default=None,
        max_length=2000,
        description="Subject description",
    )
    semester: int | None = Field(
        default=None,
        ge=1,
        le=50,
        description="Academic semester number (>= 1)",
    )
    color: str | None = Field(
        default=None,
        max_length=30,
        description="Color hex or token",
    )

    @field_validator("name", mode="after")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is not None:
            cleaned = v.strip()
            if not cleaned:
                raise ValueError("Subject name cannot be blank or whitespace only.")
            return cleaned
        return None

    @field_validator("code", mode="after")
    @classmethod
    def validate_code(cls, v: str | None) -> str | None:
        if v is not None:
            cleaned = v.strip()
            return cleaned if cleaned else None
        return None

    @field_validator("description", mode="after")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        if v is not None:
            cleaned = v.strip()
            return cleaned if cleaned else None
        return None

    @field_validator("color", mode="after")
    @classmethod
    def validate_color(cls, v: str | None) -> str | None:
        if v is not None:
            cleaned = v.strip()
            return cleaned if cleaned else None
        return None


class SubjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    name: str
    code: str | None = None
    description: str | None = None
    semester: int | None = None
    color: str | None = None
    created_at: datetime
    updated_at: datetime
