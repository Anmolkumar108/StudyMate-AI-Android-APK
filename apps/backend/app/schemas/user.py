from datetime import datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str
    avatar_url: str | None = None
    role: str
    status: str
    institution: str | None = None
    major: str | None = None
    graduation_year: int | None = None
    daily_study_goal_minutes: int
    theme_preference: str
    push_notifications_enabled: bool
    quiet_hours_start: time | None = None
    quiet_hours_end: time | None = None
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None = None


class UserPreferencesUpdate(BaseModel):
    push_notifications_enabled: bool | None = None
    quiet_hours_start: time | None = None
    quiet_hours_end: time | None = None
    daily_study_goal_minutes: int | None = None
    theme_preference: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ChangePasswordResponse(BaseModel):
    message: str
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"


class DeleteAccountRequest(BaseModel):
    password: str
    reason: str | None = None


class PushTokenRegisterRequest(BaseModel):
    push_token: str
    platform: str = "android"
    device_name: str | None = None


class UserExportData(BaseModel):
    exported_at: datetime
    export_version: str = "1.0"
    user_profile: dict
    subjects: list[dict]
    timetable: list[dict]
    tasks: list[dict]
    notes: list[dict]
    flashcards: list[dict]
    exams: list[dict]
    study_plans: list[dict]
    study_sessions: list[dict]
    analytics: dict
