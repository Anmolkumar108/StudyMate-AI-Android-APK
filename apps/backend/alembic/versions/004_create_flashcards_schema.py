"""create_flashcards_schema

Revision ID: 004_create_flashcards_schema
Revises: 003_create_notes_schema
Create Date: 2026-11-01 22:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "004_create_flashcards_schema"
down_revision: str | None = "003_create_notes_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create flashcard_decks table
    op.create_table(
        "flashcard_decks",
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
        sa.Column("description", sa.Text(), nullable=True),
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

    # 2. Create indexes for flashcard_decks
    op.create_index("idx_decks_user_id", "flashcard_decks", ["user_id"], unique=False)
    op.create_index(
        "idx_decks_subject_id", "flashcard_decks", ["subject_id"], unique=False
    )
    op.create_index(
        "idx_decks_user_updated",
        "flashcard_decks",
        ["user_id", "updated_at"],
        unique=False,
    )

    # 3. Create flashcards table
    op.create_table(
        "flashcards",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "deck_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["deck_id"], ["flashcard_decks.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )

    # 4. Create indexes for flashcards
    op.create_index("idx_flashcards_deck_id", "flashcards", ["deck_id"], unique=False)
    op.create_index("idx_flashcards_user_id", "flashcards", ["user_id"], unique=False)
    op.create_index(
        "idx_flashcards_deck_created",
        "flashcards",
        ["deck_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    # 1. Drop flashcards indexes and table
    op.drop_index("idx_flashcards_deck_created", table_name="flashcards")
    op.drop_index("idx_flashcards_user_id", table_name="flashcards")
    op.drop_index("idx_flashcards_deck_id", table_name="flashcards")
    op.drop_table("flashcards")

    # 2. Drop flashcard_decks indexes and table
    op.drop_index("idx_decks_user_updated", table_name="flashcard_decks")
    op.drop_index("idx_decks_subject_id", table_name="flashcard_decks")
    op.drop_index("idx_decks_user_id", table_name="flashcard_decks")
    op.drop_table("flashcard_decks")
