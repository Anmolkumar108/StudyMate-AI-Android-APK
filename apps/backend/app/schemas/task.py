import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.task import TaskPriority, TaskStatus


class SubtaskItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str = Field(..., min_length=1, max_length=200, description="Subtask checklist item text")
    is_completed: bool = Field(default=False)
    order: int = Field(default=0, description="Display order sequence")


class TaskAttachment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    file_name: str
    file_type: str
    file_size: int
    storage_key: str
    created_at: str


class TaskAttachmentBase64UploadRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255, description="Filename with extension")
    file_type: str = Field(default="application/pdf", description="MIME type")
    file_base64: str = Field(..., min_length=10, description="Base64 encoded file binary data")


class TaskSubjectNested(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    color: str
    course_code: str | None = None


class TaskDependencyNested(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    status: TaskStatus


class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=250, description="Task or assignment title")
    description: str | None = Field(default=None, description="Detailed instructions, links, or notes")
    subject_id: uuid.UUID | None = Field(default=None, description="Optional associated subject ID")
    depends_on_task_id: uuid.UUID | None = Field(default=None, description="Optional prerequisite task that must be finished first")
    due_datetime: datetime | None = Field(default=None, description="Target completion deadline")
    priority: TaskPriority = Field(default=TaskPriority.MEDIUM, description="Task urgency level")
    status: TaskStatus = Field(default=TaskStatus.TODO, description="Execution status")
    estimated_minutes: int | None = Field(default=None, ge=1, le=1440, description="Estimated effort in minutes")
    subtasks: list[SubtaskItem] = Field(default_factory=list, description="Step-by-step checklist")
    recurrence_pattern: str | None = Field(default=None, description="Optional recurrence pattern: daily, weekly, monthly, custom")
    recurrence_interval: int | None = Field(default=1, ge=1, le=365, description="Interval for recurrence (e.g. 1 for every week)")
    recurrence_end_date: datetime | None = Field(default=None, description="Optional date when recurrence stops")


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=250)
    description: str | None = None
    subject_id: uuid.UUID | None = None
    depends_on_task_id: uuid.UUID | None = None
    due_datetime: datetime | None = None
    priority: TaskPriority | None = None
    status: TaskStatus | None = None
    estimated_minutes: int | None = Field(default=None, ge=1, le=1440)
    subtasks: list[SubtaskItem] | None = None
    recurrence_pattern: str | None = None
    recurrence_interval: int | None = Field(default=None, ge=1, le=365)
    recurrence_end_date: datetime | None = None


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: str | None = None
    subject_id: uuid.UUID | None = None
    subject: TaskSubjectNested | None = None
    depends_on_task_id: uuid.UUID | None = None
    depends_on: TaskDependencyNested | None = None
    due_datetime: datetime | None = None
    priority: TaskPriority
    status: TaskStatus
    estimated_minutes: int | None = None
    subtasks: list[SubtaskItem] = Field(default_factory=list)
    recurrence_pattern: str | None = None
    recurrence_interval: int | None = 1
    recurrence_end_date: datetime | None = None
    attachments: list[TaskAttachment] = Field(default_factory=list)
    focus_minutes: int = 0
    focus_sessions_count: int = 0
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    @field_validator("attachments", mode="before")
    @classmethod
    def ensure_attachments(cls, v: Any) -> list[Any]:
        return v if v is not None else []

    @field_validator("focus_minutes", "focus_sessions_count", mode="before")
    @classmethod
    def ensure_focus_metrics(cls, v: Any) -> int:
        return v if v is not None else 0

    @field_validator("subtasks", mode="before")
    @classmethod
    def ensure_subtasks(cls, v: Any) -> list[Any]:
        return v if v is not None else []


class TaskListResponse(BaseModel):
    items: list[TaskResponse]
    total: int
    completed_count: int = 0
    pending_count: int = 0
    overdue_count: int = 0


# Template Schemas
class TaskTemplateCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=250)
    description: str | None = None
    default_priority: TaskPriority = TaskPriority.MEDIUM
    estimated_minutes: int | None = Field(default=None, ge=1, le=1440)
    subtasks: list[SubtaskItem] = Field(default_factory=list)
    category: str = Field(default="custom", max_length=50)


class TaskTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None = None
    title: str
    description: str | None = None
    default_priority: TaskPriority
    estimated_minutes: int | None = None
    subtasks: list[SubtaskItem] = Field(default_factory=list)
    category: str
    is_system: bool
    created_at: datetime
    updated_at: datetime


class CreateTaskFromTemplateRequest(BaseModel):
    template_id: uuid.UUID
    subject_id: uuid.UUID | None = None
    due_datetime: datetime | None = None
    custom_title: str | None = None


# Focus Mode Schema
class TaskLogFocusRequest(BaseModel):
    minutes: int = Field(..., ge=1, le=720, description="Focused duration in minutes to add")
    session_count: int = Field(default=1, ge=1, le=10, description="Completed focus sessions count")


# Analytics Schemas
class WeeklyTrendItem(BaseModel):
    day: str
    completed: int
    created: int


class SubjectWorkloadItem(BaseModel):
    subject_id: uuid.UUID | None
    subject_name: str
    color: str
    total_tasks: int
    completed_tasks: int
    pending_tasks: int


class TaskAnalyticsResponse(BaseModel):
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    overdue_tasks: int
    completion_rate: float
    total_focus_minutes: int
    total_focus_sessions: int
    weekly_trends: list[WeeklyTrendItem]
    subject_workload: list[SubjectWorkloadItem]


# AI Assistant Schemas
class TaskBreakdownRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=250)
    description: str | None = None
    estimated_minutes: int | None = None


class GeneratedSubtask(BaseModel):
    title: str
    estimated_minutes: int | None = None


class TaskBreakdownResponse(BaseModel):
    subtasks: list[GeneratedSubtask]


class TaskScheduleSuggestionRequest(BaseModel):
    available_hours_per_day: float = Field(default=3.0, ge=0.5, le=16.0)


class SchedulePlanItem(BaseModel):
    task_id: uuid.UUID
    task_title: str
    priority: TaskPriority
    suggested_date: str
    suggested_minutes: int
    rationale: str


class TaskScheduleSuggestionResponse(BaseModel):
    summary: str
    plan: list[SchedulePlanItem]


class TaskParseNaturalRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=500, description="Natural language task description")


class TaskParseNaturalResponse(BaseModel):
    title: str
    description: str | None = None
    priority: TaskPriority = TaskPriority.MEDIUM
    due_datetime: datetime | None = None
    estimated_minutes: int | None = None
    suggested_subtasks: list[str] = Field(default_factory=list)


class TaskDailyBriefingResponse(BaseModel):
    date: str
    greeting: str
    summary: str
    urgent_tasks: list[dict[str, Any]]
    recommended_focus_order: list[str]
