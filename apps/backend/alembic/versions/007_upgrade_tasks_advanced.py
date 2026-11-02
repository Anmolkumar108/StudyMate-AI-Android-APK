"""upgrade_tasks_advanced

Revision ID: 007_upgrade_tasks_advanced
Revises: 006_create_tasks
Create Date: 2026-11-02 21:30:00.000000

"""

import json
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "007_upgrade_tasks_advanced"
down_revision: str | None = "006_create_tasks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Add advanced task columns to tasks table
    op.add_column(
        "tasks",
        sa.Column(
            "depends_on_task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", name="fk_tasks_depends_on_task_id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "tasks",
        sa.Column("recurrence_pattern", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "tasks",
        sa.Column("recurrence_interval", sa.Integer(), server_default=sa.text("1"), nullable=True),
    )
    op.add_column(
        "tasks",
        sa.Column("recurrence_end_date", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "tasks",
        sa.Column(
            "attachments",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.add_column(
        "tasks",
        sa.Column("focus_minutes", sa.Integer(), server_default=sa.text("0"), nullable=False),
    )
    op.add_column(
        "tasks",
        sa.Column("focus_sessions_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
    )

    op.create_index(
        "idx_tasks_depends_on",
        "tasks",
        ["depends_on_task_id"],
        unique=False,
    )

    # 2. Create task_templates table
    op.create_table(
        "task_templates",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", name="fk_task_templates_user_id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("title", sa.String(length=250), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "default_priority",
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
        sa.Column("estimated_minutes", sa.Integer(), nullable=True),
        sa.Column(
            "subtasks",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("category", sa.String(length=50), server_default=sa.text("'general'"), nullable=False),
        sa.Column("is_system", sa.Boolean(), server_default=sa.text("false"), nullable=False),
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
        sa.PrimaryKeyConstraint("id", name="pk_task_templates"),
    )

    op.create_index(
        "idx_task_templates_user",
        "task_templates",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "idx_task_templates_system",
        "task_templates",
        ["is_system"],
        unique=False,
    )

    # 3. Seed default system task templates
    system_templates = [
        {
            "title": "College Course Assignment",
            "description": "Standard structured workflow for coursework and graded assignments.",
            "category": "assignment",
            "priority": "medium",
            "estimated_minutes": 120,
            "subtasks": [
                {"id": "st-as-1", "title": "Review assignment rubric & guidelines", "is_completed": False, "order": 1},
                {"id": "st-as-2", "title": "Research references and lecture slides", "is_completed": False, "order": 2},
                {"id": "st-as-3", "title": "Draft outline and core calculations / arguments", "is_completed": False, "order": 3},
                {"id": "st-as-4", "title": "Complete full solution or paper draft", "is_completed": False, "order": 4},
                {"id": "st-as-5", "title": "Proofread, format citations & final submission", "is_completed": False, "order": 5},
            ],
        },
        {
            "title": "Midterm / Final Exam Prep",
            "description": "Comprehensive review schedule for upcoming academic exams.",
            "category": "exam_prep",
            "priority": "urgent",
            "estimated_minutes": 180,
            "subtasks": [
                {"id": "st-ex-1", "title": "Review syllabus topics & identify weak areas", "is_completed": False, "order": 1},
                {"id": "st-ex-2", "title": "Synthesize summary notes & formula sheets", "is_completed": False, "order": 2},
                {"id": "st-ex-3", "title": "Practice active recall with SM-2 flashcards", "is_completed": False, "order": 3},
                {"id": "st-ex-4", "title": "Solve 2 past exam question papers under timed conditions", "is_completed": False, "order": 4},
                {"id": "st-ex-5", "title": "Review mistakes and final concept check", "is_completed": False, "order": 5},
            ],
        },
        {
            "title": "Weekly Coursework Revision",
            "description": "Periodic spaced repetition cycle to stay ahead of semester courses.",
            "category": "revision",
            "priority": "medium",
            "estimated_minutes": 60,
            "subtasks": [
                {"id": "st-rev-1", "title": "Skim notes from this week's lectures", "is_completed": False, "order": 1},
                {"id": "st-rev-2", "title": "Ask AI Tutor to clarify any confusing concepts", "is_completed": False, "order": 2},
                {"id": "st-rev-3", "title": "Attempt practice problems from textbook", "is_completed": False, "order": 3},
            ],
        },
        {
            "title": "Term Project Milestone",
            "description": "Iterative project milestone tracking from design to implementation.",
            "category": "project",
            "priority": "high",
            "estimated_minutes": 240,
            "subtasks": [
                {"id": "st-pr-1", "title": "Define milestone objectives & requirements", "is_completed": False, "order": 1},
                {"id": "st-pr-2", "title": "Draft architectural diagram and data models", "is_completed": False, "order": 2},
                {"id": "st-pr-3", "title": "Implement core functionality & test cases", "is_completed": False, "order": 3},
                {"id": "st-pr-4", "title": "Document progress & commit codebase changes", "is_completed": False, "order": 4},
            ],
        },
    ]

    for tmpl in system_templates:
        op.execute(
            sa.text(
                """
                INSERT INTO task_templates (title, description, category, default_priority, estimated_minutes, subtasks, is_system)
                VALUES (:title, :description, :category, CAST(:priority AS task_priority), :estimated_minutes, CAST(:subtasks AS jsonb), true)
                """
            ).bindparams(
                title=tmpl["title"],
                description=tmpl["description"],
                category=tmpl["category"],
                priority=tmpl["priority"],
                estimated_minutes=tmpl["estimated_minutes"],
                subtasks=json.dumps(tmpl["subtasks"]),
            )
        )


def downgrade() -> None:
    op.drop_table("task_templates")
    op.drop_index("idx_tasks_depends_on", table_name="tasks")
    op.drop_column("tasks", "focus_sessions_count")
    op.drop_column("tasks", "focus_minutes")
    op.drop_column("tasks", "attachments")
    op.drop_column("tasks", "recurrence_end_date")
    op.drop_column("tasks", "recurrence_interval")
    op.drop_column("tasks", "recurrence_pattern")
    op.drop_column("tasks", "depends_on_task_id")

