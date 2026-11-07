"""timetable_attendance

Revision ID: 009_timetable_attendance
Revises: 008_create_timetable_schema
Create Date: 2026-11-03 21:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "009_timetable_attendance"
down_revision: str | None = "008_create_timetable_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add start_date and end_date columns to timetable_entries
    op.add_column("timetable_entries", sa.Column("start_date", sa.Date(), nullable=True))
    op.add_column("timetable_entries", sa.Column("end_date", sa.Date(), nullable=True))

    # Create timetable_attendance table
    op.create_table(
        "timetable_attendance",
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
            "timetable_entry_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("timetable_entries.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "subject_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("subjects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("attendance_date", sa.Date(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default=sa.text("'present'"),
            nullable=False,
        ),
        sa.Column("notes", sa.String(length=250), nullable=True),
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
        sa.CheckConstraint(
            "status IN ('present', 'absent', 'late')",
            name="chk_attendance_status",
        ),
        sa.UniqueConstraint(
            "user_id",
            "timetable_entry_id",
            "attendance_date",
            name="uq_attendance_user_entry_date",
        ),
    )

    op.create_index("idx_attendance_user_date", "timetable_attendance", ["user_id", "attendance_date"])
    op.create_index("idx_attendance_user_subject", "timetable_attendance", ["user_id", "subject_id"])
    op.create_index(
        "idx_attendance_entry_date",
        "timetable_attendance",
        ["timetable_entry_id", "attendance_date"],
    )


def downgrade() -> None:
    op.drop_index("idx_attendance_entry_date", table_name="timetable_attendance")
    op.drop_index("idx_attendance_user_subject", table_name="timetable_attendance")
    op.drop_index("idx_attendance_user_date", table_name="timetable_attendance")
    op.drop_table("timetable_attendance")

    op.drop_column("timetable_entries", "end_date")
    op.drop_column("timetable_entries", "start_date")

