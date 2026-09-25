"""Add AI timezone, richer capture categories, and user-scoped embedding cache.

Revision ID: d4e6f8a0b2c3
Revises: c7f9e2b1d3a4
"""
from alembic import op
import sqlalchemy as sa

revision = "d4e6f8a0b2c3"
down_revision = "c7f9e2b1d3a4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_prefs", sa.Column("timezone", sa.String(length=64), nullable=False, server_default="UTC"))
    op.drop_constraint("check_item_category", "items", type_="check")
    op.create_check_constraint(
        "check_item_category", "items",
        "category IN ('task', 'idea', 'reminder', 'deadline', 'study', 'project_idea', 'question', 'note', 'random_thought')",
    )
    op.create_table(
        "semantic_embeddings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entity_type", sa.String(length=32), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding_json", sa.Text(), nullable=False),
        sa.Column("model", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("entity_type IN ('item')", name="check_embedding_entity_type"),
        sa.UniqueConstraint("user_id", "entity_type", "entity_id", name="uq_semantic_embedding_owner_entity"),
    )
    op.create_index("ix_semantic_embeddings_user_id", "semantic_embeddings", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_semantic_embeddings_user_id", table_name="semantic_embeddings")
    op.drop_table("semantic_embeddings")
    op.drop_constraint("check_item_category", "items", type_="check")
    op.create_check_constraint("check_item_category", "items", "category IN ('task', 'idea', 'reminder', 'deadline')")
    op.drop_column("user_prefs", "timezone")
