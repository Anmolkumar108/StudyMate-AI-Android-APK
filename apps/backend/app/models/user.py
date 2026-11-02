import enum
import uuid
from datetime import UTC, datetime, time
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    Index,
    Integer,
    String,
    Time,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.ai_chat import AIChatSession
    from app.models.document import Document
    from app.models.flashcard import FlashcardDeck
    from app.models.note import Note
    from app.models.quiz import Quiz, QuizAttempt
    from app.models.session import UserSession
    from app.models.subject import Subject
    from app.models.task import Task


class UserRole(str, enum.Enum):
    STUDENT = "student"
    CONTENT_MANAGER = "content_manager"
    SUPPORT_ADMIN = "support_admin"
    SUPER_ADMIN = "super_admin"


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    PENDING_VERIFICATION = "pending_verification"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    full_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    avatar_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    role: Mapped[UserRole] = mapped_column(
        Enum(
            UserRole,
            name="user_role",
            native_enum=True,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        default=UserRole.STUDENT,
        server_default=text("'student'"),
    )
    status: Mapped[UserStatus] = mapped_column(
        Enum(
            UserStatus,
            name="user_status",
            native_enum=True,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        default=UserStatus.ACTIVE,
        server_default=text("'active'"),
    )

    # Academic Profile Fields
    institution: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )
    major: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )
    graduation_year: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    daily_study_goal_minutes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=120,
        server_default=text("120"),
    )

    # Settings & Preferences
    theme_preference: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="system",
        server_default=text("'system'"),
    )
    push_notifications_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    quiet_hours_start: Mapped[time | None] = mapped_column(
        Time,
        nullable=True,
    )
    quiet_hours_end: Mapped[time | None] = mapped_column(
        Time,
        nullable=True,
    )

    # Security & Audit
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    token_version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        server_default=text("1"),
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

    # Relationship to user_sessions
    sessions: Mapped[list["UserSession"]] = relationship(
        "UserSession",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # Relationship to subjects
    subjects: Mapped[list["Subject"]] = relationship(
        "Subject",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # Relationship to notes
    notes: Mapped[list["Note"]] = relationship(
        "Note",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # Relationship to flashcard decks
    flashcard_decks: Mapped[list["FlashcardDeck"]] = relationship(
        "FlashcardDeck",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # Relationship to documents
    documents: Mapped[list["Document"]] = relationship(
        "Document",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # Relationship to AI chat sessions
    ai_chat_sessions: Mapped[list["AIChatSession"]] = relationship(
        "AIChatSession",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # Relationship to quizzes
    quizzes: Mapped[list["Quiz"]] = relationship(
        "Quiz",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # Relationship to quiz attempts
    quiz_attempts: Mapped[list["QuizAttempt"]] = relationship(
        "QuizAttempt",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # Relationship to tasks
    tasks: Mapped[list["Task"]] = relationship(
        "Task",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        Index("idx_users_email", "email"),
        Index("idx_users_status_role", "status", "role"),
        Index("uq_users_email_lower", func.lower(email), unique=True),
        CheckConstraint("token_version >= 1", name="ck_users_token_version_positive"),
    )
