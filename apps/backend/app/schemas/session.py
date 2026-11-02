from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    device_name: str | None = None
    device_os: str | None = None
    ip_address: str | None = None
    is_revoked: bool
    created_at: datetime
    expires_at: datetime
    rotated_at: datetime | None = None
