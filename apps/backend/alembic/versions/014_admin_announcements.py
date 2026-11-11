"""admin_announcements

Revision ID: 014_admin_announcements
Revises: 013_create_study_sessions_schema
Create Date: 2026-11-07 18:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic (must be <= 32 chars).
revision: str = "014_admin_announcements"
down_revision: str | None = "013_create_study_sessions_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Announcements Enums safely created
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE announcement_severity AS ENUM ('info', 'warning', 'critical');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE announcement_target AS ENUM ('all', 'students');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )

    op.create_table(
        "announcements",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "severity",
            postgresql.ENUM("info", "warning", "critical", name="announcement_severity", create_type=False),
            nullable=False,
            server_default="info",
        ),
        sa.Column(
            "target_audience",
            postgresql.ENUM("all", "students", name="announcement_target", create_type=False),
            nullable=False,
            server_default="all",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
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
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index(
        "ix_announcements_is_active_created_at",
        "announcements",
        ["is_active", "created_at"],
    )
    op.create_index(
        "ix_announcements_expires_at",
        "announcements",
        ["expires_at"],
    )

    # 2. Audit Logs Table
    op.create_table(
        "audit_logs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "actor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("target_type", sa.String(length=50), nullable=False),
        sa.Column("target_id", sa.String(length=100), nullable=True),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(length=50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )

    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])
    op.create_index(
        "ix_audit_logs_target_type_id",
        "audit_logs",
        ["target_type", "target_id"],
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("announcements")

    op.execute("DROP TYPE IF EXISTS announcement_target")
    op.execute("DROP TYPE IF EXISTS announcement_severity")

