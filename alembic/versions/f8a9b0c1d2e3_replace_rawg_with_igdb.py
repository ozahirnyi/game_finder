"""replace RAWG catalog records with IGDB cache

Revision ID: f8a9b0c1d2e3
Revises: 2f4d8e1b9c03
Create Date: 2026-08-04 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "f8a9b0c1d2e3"
down_revision = "2f4d8e1b9c03"
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
    # Alerts cascade through their wishlist rows; games are identified only by
    # the explicit legacy provider marker, never by a title heuristic.
    op.execute("DELETE FROM favorites")
    op.execute("DELETE FROM wishlist_items")
    op.execute("DELETE FROM games WHERE source = 'rawg' OR external_id LIKE 'rawg:%'")


def downgrade() -> None:
    op.drop_table("catalog_game_cache")
