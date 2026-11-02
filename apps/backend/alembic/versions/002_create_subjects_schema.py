"""create_subjects_schema

Revision ID: 002_create_subjects_schema
Revises: 001_initial_auth_schema
Create Date: 2026-10-31 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002_create_subjects_schema"
down_revision: str | None = "001_initial_auth_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create subjects table
    op.create_table(
        "subjects",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("semester", sa.Integer(), nullable=True),
        sa.Column(
            "color",
            sa.String(length=30),
            server_default=sa.text("'#6366F1'"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.CheckConstraint(
            "semester IS NULL OR semester >= 1",
            name="ck_subjects_semester_positive",
        ),
    )

    # 2. Create indexes
    op.create_index("idx_subjects_user_id", "subjects", ["user_id"], unique=False)
    op.create_index(
        "uq_subjects_user_name_lower",
        "subjects",
        ["user_id", sa.text("lower(name)")],
        unique=True,
    )


def downgrade() -> None:
    # 1. Drop indexes
    op.drop_index("uq_subjects_user_name_lower", table_name="subjects")
    op.drop_index("idx_subjects_user_id", table_name="subjects")

    # 2. Drop table
    op.drop_table("subjects")
