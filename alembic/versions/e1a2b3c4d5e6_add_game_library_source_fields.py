"""add external library fields to games

Revision ID: e1a2b3c4d5e6
Revises: 7ab3e8c5f240
"""
from alembic import op
import sqlalchemy as sa


revision = "e1a2b3c4d5e6"
down_revision = "7ab3e8c5f240"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("games")}
    additions = {
        "source": sa.Column("source", sa.String(length=32), nullable=False, server_default="manual"),
        "external_id": sa.Column("external_id", sa.String(length=64), nullable=True),
        "playtime_forever": sa.Column("playtime_forever", sa.Integer(), nullable=True),
        "playtime_2weeks": sa.Column("playtime_2weeks", sa.Integer(), nullable=True),
        "img_icon_url": sa.Column("img_icon_url", sa.String(length=255), nullable=True),
        "synced_at": sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
    }
    for name, column in additions.items():
        if name not in columns:
            op.add_column("games", column)
    indexes = {index["name"] for index in inspector.get_indexes("games")}
    if "ix_games_owner_source_external_id" not in indexes:
        op.create_index(
            "ix_games_owner_source_external_id", "games", ["owner_id", "source", "external_id"],
            unique=True, postgresql_where=sa.text("external_id IS NOT NULL"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {index["name"] for index in inspector.get_indexes("games")}
    if "ix_games_owner_source_external_id" in indexes:
        op.drop_index("ix_games_owner_source_external_id", table_name="games")
    columns = {column["name"] for column in inspector.get_columns("games")}
    for name in ("synced_at", "img_icon_url", "playtime_2weeks", "playtime_forever", "external_id", "source"):
        if name in columns:
            op.drop_column("games", name)
