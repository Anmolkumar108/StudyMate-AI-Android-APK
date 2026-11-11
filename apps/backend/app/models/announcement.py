import enum
import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class AnnouncementSeverity(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AnnouncementTarget(str, enum.Enum):
    ALL = "all"
    STUDENTS = "students"


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[AnnouncementSeverity] = mapped_column(
        Enum(
            AnnouncementSeverity,
            name="announcement_severity",
            native_enum=True,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=AnnouncementSeverity.INFO,
        nullable=False,
    )
    target_audience: Mapped[AnnouncementTarget] = mapped_column(
        Enum(
            AnnouncementTarget,
            name="announcement_target",
            native_enum=True,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=AnnouncementTarget.ALL,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    creator: Mapped["User | None"] = relationship(
        "User",
        back_populates="announcements",
        foreign_keys=[created_by],
    )

    __table_args__ = (
        Index("ix_announcements_is_active_created_at", "is_active", "created_at"),
        Index("ix_announcements_expires_at", "expires_at"),
    )

