"""postgresql_compat

Fix server_default values for PostgreSQL compatibility:
- CURRENT_TIMESTAMP syntax: SQLite (CURRENT_TIMESTAMP) → PostgreSQL now()
- Boolean defaults: SQLite '1' → PostgreSQL 'true'

Revision ID: a3f7c8d2e5b1
Revises: e1bb4c49e1e1
Create Date: 2026-09-24 00:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f7c8d2e5b1'
down_revision: Union[str, Sequence[str]] = 'e1bb4c49e1e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Fix server defaults for PostgreSQL compatibility."""
    # Fix created_at on items: (CURRENT_TIMESTAMP) → now()
    op.alter_column(
        'items', 'created_at',
        server_default=sa.text('now()'),
        existing_type=sa.DateTime(),
        existing_nullable=False,
    )

    # Fix timestamp on feedback_log: (CURRENT_TIMESTAMP) → now()
    op.alter_column(
        'feedback_log', 'timestamp',
        server_default=sa.text('now()'),
        existing_type=sa.DateTime(),
        existing_nullable=False,
    )

    # Fix Boolean defaults: '1' → 'true'
    op.alter_column(
        'routine_blocks', 'fixed',
        server_default=sa.text('true'),
        existing_type=sa.Boolean(),
        existing_nullable=False,
    )

    op.alter_column(
        'schedule_slots', 'auto_generated',
        server_default=sa.text('true'),
        existing_type=sa.Boolean(),
        existing_nullable=False,
    )


def downgrade() -> None:
    """Revert to SQLite-compatible defaults."""
    op.alter_column(
        'items', 'created_at',
        server_default=sa.text('(CURRENT_TIMESTAMP)'),
        existing_type=sa.DateTime(),
        existing_nullable=False,
    )

    op.alter_column(
        'feedback_log', 'timestamp',
        server_default=sa.text('(CURRENT_TIMESTAMP)'),
        existing_type=sa.DateTime(),
        existing_nullable=False,
    )

    op.alter_column(
        'routine_blocks', 'fixed',
        server_default='1',
        existing_type=sa.Boolean(),
        existing_nullable=False,
    )

    op.alter_column(
        'schedule_slots', 'auto_generated',
        server_default='1',
        existing_type=sa.Boolean(),
        existing_nullable=False,
    )

