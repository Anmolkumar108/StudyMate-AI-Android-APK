import uuid
from datetime import date, datetime, time
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class AttendanceStatus(str, Enum):
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"


class TimetableEntryBase(BaseModel):
    day_of_week: int = Field(..., ge=1, le=7, description="1=Monday ... 7=Sunday")
    start_time: time = Field(..., description="Start time (HH:MM or HH:MM:SS)")
    end_time: time = Field(..., description="End time (HH:MM or HH:MM:SS)")
    subject_id: uuid.UUID = Field(..., description="Subject UUID")
    room: str | None = Field(None, max_length=100)
    building: str | None = Field(None, max_length=100)
    professor: str | None = Field(None, max_length=150)
    color: str | None = Field(None, max_length=50)
    is_online: bool = Field(False)
    virtual_url: str | None = Field(None, max_length=500)
    reminder_minutes_before: int = Field(15, ge=0, le=120)
    start_date: date | None = None
    end_date: date | None = None

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def parse_optional_date(cls, v: object) -> object:
        if v is None:
            return None
        if isinstance(v, str):
            v_str = v.strip()
            if not v_str:
                return None
            try:
                return date.fromisoformat(v_str)
            except ValueError:
                return None
        return v


class TimetableEntryCreate(TimetableEntryBase):
    @model_validator(mode="after")
    def validate_times(self) -> "TimetableEntryCreate":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be strictly after start_time")
        if self.start_date is not None and self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class TimetableEntryBatchCreate(BaseModel):
    days_of_week: list[int] = Field(..., min_length=1, description="List of weekdays 1-7")
    start_time: time = Field(..., description="Start time (HH:MM or HH:MM:SS)")
    end_time: time = Field(..., description="End time (HH:MM or HH:MM:SS)")
    subject_id: uuid.UUID = Field(..., description="Subject UUID")
    room: str | None = Field(None, max_length=100)
    building: str | None = Field(None, max_length=100)
    professor: str | None = Field(None, max_length=150)
    color: str | None = Field(None, max_length=50)
    is_online: bool = Field(False)
    virtual_url: str | None = Field(None, max_length=500)
    reminder_minutes_before: int = Field(15, ge=0, le=120)
    start_date: date | None = None
    end_date: date | None = None

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def parse_optional_date(cls, v: object) -> object:
        if v is None:
            return None
        if isinstance(v, str):
            v_str = v.strip()
            if not v_str:
                return None
            try:
                return date.fromisoformat(v_str)
            except ValueError:
                return None
        return v

    @model_validator(mode="after")
    def validate_batch(self) -> "TimetableEntryBatchCreate":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be strictly after start_time")
        for d in self.days_of_week:
            if d < 1 or d > 7:
                raise ValueError("Each day_of_week must be between 1 and 7")
        if self.start_date is not None and self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class TimetableEntryUpdate(BaseModel):
    day_of_week: int | None = Field(None, ge=1, le=7)
    start_time: time | None = None
    end_time: time | None = None
    subject_id: uuid.UUID | None = None
    room: str | None = Field(None, max_length=100)
    building: str | None = Field(None, max_length=100)
    professor: str | None = Field(None, max_length=150)
    color: str | None = Field(None, max_length=50)
    is_online: bool | None = None
    virtual_url: str | None = Field(None, max_length=500)
    reminder_minutes_before: int | None = Field(None, ge=0, le=120)
    start_date: date | None = None
    end_date: date | None = None

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def parse_optional_date(cls, v: object) -> object:
        if v is None:
            return None
        if isinstance(v, str):
            v_str = v.strip()
            if not v_str:
                return None
            try:
                return date.fromisoformat(v_str)
            except ValueError:
                return None
        return v

    @model_validator(mode="after")
    def validate_times(self) -> "TimetableEntryUpdate":
        if self.start_time is not None and self.end_time is not None and self.end_time <= self.start_time:
            raise ValueError("end_time must be strictly after start_time")
        if self.start_date is not None and self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class TimetableEntryResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    subject_id: uuid.UUID
    day_of_week: int
    start_time: time
    end_time: time
    room: str | None = None
    building: str | None = None
    professor: str | None = None
    color: str | None = None
    is_online: bool = False
    virtual_url: str | None = None
    reminder_minutes_before: int = 15
    start_date: date | None = None
    end_date: date | None = None
    subject_name: str | None = None
    subject_color: str | None = None
    subject_code: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TimetableConflictCheckRequest(BaseModel):
    day_of_week: int = Field(..., ge=1, le=7)
    start_time: time
    end_time: time
    exclude_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_times(self) -> "TimetableConflictCheckRequest":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be strictly after start_time")
        return self


class TimetableConflictResponse(BaseModel):
    has_conflict: bool
    conflicting_entries: list[TimetableEntryResponse] = Field(default_factory=list)


class WeeklyTimetableResponse(BaseModel):
    entries: list[TimetableEntryResponse]
    by_day: dict[int, list[TimetableEntryResponse]]
    total_classes: int


# ================= Attendance Schemas =================


class AttendanceMarkRequest(BaseModel):
    timetable_entry_id: uuid.UUID | None = None
    subject_id: uuid.UUID
    attendance_date: date
    status: AttendanceStatus = AttendanceStatus.PRESENT
    notes: str | None = Field(None, max_length=250)


class AttendanceRecordResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    timetable_entry_id: uuid.UUID | None = None
    subject_id: uuid.UUID
    attendance_date: date
    status: str
    notes: str | None = None
    subject_name: str | None = None
    subject_color: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SubjectAttendanceStats(BaseModel):
    subject_id: uuid.UUID
    subject_name: str
    subject_color: str | None = None
    total_classes: int
    present_count: int
    absent_count: int
    late_count: int
    percentage: float
    is_low_attendance: bool


class AttendanceSummaryResponse(BaseModel):
    total_classes: int
    present_count: int
    absent_count: int
    late_count: int
    overall_percentage: float
    minimum_required_percentage: float = 75.0
    is_overall_low: bool
    subjects: list[SubjectAttendanceStats]


