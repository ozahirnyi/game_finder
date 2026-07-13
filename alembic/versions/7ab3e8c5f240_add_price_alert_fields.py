"""add price alert fields

Revision ID: 7ab3e8c5f240
Revises: 2f4d8e1b9c03
Create Date: 2026-07-09 19:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7ab3e8c5f240"
down_revision: Union[str, Sequence[str], None] = "2f4d8e1b9c03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("games")}

    if "price_alert_checked_at" not in columns:
        op.add_column("games", sa.Column("price_alert_checked_at", sa.DateTime(timezone=True), nullable=True))
    if "price_alert_last_at" not in columns:
        op.add_column("games", sa.Column("price_alert_last_at", sa.DateTime(timezone=True), nullable=True))
    if "price_alert_last_key" not in columns:
        op.add_column("games", sa.Column("price_alert_last_key", sa.String(length=255), nullable=True))
    if "price_alert_last_amount" not in columns:
        op.add_column("games", sa.Column("price_alert_last_amount", sa.Float(), nullable=True))
    if "price_alert_last_currency" not in columns:
        op.add_column("games", sa.Column("price_alert_last_currency", sa.String(length=8), nullable=True))
    if "price_alert_last_cut" not in columns:
        op.add_column("games", sa.Column("price_alert_last_cut", sa.Integer(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("games")}

    for column_name in (
        "price_alert_last_cut",
        "price_alert_last_currency",
        "price_alert_last_amount",
        "price_alert_last_key",
        "price_alert_last_at",
        "price_alert_checked_at",
    ):
        if column_name in columns:
            op.drop_column("games", column_name)
