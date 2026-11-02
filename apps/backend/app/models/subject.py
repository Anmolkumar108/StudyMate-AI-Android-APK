import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
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
    from app.models.quiz import Quiz
    from app.models.task import Task
    from app.models.user import User


class Subject(Base):
    __tablename__ = "subjects"

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
    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    code: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    semester: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    color: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
        default="#6366F1",
        server_default=text("'#6366F1'"),
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

    # Relationship to user
    user: Mapped["User"] = relationship(
        "User",
        back_populates="subjects",
    )

    # Relationship to notes
    notes: Mapped[list["Note"]] = relationship(
        "Note",
        back_populates="subject",
        passive_deletes=True,
    )

    # Relationship to flashcard decks
    flashcard_decks: Mapped[list["FlashcardDeck"]] = relationship(
        "FlashcardDeck",
        back_populates="subject",
        passive_deletes=True,
    )

    # Relationship to documents
    documents: Mapped[list["Document"]] = relationship(
        "Document",
        back_populates="subject",
        passive_deletes=True,
    )

    # Relationship to AI chat sessions
    ai_chat_sessions: Mapped[list["AIChatSession"]] = relationship(
        "AIChatSession",
        back_populates="subject",
        passive_deletes=True,
    )

    # Relationship to quizzes
    quizzes: Mapped[list["Quiz"]] = relationship(
        "Quiz",
        back_populates="subject",
        passive_deletes=True,
    )

    # Relationship to tasks
    tasks: Mapped[list["Task"]] = relationship(
        "Task",
        back_populates="subject",
        passive_deletes=True,
    )

    __table_args__ = (
        Index("idx_subjects_user_id", "user_id"),
        Index("uq_subjects_user_name_lower", "user_id", func.lower(name), unique=True),
        CheckConstraint(
            "semester IS NULL OR semester >= 1",
            name="ck_subjects_semester_positive",
        ),
    )
