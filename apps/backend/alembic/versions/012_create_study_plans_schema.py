"""create_study_plans_schema

Revision ID: 012_create_study_plans_schema
Revises: 011_create_exams_schema
Create Date: 2026-11-05 12:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "012_create_study_plans_schema"
down_revision: str | None = "011_create_exams_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "study_plans",
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
        sa.Column("plan_date", sa.Date(), nullable=False),
        sa.Column("target_study_minutes", sa.Integer(), server_default=sa.text("180"), nullable=False),
        sa.Column("planned_minutes", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("completed_minutes", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "timeblocks",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("ai_summary", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), server_default=sa.text("'active'"), nullable=False),
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
        sa.UniqueConstraint("user_id", "plan_date", name="idx_study_plans_user_date"),
    )


def downgrade() -> None:
    op.drop_table("study_plans")
