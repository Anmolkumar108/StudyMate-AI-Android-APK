import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, Any

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class StudyPlan(Base):
    __tablename__ = "study_plans"

    id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=sa.text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        postgresql.UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    plan_date: Mapped[date] = mapped_column(sa.Date, nullable=False, index=True)
    target_study_minutes: Mapped[int] = mapped_column(sa.Integer, default=180, nullable=False)
    planned_minutes: Mapped[int] = mapped_column(sa.Integer, default=0, nullable=False)
    completed_minutes: Mapped[int] = mapped_column(sa.Integer, default=0, nullable=False)

    # JSONB array of study blocks
    timeblocks: Mapped[list[dict[str, Any]]] = mapped_column(
        postgresql.JSONB(astext_type=sa.Text()),
        default=list,
        server_default=sa.text("'[]'::jsonb"),
        nullable=False,
    )

    ai_summary: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    status: Mapped[str] = mapped_column(sa.String(30), default="active", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        onupdate=sa.func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="study_plans")

    __table_args__ = (
        sa.UniqueConstraint("user_id", "plan_date", name="idx_study_plans_user_date"),
    )
