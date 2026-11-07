import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.subject import Subject
    from app.models.task import Task
    from app.models.user import User


class StudySession(Base):
    """
    Pomodoro and focus study session record for longitudinal analytics (FR-12 & FR-16).
    Maps to 'pomodoro_sessions' table.
    """

    __tablename__ = "pomodoro_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    subject_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("subjects.id", ondelete="SET NULL"),
        nullable=True,
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
    )
    duration_minutes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=25,
    )
    actual_seconds_spent: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1500,
    )
    session_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="focus",
        server_default=text("'focus'"),
    )
    completed_successfully: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    rating_focus: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    ended_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=text("now()"),
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="study_sessions",
    )
    subject: Mapped["Subject | None"] = relationship(
        "Subject",
        back_populates="study_sessions",
    )
    task: Mapped["Task | None"] = relationship(
        "Task",
        back_populates="study_sessions",
    )

    __table_args__ = (
        Index("idx_pomodoro_user_started", "user_id", "started_at"),
        Index("idx_pomodoro_user_subject", "user_id", "subject_id"),
        Index("idx_pomodoro_user_created", "user_id", "created_at"),
    )


# Alias for domain clarity
PomodoroSession = StudySession

