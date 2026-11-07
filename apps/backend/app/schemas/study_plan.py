import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StudyBlockItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    subject_id: uuid.UUID | None = None
    subject_name: str = "General Study"
    subject_color: str = "#6366F1"
    task_id: uuid.UUID | None = None
    exam_id: uuid.UUID | None = None
    title: str
    block_type: str = "task_work"
    start_time: str = "18:00"
    end_time: str = "18:45"
    duration_minutes: int = 45
    priority: str = "medium"
    is_completed: bool = False
    completed_at: datetime | None = None


class StudyPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    plan_date: date
    target_study_minutes: int
    planned_minutes: int
    completed_minutes: int
    completion_percentage: float = 0.0
    timeblocks: list[StudyBlockItem] = Field(default_factory=list)
    ai_summary: str | None = None
    status: str = "active"
    created_at: datetime
    updated_at: datetime


class StudyPlanGenerateRequest(BaseModel):
    plan_date: date | None = None
    target_study_minutes: int = Field(default=180, ge=30, le=480)
    focus_subject_ids: list[uuid.UUID] | None = None
    pace_mode: Literal["balanced", "intensive", "pomodoro"] = "balanced"
    start_hour: int | None = Field(default=None, ge=6, le=23)
    include_breaks: bool = True


class StudyBlockToggleRequest(BaseModel):
    is_completed: bool


class StudyPlanRebalanceRequest(BaseModel):
    remaining_available_minutes: int | None = Field(default=None, ge=15, le=360)

