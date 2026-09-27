"""add per-channel Telegram price alert deduplication key

Revision ID: a4b6c8d0e2f4
Revises: c6d8e0f2a4b6
"""

from alembic import op
import sqlalchemy as sa


revision = "a4b6c8d0e2f4"
down_revision = "c6d8e0f2a4b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "price_alerts",
        sa.Column("telegram_last_notification_key", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("price_alerts", "telegram_last_notification_key")
