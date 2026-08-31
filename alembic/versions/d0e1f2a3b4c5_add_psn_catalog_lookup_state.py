"""add PSN catalog lookup state

Revision ID: d0e1f2a3b4c5
Revises: c9d8e7f6a5b4
Create Date: 2026-08-31 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "d0e1f2a3b4c5"
down_revision = "c9d8e7f6a5b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("games", sa.Column("catalog_lookup_state", sa.String(length=16), nullable=True))


def downgrade() -> None:
    op.drop_column("games", "catalog_lookup_state")
