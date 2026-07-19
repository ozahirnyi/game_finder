"""add user profile fields

Revision ID: a1b2c3d4e5f6
Revises: 7ab3e8c5f240, d5e6f7a8b9c0
Create Date: 2026-07-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = ("7ab3e8c5f240", "d5e6f7a8b9c0")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("users")}
    if "bio" not in columns:
        op.add_column("users", sa.Column("bio", sa.String(length=1000), nullable=True))
    if "platforms" not in columns:
        op.add_column("users", sa.Column("platforms", sa.JSON(), nullable=False, server_default="[]"))
    if "favorite_genres" not in columns:
        op.add_column("users", sa.Column("favorite_genres", sa.JSON(), nullable=False, server_default="[]"))


def downgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("users")}
    for column_name in ("favorite_genres", "platforms", "bio"):
        if column_name in columns:
            op.drop_column("users", column_name)
