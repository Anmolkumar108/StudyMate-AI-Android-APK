"""create_notes_schema

Revision ID: 003_create_notes_schema
Revises: 002_create_subjects_schema
Create Date: 2026-10-31 19:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "003_create_notes_schema"
down_revision: str | None = "002_create_subjects_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create notes table
    op.create_table(
        "notes",
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
        sa.Column(
            "subject_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "is_pinned",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
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
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="SET NULL"),
    )

    # 2. Create indexes
    op.create_index("idx_notes_user_id", "notes", ["user_id"], unique=False)
    op.create_index("idx_notes_subject_id", "notes", ["subject_id"], unique=False)
    op.create_index(
        "idx_notes_user_pinned_updated",
        "notes",
        ["user_id", "is_pinned", "updated_at"],
        unique=False,
    )


def downgrade() -> None:
    # 1. Drop indexes
    op.drop_index("idx_notes_user_pinned_updated", table_name="notes")
    op.drop_index("idx_notes_subject_id", table_name="notes")
    op.drop_index("idx_notes_user_id", table_name="notes")

    # 2. Drop table
    op.drop_table("notes")
