"""add steam account fields

Revision ID: 9b214f6c2d6a
Revises: f4b7b884c2d1
Create Date: 2026-07-09 01:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9b214f6c2d6a"
down_revision: Union[str, Sequence[str], None] = "f4b7b884c2d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}
    indexes = {index["name"] for index in inspector.get_indexes("users")}

    if "steam_id" not in columns:
        op.add_column("users", sa.Column("steam_id", sa.String(length=32), nullable=True))
    if "steam_persona_name" not in columns:
        op.add_column("users", sa.Column("steam_persona_name", sa.String(length=255), nullable=True))
    if "steam_avatar" not in columns:
        op.add_column("users", sa.Column("steam_avatar", sa.String(length=500), nullable=True))
    if "steam_linked_at" not in columns:
        op.add_column("users", sa.Column("steam_linked_at", sa.DateTime(timezone=True), nullable=True))
    if "ix_users_steam_id" not in indexes:
        op.create_index("ix_users_steam_id", "users", ["steam_id"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}
    indexes = {index["name"] for index in inspector.get_indexes("users")}

    if "ix_users_steam_id" in indexes:
        op.drop_index("ix_users_steam_id", table_name="users")
    for column_name in ("steam_linked_at", "steam_avatar", "steam_persona_name", "steam_id"):
        if column_name in columns:
            op.drop_column("users", column_name)
