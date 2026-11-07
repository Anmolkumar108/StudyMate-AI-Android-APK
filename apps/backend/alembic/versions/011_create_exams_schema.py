"""create_exams_schema

Revision ID: 011_create_exams_schema
Revises: 010_create_verification_tokens
Create Date: 2026-11-05 11:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "011_create_exams_schema"
down_revision: str | None = "010_create_verification_tokens"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "exams",
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
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("exam_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("location", sa.String(length=200), nullable=True),
        sa.Column("target_score", sa.Float(), nullable=True),
        sa.Column("achieved_score", sa.Float(), nullable=True),
        sa.Column(
            "syllabus_topics",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "revision_plan",
            postgresql.JSONB(astext_type=sa.Text()),
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
    )
    op.create_index("idx_exams_user_date", "exams", ["user_id", "exam_date"], unique=False)
    op.create_index("idx_exams_subject_id", "exams", ["subject_id"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_exams_subject_id", table_name="exams")
    op.drop_index("idx_exams_user_date", table_name="exams")
    op.drop_table("exams")

