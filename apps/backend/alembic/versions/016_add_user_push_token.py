"""add user push token

Revision ID: 016_add_user_push_token
Revises: 015_subject_templates
Create Date: 2026-11-09 15:48:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '016_add_user_push_token'
down_revision: Union[str, None] = '015_subject_templates'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('push_token', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'push_token')

