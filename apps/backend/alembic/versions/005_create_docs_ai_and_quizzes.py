"""create_docs_ai_and_quizzes_schema

Revision ID: 005_create_docs_ai_and_quizzes
Revises: 004_create_flashcards_schema
Create Date: 2026-11-02 12:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "005_create_docs_ai_and_quizzes"
down_revision: str | None = "004_create_flashcards_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create doc_status enum safely if not already present
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE doc_status AS ENUM ('upload_pending', 'processing', 'ready', 'failed');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )

    op.create_table(
        "documents",
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
        sa.Column("title", sa.String(length=250), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column(
            "mime_type",
            sa.String(length=100),
            server_default=sa.text("'application/pdf'"),
            nullable=False,
        ),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("file_hash_sha256", sa.String(length=64), nullable=False),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM("upload_pending", "processing", "ready", "failed", name="doc_status", create_type=False),
            server_default=sa.text("'upload_pending'"),
            nullable=False,
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("summary_tldr", sa.Text(), nullable=True),
        sa.Column("summary_key_concepts", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("extracted_text_snippet", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_key"),
    )
    op.create_index("idx_documents_user", "documents", ["user_id"], unique=False)
    op.create_index("idx_documents_status", "documents", ["status"], unique=False)
    op.create_index("idx_documents_user_subject", "documents", ["user_id", "subject_id"], unique=False)

    # 2. Create ai_chat_sessions table
    op.create_table(
        "ai_chat_sessions",
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
        sa.Column("title", sa.String(length=200), server_default=sa.text("'New Conversation'"), nullable=False),
        sa.Column("is_socratic", sa.Boolean(), server_default=sa.text("false"), nullable=False),
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
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_ai_chat_sessions_user", "ai_chat_sessions", ["user_id"], unique=False)
    op.create_index("idx_ai_chat_sessions_user_subject", "ai_chat_sessions", ["user_id", "subject_id"], unique=False)

    # 3. Create ai_chat_messages table
    op.create_table(
        "ai_chat_messages",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=True),
        sa.Column("model_identifier", sa.String(length=100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["session_id"], ["ai_chat_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_chat_messages_session", "ai_chat_messages", ["session_id", "created_at"], unique=False)

    # 4. Create quizzes table
    op.create_table(
        "quizzes",
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
        sa.Column("source_type", sa.String(length=50), server_default=sa.text("'custom'"), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("difficulty", sa.String(length=20), server_default=sa.text("'medium'"), nullable=False),
        sa.Column("question_count", sa.Integer(), server_default=sa.text("5"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_quizzes_user", "quizzes", ["user_id"], unique=False)
    op.create_index("idx_quizzes_user_subject", "quizzes", ["user_id", "subject_id"], unique=False)

    # 5. Create quiz_questions table
    op.create_table(
        "quiz_questions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "quiz_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("question_type", sa.String(length=20), server_default=sa.text("'mcq'"), nullable=False),
        sa.Column("options", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("correct_option_key", sa.String(length=10), nullable=False),
        sa.Column("explanation", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["quiz_id"], ["quizzes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_quiz_questions_quiz_id", "quiz_questions", ["quiz_id"], unique=False)

    # 6. Create quiz_attempts table
    op.create_table(
        "quiz_attempts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "quiz_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("score_percentage", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("correct_count", sa.Integer(), nullable=False),
        sa.Column("incorrect_count", sa.Integer(), nullable=False),
        sa.Column("answers_submitted", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("time_taken_seconds", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["quiz_id"], ["quizzes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_quiz_attempts_user_id", "quiz_attempts", ["user_id", "completed_at"], unique=False)
    op.create_index("idx_quiz_attempts_quiz_id", "quiz_attempts", ["quiz_id"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_quiz_attempts_quiz_id", table_name="quiz_attempts")
    op.drop_index("idx_quiz_attempts_user_id", table_name="quiz_attempts")
    op.drop_table("quiz_attempts")

    op.drop_index("idx_quiz_questions_quiz_id", table_name="quiz_questions")
    op.drop_table("quiz_questions")

    op.drop_index("idx_quizzes_user_subject", table_name="quizzes")
    op.drop_index("idx_quizzes_user", table_name="quizzes")
    op.drop_table("quizzes")

    op.drop_index("idx_chat_messages_session", table_name="ai_chat_messages")
    op.drop_table("ai_chat_messages")

    op.drop_index("idx_ai_chat_sessions_user_subject", table_name="ai_chat_sessions")
    op.drop_index("idx_ai_chat_sessions_user", table_name="ai_chat_sessions")
    op.drop_table("ai_chat_sessions")

    op.drop_index("idx_documents_user_subject", table_name="documents")
    op.drop_index("idx_documents_status", table_name="documents")
    op.drop_index("idx_documents_user", table_name="documents")
    op.drop_table("documents")

    sa.Enum(name="doc_status").drop(op.get_bind(), checkfirst=True)

