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
