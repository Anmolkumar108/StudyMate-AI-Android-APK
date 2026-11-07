from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SyllabusTopicItem(BaseModel):
    id: str = Field(description="Unique ID for topic, e.g. top_1")
    name: str = Field(min_length=1, max_length=200, description="Topic or syllabus module name")
    is_completed: bool = Field(default=False, description="Whether topic is mastered/reviewed")
    confidence: str = Field(default="medium", description="Student confidence: low, medium, high")


class SyllabusTopicToggleRequest(BaseModel):
    is_completed: bool | None = None
    confidence: str | None = None


class RevisionPhase(BaseModel):
    phase_number: int = Field(ge=1, le=3)
    title: str
    start_date: str
    end_date: str
    days: int
    description: str
    daily_focus_minutes: int
    suggested_activities: list[str] = Field(default_factory=list)


class RevisionPlan(BaseModel):
    total_days: int
    generated_at: str
    summary: str
    phases: list[RevisionPhase] = Field(default_factory=list)


class ExamBase(BaseModel):
    subject_id: UUID
    title: str = Field(min_length=1, max_length=200)
    exam_date: datetime
    location: str | None = Field(default=None, max_length=200)
    target_score: float | None = Field(default=None, ge=0.0, le=100.0)
    achieved_score: float | None = Field(default=None, ge=0.0, le=100.0)


class ExamCreate(ExamBase):
    syllabus_topics: list[dict[str, Any]] | list[str] = Field(default_factory=list)


class ExamUpdate(BaseModel):
    subject_id: UUID | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    exam_date: datetime | None = None
    location: str | None = Field(default=None, max_length=200)
    target_score: float | None = Field(default=None, ge=0.0, le=100.0)
    achieved_score: float | None = Field(default=None, ge=0.0, le=100.0)
    syllabus_topics: list[dict[str, Any]] | list[str] | None = None


class ExamResponse(BaseModel):
    id: UUID
    user_id: UUID
    subject_id: UUID
    subject_name: str | None = None
    subject_color: str | None = None
    title: str
    exam_date: datetime
    location: str | None = None
    target_score: float | None = None
    achieved_score: float | None = None
    syllabus_topics: list[dict[str, Any]] = Field(default_factory=list)
    total_topics: int = 0
    completed_topics: int = 0
    readiness_percentage: float = 0.0
    days_remaining: int = 0
    hours_remaining: int = 0
    is_past: bool = False
    revision_plan: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExamListResponse(BaseModel):
    items: list[ExamResponse]
    total: int
    upcoming_count: int
    average_readiness: float


class ExamUpcomingSummaryResponse(BaseModel):
    next_exam: ExamResponse | None = None
    total_upcoming: int = 0
    average_readiness: float = 0.0

