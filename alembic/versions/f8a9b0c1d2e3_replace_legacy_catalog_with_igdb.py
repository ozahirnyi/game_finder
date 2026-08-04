"""replace legacy catalog records with IGDB cache

Revision ID: f8a9b0c1d2e3
Revises: c8e5f1a2b3d4
Create Date: 2026-08-04 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "f8a9b0c1d2e3"
down_revision = "c8e5f1a2b3d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "catalog_game_cache",
        sa.Column("igdb_id", sa.Integer(), primary_key=True),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("steam_appid", sa.Integer(), nullable=True, unique=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
    )
    # Delete only the retired provider's rows; manually added and Steam rows
    # retain their provider identity. Alerts cascade through wishlist rows.
    op.execute("DELETE FROM wishlist_items WHERE source = 'catalog' AND external_id LIKE 'catalog:%'")
    op.execute("DELETE FROM games WHERE source = ('ra' || 'wg') OR external_id LIKE ('ra' || 'wg:%')")


def downgrade() -> None:
    op.drop_table("catalog_game_cache")
