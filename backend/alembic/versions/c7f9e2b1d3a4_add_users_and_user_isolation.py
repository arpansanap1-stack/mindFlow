"""add_users_and_user_isolation

Revision ID: c7f9e2b1d3a4
Revises: a3f7c8d2e5b1
Create Date: 2026-09-24 01:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7f9e2b1d3a4'
down_revision: Union[str, Sequence[str]] = 'a3f7c8d2e5b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Initial admin credentials for migration bootstrap
ADMIN_EMAIL = 'admin@mindflow.local'
ADMIN_PASSWORD_HASH = '$2b$12$g6B4lYkHOnMXOWvA1gzEfuqgHYXnOOve.eY1bsCqrKb1Vpg/qqsnG'


def upgrade() -> None:
    # 1. Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=20), server_default='USER', nullable=False),
        sa.Column('status', sa.String(length=20), server_default='ACTIVE', nullable=False),
        sa.Column('must_change_password', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('last_login', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("role IN ('ADMIN', 'USER')", name='check_user_role'),
        sa.CheckConstraint("status IN ('ACTIVE', 'DISABLED')", name='check_user_status'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_users_id', 'users', ['id'], unique=False)
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    # 2. Insert initial admin user
    op.execute(
        sa.text(
            f"INSERT INTO users (email, password_hash, role, status, must_change_password, created_at, updated_at) "
            f"VALUES ('{ADMIN_EMAIL}', '{ADMIN_PASSWORD_HASH}', 'ADMIN', 'ACTIVE', true, now(), now()) "
            f"ON CONFLICT (email) DO NOTHING;"
        )
    )

    # 3. Add user_id column to existing entities (initially nullable for backfill)
    op.add_column('items', sa.Column('user_id', sa.Integer(), nullable=True))
    op.add_column('routine_blocks', sa.Column('user_id', sa.Integer(), nullable=True))
    op.add_column('schedule_slots', sa.Column('user_id', sa.Integer(), nullable=True))
    op.add_column('feedback_log', sa.Column('user_id', sa.Integer(), nullable=True))

    # 4. Backfill existing records to point to initial admin
    op.execute(
        sa.text(
            "UPDATE items SET user_id = (SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1) WHERE user_id IS NULL;"
        )
    )
    op.execute(
        sa.text(
            "UPDATE routine_blocks SET user_id = (SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1) WHERE user_id IS NULL;"
        )
    )
    op.execute(
        sa.text(
            "UPDATE schedule_slots SET user_id = (SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1) WHERE user_id IS NULL;"
        )
    )
    op.execute(
        sa.text(
            "UPDATE feedback_log SET user_id = (SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1) WHERE user_id IS NULL;"
        )
    )

    # 5. Set user_id columns to NOT NULL
    op.alter_column('items', 'user_id', nullable=False)
    op.alter_column('routine_blocks', 'user_id', nullable=False)
    op.alter_column('schedule_slots', 'user_id', nullable=False)
    op.alter_column('feedback_log', 'user_id', nullable=False)

    # 6. Add Foreign Keys with CASCADE DELETE
    op.create_foreign_key('fk_items_user_id', 'items', 'users', ['user_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_routine_blocks_user_id', 'routine_blocks', 'users', ['user_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_schedule_slots_user_id', 'schedule_slots', 'users', ['user_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_feedback_log_user_id', 'feedback_log', 'users', ['user_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_user_prefs_user_id', 'user_prefs', 'users', ['user_id'], ['id'], ondelete='CASCADE')

    # 7. Add Indexes on foreign keys
    op.create_index('ix_items_user_id', 'items', ['user_id'], unique=False)
    op.create_index('ix_routine_blocks_user_id', 'routine_blocks', ['user_id'], unique=False)
    op.create_index('ix_schedule_slots_user_id', 'schedule_slots', ['user_id'], unique=False)
    op.create_index('ix_feedback_log_user_id', 'feedback_log', ['user_id'], unique=False)


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_feedback_log_user_id', table_name='feedback_log')
    op.drop_index('ix_schedule_slots_user_id', table_name='schedule_slots')
    op.drop_index('ix_routine_blocks_user_id', table_name='routine_blocks')
    op.drop_index('ix_items_user_id', table_name='items')

    # Drop foreign keys
    op.drop_constraint('fk_user_prefs_user_id', 'user_prefs', type_='foreignkey')
    op.drop_constraint('fk_feedback_log_user_id', 'feedback_log', type_='foreignkey')
    op.drop_constraint('fk_schedule_slots_user_id', 'schedule_slots', type_='foreignkey')
    op.drop_constraint('fk_routine_blocks_user_id', 'routine_blocks', type_='foreignkey')
    op.drop_constraint('fk_items_user_id', 'items', type_='foreignkey')

    # Drop columns
    op.drop_column('feedback_log', 'user_id')
    op.drop_column('schedule_slots', 'user_id')
    op.drop_column('routine_blocks', 'user_id')
    op.drop_column('items', 'user_id')

    # Drop users table
    op.drop_index('ix_users_email', table_name='users')
    op.drop_index('ix_users_id', table_name='users')
    op.drop_table('users')

