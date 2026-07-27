"""add profile visibility fields

Revision ID: c4d5e6f7a8b9
Revises: b2c3d4e5f6a7
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


VISIBILITY_COLUMNS = (
    "library_visibility",
    "favorites_visibility",
    "wishlist_visibility",
    "steam_visibility",
)


def upgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("users")}
    for column_name in VISIBILITY_COLUMNS:
        if column_name not in columns:
            op.add_column(
                "users",
                sa.Column(
                    column_name,
                    sa.String(length=16),
                    nullable=False,
                    server_default="public",
                ),
            )


def downgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("users")}
    for column_name in reversed(VISIBILITY_COLUMNS):
        if column_name in columns:
            op.drop_column("users", column_name)
