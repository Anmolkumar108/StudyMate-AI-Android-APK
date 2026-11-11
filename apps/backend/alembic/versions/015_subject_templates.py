"""subject_templates

Revision ID: 015_subject_templates
Revises: 014_admin_announcements
Create Date: 2026-11-07 19:45:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic (must be <= 32 chars).
revision: str = "015_subject_templates"
down_revision: str | None = "014_admin_announcements"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "subject_templates",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=True),
        sa.Column("category", sa.String(length=100), nullable=False, server_default=sa.text("'General'")),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color", sa.String(length=30), nullable=False, server_default=sa.text("'#6366F1'")),
        sa.Column("credits", sa.Integer(), nullable=False, server_default=sa.text("3")),
        sa.Column("difficulty_level", sa.String(length=30), nullable=False, server_default=sa.text("'intermediate'")),
        sa.Column("suggested_units", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("enrolled_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_index(
        "ix_subject_templates_category",
        "subject_templates",
        ["category"],
        unique=False,
    )
    op.create_index(
        "ix_subject_templates_is_active",
        "subject_templates",
        ["is_active"],
        unique=False,
    )
    op.create_index(
        "ix_subject_templates_created_at",
        "subject_templates",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_subject_templates_created_at", table_name="subject_templates")
    op.drop_index("ix_subject_templates_is_active", table_name="subject_templates")
    op.drop_index("ix_subject_templates_category", table_name="subject_templates")
    op.drop_table("subject_templates")

