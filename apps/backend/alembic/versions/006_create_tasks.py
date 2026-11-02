"""create_tasks_schema

Revision ID: 006_create_tasks
Revises: 005_create_docs_ai_and_quizzes
Create Date: 2026-11-02 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "006_create_tasks"
down_revision: str | None = "005_create_docs_ai_and_quizzes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create task_priority enum safely if not already present
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )

    # 2. Create task_status enum safely if not already present
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'completed', 'cancelled');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )

    # 3. Create tasks table
    op.create_table(
        "tasks",
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
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("due_datetime", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "priority",
            postgresql.ENUM(
                "low",
                "medium",
                "high",
                "urgent",
                name="task_priority",
                create_type=False,
            ),
            server_default=sa.text("'medium'"),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "todo",
                "in_progress",
                "completed",
                "cancelled",
                name="task_status",
                create_type=False,
            ),
            server_default=sa.text("'todo'"),
            nullable=False,
        ),
        sa.Column("estimated_minutes", sa.Integer(), nullable=True),
        sa.Column(
            "subtasks",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["subject_id"],
            ["subjects.id"],
            name="fk_tasks_subject_id_subjects",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_tasks_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_tasks"),
    )

    # 4. Create Indexes
    op.create_index(
        "idx_tasks_user_status_due",
        "tasks",
        ["user_id", "status", "due_datetime"],
        unique=False,
    )
    op.create_index(
        "idx_tasks_subject",
        "tasks",
        ["subject_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_tasks_subject", table_name="tasks")
    op.drop_index("idx_tasks_user_status_due", table_name="tasks")
    op.drop_table("tasks")
    op.execute("DROP TYPE IF EXISTS task_status")
    op.execute("DROP TYPE IF EXISTS task_priority")

