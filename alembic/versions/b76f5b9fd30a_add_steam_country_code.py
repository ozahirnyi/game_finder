"""add steam country code

Revision ID: b76f5b9fd30a
Revises: 9b214f6c2d6a
Create Date: 2026-07-09 05:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b76f5b9fd30a"
down_revision: Union[str, Sequence[str], None] = "9b214f6c2d6a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "steam_country_code" not in columns:
        op.add_column("users", sa.Column("steam_country_code", sa.String(length=2), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "steam_country_code" in columns:
        op.drop_column("users", "steam_country_code")
