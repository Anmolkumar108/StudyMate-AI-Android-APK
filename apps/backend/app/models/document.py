import enum
import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    BigInteger,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.subject import Subject
    from app.models.user import User


class DocStatus(str, enum.Enum):
    UPLOAD_PENDING = "upload_pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class Document(Base):
    __tablename__ = "documents"

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
    title: Mapped[str] = mapped_column(
        String(250),
        nullable=False,
    )
    file_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    file_size_bytes: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="application/pdf",
        server_default=text("'application/pdf'"),
    )
    storage_key: Mapped[str] = mapped_column(
        String(500),
        unique=True,
        nullable=False,
    )
    file_hash_sha256: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )
    page_count: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    status: Mapped[DocStatus] = mapped_column(
        Enum(DocStatus, name="doc_status", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=DocStatus.UPLOAD_PENDING,
        server_default=text("'upload_pending'"),
    )
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    summary_tldr: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    summary_key_concepts: Mapped[list[Any] | dict[str, Any] | None] = mapped_column(
        JSONB().with_variant(JSON(), "sqlite"),
        nullable=True,
    )
    extracted_text_snippet: Mapped[str | None] = mapped_column(
        Text,
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
        server_default=text("now()"),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="documents",
    )
    subject: Mapped["Subject | None"] = relationship(
        "Subject",
        back_populates="documents",
    )

    __table_args__ = (
        Index("idx_documents_user", "user_id"),
        Index("idx_documents_status", "status"),
        Index("idx_documents_user_subject", "user_id", "subject_id"),
    )

