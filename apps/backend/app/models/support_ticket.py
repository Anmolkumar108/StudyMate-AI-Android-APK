import enum
import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class TicketCategory(str, enum.Enum):
    BUG = "bug"
    COMPLAINT = "complaint"
    FEATURE_REQUEST = "feature_request"
    ACADEMIC_QUERY = "academic_query"
    ACCOUNT_ISSUE = "account_issue"
    OTHER = "other"


class TicketPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TicketStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    ticket_number: Mapped[str] = mapped_column(
        String(30),
        unique=True,
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    subject: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    category: Mapped[TicketCategory] = mapped_column(
        String(30),
        default=TicketCategory.OTHER,
        nullable=False,
    )
    priority: Mapped[TicketPriority] = mapped_column(
        String(20),
        default=TicketPriority.MEDIUM,
        nullable=False,
    )
    status: Mapped[TicketStatus] = mapped_column(
        String(20),
        default=TicketStatus.OPEN,
        nullable=False,
        index=True,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    admin_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    resolution_summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=text("now()"),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        server_default=text("now()"),
        nullable=False,
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    reporter: Mapped["User"] = relationship(
        "User",
        foreign_keys=[user_id],
        lazy="selectin",
    )
    assignee: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[assigned_to],
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_support_tickets_status_priority", "status", "priority"),
    )

