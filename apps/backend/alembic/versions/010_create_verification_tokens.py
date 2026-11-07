"""create_verification_tokens

Revision ID: 010_create_verification_tokens
Revises: 009_timetable_attendance
Create Date: 2026-11-04 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "010_create_verification_tokens"
down_revision: str | None = "009_timetable_attendance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "verification_tokens",
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
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "token_type",
            sa.String(length=32),
            server_default=sa.text("'email_verification'"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_verification_tokens_user_id",
        "verification_tokens",
        ["user_id"],
    )
    op.create_index(
        "ix_verification_tokens_token_hash",
        "verification_tokens",
        ["token_hash"],
    )
    op.create_index(
        "ix_verification_tokens_lookup",
        "verification_tokens",
        ["token_hash", "token_type"],
    )
    op.create_index(
        "ix_verification_tokens_user_type",
        "verification_tokens",
        ["user_id", "token_type"],
    )


def downgrade() -> None:
    op.drop_index("ix_verification_tokens_user_type", table_name="verification_tokens")
    op.drop_index("ix_verification_tokens_lookup", table_name="verification_tokens")
    op.drop_index("ix_verification_tokens_token_hash", table_name="verification_tokens")
    op.drop_index("ix_verification_tokens_user_id", table_name="verification_tokens")
    op.drop_table("verification_tokens")

