import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, JSON, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AppConfig(Base):
    __tablename__ = "app_configurations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    key: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )
    value: Mapped[Any] = mapped_column(
        JSON,
        nullable=False,
    )
    category: Mapped[str] = mapped_column(
        String(50),
        default="general",
        nullable=False,
        index=True,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    is_secret: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        server_default=text("now()"),
        nullable=False,
    )

