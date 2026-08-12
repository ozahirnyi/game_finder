"""add price alert notification deduplication key

Revision ID: d13a20260813
Revises: b9c0d1e2f3a4
"""

from alembic import op
import sqlalchemy as sa


revision = "d13a20260813"
down_revision = "b9c0d1e2f3a4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("price_alerts", sa.Column("last_notification_key", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("price_alerts", "last_notification_key")
