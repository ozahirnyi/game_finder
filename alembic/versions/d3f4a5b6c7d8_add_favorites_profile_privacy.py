"""add favorites and profile privacy

Revision ID: d3f4a5b6c7d8
Revises: a1b2c3d4e5f6
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "d3f4a5b6c7d8"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    uuid = postgresql.UUID(as_uuid=True)
    op.create_table("favorite_items", sa.Column("id", uuid, primary_key=True), sa.Column("user_id", uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("identity_kind", sa.String(16), nullable=False), sa.Column("identity_value", sa.String(64), nullable=False), sa.Column("title", sa.String(255), nullable=False), sa.Column("cover_url", sa.String(1000)), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("user_id", "identity_kind", "identity_value", name="uq_favorite_owner_identity"))
    op.create_index("ix_favorite_items_user_id", "favorite_items", ["user_id"])
    for name in ("library_visibility", "favorites_visibility", "wishlist_visibility", "steam_visibility"):
        op.add_column("users", sa.Column(name, sa.String(16), nullable=False, server_default="public"))


def downgrade() -> None:
    for name in ("steam_visibility", "wishlist_visibility", "favorites_visibility", "library_visibility"):
        op.drop_column("users", name)
    op.drop_index("ix_favorite_items_user_id", table_name="favorite_items")
    op.drop_table("favorite_items")
