"""add provider identity to wishlist items

Revision ID: c8e5f1a2b3d4
Revises: c4d5e6f7a8b9
Create Date: 2026-08-04 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c8e5f1a2b3d4"
down_revision: Union[str, Sequence[str], None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("wishlist_items") as batch:
        batch.add_column(sa.Column("source", sa.String(length=16), nullable=True))
        batch.add_column(sa.Column("external_id", sa.String(length=255), nullable=True))
    op.execute("UPDATE wishlist_items SET source = 'catalog', external_id = 'catalog:' || catalog_game_id")
    with op.batch_alter_table("wishlist_items") as batch:
        batch.alter_column("source", nullable=False, existing_type=sa.String(length=16))
        batch.alter_column("external_id", nullable=False, existing_type=sa.String(length=255))
        batch.drop_constraint("uq_wishlist_user_catalog_game", type_="unique")
        batch.create_unique_constraint("uq_wishlist_user_provider_game", ["user_id", "source", "external_id"])


def downgrade() -> None:
    with op.batch_alter_table("wishlist_items") as batch:
        batch.drop_constraint("uq_wishlist_user_provider_game", type_="unique")
        batch.drop_column("external_id")
        batch.drop_column("source")
        batch.create_unique_constraint("uq_wishlist_user_catalog_game", ["user_id", "catalog_game_id"])
