"""Pause alerts when the wishlist game becomes owned.

Revision ID: f2b0c4d6e8a1
Revises: f1a2b3c4d5e6
"""

from alembic import op
import sqlalchemy as sa


revision = "f2b0c4d6e8a1"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("price_alerts", sa.Column("paused_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("price_alerts", sa.Column("pause_reason", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("price_alerts", "pause_reason")
    op.drop_column("price_alerts", "paused_at")
