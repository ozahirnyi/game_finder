"""add PSN catalog identity and repair state

Revision ID: a1b2c3d4e5f6
Revises: f8a9b0c1d2e3
Create Date: 2026-08-29 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = "f8a9b0c1d2e3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("games", sa.Column("catalog_game_id", sa.Integer(), nullable=True))
    op.add_column("games", sa.Column("link_state", sa.String(length=16), nullable=True))
    op.create_index("ix_games_catalog_game_id", "games", ["catalog_game_id"])
    op.execute("UPDATE games SET catalog_game_id = CAST(SUBSTRING(external_id FROM 5) AS INTEGER), link_state = 'linked' WHERE source = 'psn' AND external_id ~ '^psn:[0-9]+$'")
    op.execute("UPDATE games SET link_state = 'raw' WHERE source = 'psn' AND external_id LIKE 'psn:manual:%'")


def downgrade() -> None:
    op.drop_index("ix_games_catalog_game_id", table_name="games")
    op.drop_column("games", "link_state")
    op.drop_column("games", "catalog_game_id")
