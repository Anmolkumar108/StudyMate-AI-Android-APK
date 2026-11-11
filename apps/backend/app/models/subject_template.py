import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class SubjectTemplate(Base):
    __tablename__ = "subject_templates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    code: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    category: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="General",
        server_default=text("'General'"),
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    color: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="#6366F1",
        server_default=text("'#6366F1'"),
    )
    credits: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=3,
        server_default=text("3"),
    )
    difficulty_level: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="intermediate",
        server_default=text("'intermediate'"),
    )
    suggested_units: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=False,
        default=list,
        server_default=text("'[]'"),
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    enrolled_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        server_default=text("now()"),
    )

    # Relationship to admin creator
    creator: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[created_by],
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_subject_templates_category", "category"),
        Index("ix_subject_templates_is_active", "is_active"),
        Index("ix_subject_templates_created_at", "created_at"),
    )

