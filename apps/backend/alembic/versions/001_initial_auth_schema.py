"""initial_auth_schema

Revision ID: 001_initial_auth_schema
Revises:
Create Date: 2026-10-29 14:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001_initial_auth_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create PostgreSQL ENUM types
    user_role_enum = postgresql.ENUM(
        "student",
        "content_manager",
        "support_admin",
        "super_admin",
        name="user_role",
    )
    user_role_enum.create(op.get_bind(), checkfirst=True)

    user_status_enum = postgresql.ENUM(
        "active",
        "suspended",
        "pending_verification",
        name="user_status",
    )
    user_status_enum.create(op.get_bind(), checkfirst=True)

    # 2. Create users table
    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column(
            "role",
            postgresql.ENUM(
                "student",
                "content_manager",
                "support_admin",
                "super_admin",
                name="user_role",
                create_type=False,
            ),
            server_default=sa.text("'student'"),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "active",
                "suspended",
                "pending_verification",
                name="user_status",
                create_type=False,
            ),
            server_default=sa.text("'active'"),
            nullable=False,
        ),
        sa.Column("institution", sa.String(length=200), nullable=True),
        sa.Column("major", sa.String(length=200), nullable=True),
        sa.Column("graduation_year", sa.Integer(), nullable=True),
        sa.Column(
            "daily_study_goal_minutes",
            sa.Integer(),
            server_default=sa.text("120"),
            nullable=False,
        ),
        sa.Column(
            "theme_preference",
            sa.String(length=20),
            server_default=sa.text("'system'"),
            nullable=False,
        ),
        sa.Column(
            "push_notifications_enabled",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column("quiet_hours_start", sa.Time(), nullable=True),
        sa.Column("quiet_hours_end", sa.Time(), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "token_version",
            sa.Integer(),
            server_default=sa.text("1"),
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
        sa.CheckConstraint(
            "token_version >= 1", name="ck_users_token_version_positive"
        ),
    )

    # 3. Create indexes on users
    op.create_index("idx_users_email", "users", ["email"], unique=False)
    op.create_index("idx_users_status_role", "users", ["status", "role"], unique=False)
    op.create_index(
        "uq_users_email_lower", "users", [sa.text("lower(email)")], unique=True
    )

    # 4. Create user_sessions table
    op.create_table(
        "user_sessions",
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
        sa.Column("refresh_token_hash", sa.String(length=64), nullable=False),
        sa.Column("device_name", sa.String(length=150), nullable=True),
        sa.Column("device_os", sa.String(length=50), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column(
            "is_revoked",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("rotated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("refresh_token_hash"),
    )

    # 5. Create index on user_sessions
    op.create_index(
        "idx_user_sessions_lookup",
        "user_sessions",
        ["user_id", "is_revoked"],
        unique=False,
    )


def downgrade() -> None:
    # 1. Drop user_sessions table and its indexes
    op.drop_index("idx_user_sessions_lookup", table_name="user_sessions")
    op.drop_table("user_sessions")

    # 2. Drop users table and its indexes
    op.drop_index("uq_users_email_lower", table_name="users")
    op.drop_index("idx_users_status_role", table_name="users")
    op.drop_index("idx_users_email", table_name="users")
    op.drop_table("users")

    # 3. Drop PostgreSQL ENUM types
    user_status_enum = postgresql.ENUM(
        "active", "suspended", "pending_verification", name="user_status"
    )
    user_status_enum.drop(op.get_bind(), checkfirst=True)

    user_role_enum = postgresql.ENUM(
        "student",
        "content_manager",
        "support_admin",
        "super_admin",
        name="user_role",
    )
    user_role_enum.drop(op.get_bind(), checkfirst=True)
