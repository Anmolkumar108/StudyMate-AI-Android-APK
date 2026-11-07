"""create_timetable_schema

Revision ID: 008_create_timetable_schema
Revises: 007_upgrade_tasks_advanced
Create Date: 2026-11-03 16:15:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "008_create_timetable_schema"
down_revision: str | None = "007_upgrade_tasks_advanced"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "timetable_entries",
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
            sa.ForeignKey("subjects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("day_of_week", sa.SmallInteger(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("room", sa.String(length=100), nullable=True),
        sa.Column("building", sa.String(length=100), nullable=True),
        sa.Column("professor", sa.String(length=150), nullable=True),
        sa.Column("color", sa.String(length=50), nullable=True),
        sa.Column("is_online", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("virtual_url", sa.String(length=500), nullable=True),
        sa.Column(
            "reminder_minutes_before",
            sa.SmallInteger(),
            server_default=sa.text("15"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("day_of_week BETWEEN 1 AND 7", name="chk_timetable_day_of_week"),
        sa.CheckConstraint("end_time > start_time", name="chk_timetable_time_window"),
    )

    op.create_index("idx_timetable_user_day", "timetable_entries", ["user_id", "day_of_week"])
    op.create_index("idx_timetable_subject", "timetable_entries", ["subject_id"])


def downgrade() -> None:
    op.drop_index("idx_timetable_subject", table_name="timetable_entries")
    op.drop_index("idx_timetable_user_day", table_name="timetable_entries")
    op.drop_table("timetable_entries")

