"""add AI recommendation quotas

Revision ID: 8d31c9f412ab
Revises: c3d4e5f6a7b8
"""
from alembic import op
import sqlalchemy as sa


revision = "8d31c9f412ab"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_recommendation_quotas",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("quota_date", sa.Date(), nullable=False),
        sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "quota_date"),
    )
    op.create_index(
        "ix_ai_recommendation_quotas_user_id",
        "ai_recommendation_quotas",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_ai_recommendation_quotas_user_id",
        table_name="ai_recommendation_quotas",
    )
    op.drop_table("ai_recommendation_quotas")
