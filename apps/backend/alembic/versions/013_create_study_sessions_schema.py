"""create_study_sessions_schema

Revision ID: 013_create_study_sessions_schema
Revises: 012_create_study_plans_schema
Create Date: 2026-11-05 14:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "013_create_study_sessions_schema"
down_revision: str | None = "012_create_study_plans_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "pomodoro_sessions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "subject_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("subjects.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default=sa.text("25")),
        sa.Column("actual_seconds_spent", sa.Integer(), nullable=False, server_default=sa.text("1500")),
        sa.Column("session_type", sa.String(length=30), nullable=False, server_default=sa.text("'focus'")),
        sa.Column("completed_successfully", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("rating_focus", sa.Integer(), nullable=True),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("idx_pomodoro_user_started", "pomodoro_sessions", ["user_id", "started_at"])
    op.create_index("idx_pomodoro_user_subject", "pomodoro_sessions", ["user_id", "subject_id"])
    op.create_index("idx_pomodoro_user_created", "pomodoro_sessions", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("idx_pomodoro_user_created", table_name="pomodoro_sessions")
    op.drop_index("idx_pomodoro_user_subject", table_name="pomodoro_sessions")
    op.drop_index("idx_pomodoro_user_started", table_name="pomodoro_sessions")
    op.drop_table("pomodoro_sessions")

