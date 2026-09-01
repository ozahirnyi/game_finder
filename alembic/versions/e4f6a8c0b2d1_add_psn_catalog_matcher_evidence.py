"""add PSN catalog matcher evidence

Revision ID: e4f6a8c0b2d1
Revises: d0e1f2a3b4c5
Create Date: 2026-09-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "e4f6a8c0b2d1"
down_revision = "d0e1f2a3b4c5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("games", sa.Column("psn_search_aliases", sa.JSON(), nullable=True))
    op.add_column("games", sa.Column("psn_source_platforms", sa.JSON(), nullable=True))
    op.add_column("games", sa.Column("catalog_lookup_version", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("games", "catalog_lookup_version")
    op.drop_column("games", "psn_source_platforms")
    op.drop_column("games", "psn_search_aliases")
