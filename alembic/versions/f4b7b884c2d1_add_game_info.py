"""add game info

Revision ID: f4b7b884c2d1
Revises: dcaae109e56f
Create Date: 2026-07-02 17:38:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f4b7b884c2d1"
down_revision: Union[str, Sequence[str], None] = "dcaae109e56f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("games")}

    if "info" not in columns:
        op.add_column("games", sa.Column("info", sa.String(length=500), nullable=True))

    op.execute(
        """
        UPDATE games
        SET info = notes,
            notes = NULL
        WHERE info IS NULL
          AND (
            notes LIKE 'Released:%'
            OR notes LIKE 'Rating:%'
            OR notes LIKE 'Platforms:%'
          )
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("games")}
    if "info" in columns:
        op.drop_column("games", "info")
