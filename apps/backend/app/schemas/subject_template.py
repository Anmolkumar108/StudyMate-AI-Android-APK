import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class UnitItem(BaseModel):
    title: str
    weeks: int = 2


class SubjectTemplateBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    code: str | None = Field(None, max_length=50)
    category: str = Field("General", min_length=2, max_length=100)
    description: str | None = Field(None, max_length=2000)
    color: str = Field("#6366F1", max_length=30)
    credits: int = Field(3, ge=1, le=10)
    difficulty_level: str = Field("intermediate", max_length=30)
    suggested_units: list[dict[str, Any]] = Field(default_factory=list)


class SubjectTemplateCreate(SubjectTemplateBase):
    is_active: bool = True


class SubjectTemplateUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=150)
    code: str | None = Field(None, max_length=50)
    category: str | None = Field(None, min_length=2, max_length=100)
    description: str | None = Field(None, max_length=2000)
    color: str | None = Field(None, max_length=30)
    credits: int | None = Field(None, ge=1, le=10)
    difficulty_level: str | None = Field(None, max_length=30)
    suggested_units: list[dict[str, Any]] | None = None
    is_active: bool | None = None


class SubjectTemplateResponse(SubjectTemplateBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    is_active: bool
    enrolled_count: int
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class SubjectTemplateListResponse(BaseModel):
    items: list[SubjectTemplateResponse]
    total: int
    categories: list[str] = Field(default_factory=list)


class EnrollTemplateResponse(BaseModel):
    subject_id: uuid.UUID
    name: str
    code: str | None
    color: str | None
    message: str = "Subject enrolled and added to your active study roster."


class SystemTaskTemplateCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=250)
    description: str | None = Field(None, max_length=2000)
    default_priority: str = Field("medium", max_length=20)
    estimated_minutes: int | None = Field(None, ge=1, le=1440)
    category: str = Field("academic", max_length=50)
    subtasks: list[dict[str, Any]] = Field(default_factory=list)


class SystemTaskTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None
    default_priority: str
    estimated_minutes: int | None
    category: str
    subtasks: list[dict[str, Any]]
    is_system: bool
    created_at: datetime

