"""add retention models

Revision ID: 8c1d9e7f6a02
Revises: 2f4d8e1b9c03
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "8c1d9e7f6a02"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    uuid = postgresql.UUID(as_uuid=True)
    op.create_table("wishlist_items", sa.Column("id", uuid, primary_key=True), sa.Column("user_id", uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("identity_kind", sa.String(16), nullable=False), sa.Column("identity_value", sa.String(64), nullable=False), sa.Column("title", sa.String(255), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("user_id", "identity_kind", "identity_value", name="uq_wishlist_owner_identity"))
    op.create_index("ix_wishlist_items_user_id", "wishlist_items", ["user_id"])
    op.create_table("price_alerts", sa.Column("id", uuid, primary_key=True), sa.Column("user_id", uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("identity_kind", sa.String(16), nullable=False), sa.Column("identity_value", sa.String(64), nullable=False), sa.Column("title", sa.String(255), nullable=False), sa.Column("mode", sa.String(32), nullable=False), sa.Column("threshold", sa.Float(), nullable=True), sa.Column("in_app", sa.Boolean(), nullable=False), sa.Column("telegram", sa.Boolean(), nullable=False), sa.Column("last_deal_key", sa.String(255)), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_price_alerts_user_id", "price_alerts", ["user_id"])
    op.create_index(
        "ix_price_alerts_owner_identity_mode_threshold",
        "price_alerts",
        ["user_id", "identity_kind", "identity_value", "mode", "threshold"],
        unique=True,
        postgresql_where=sa.text("threshold IS NOT NULL"),
    )
    op.create_table("notifications", sa.Column("id", uuid, primary_key=True), sa.Column("user_id", uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("event_type", sa.String(32), nullable=False), sa.Column("target_kind", sa.String(32), nullable=False), sa.Column("game_id", sa.String(64)), sa.Column("saved_game_id", uuid), sa.Column("price_alert_id", uuid, sa.ForeignKey("price_alerts.id", ondelete="SET NULL")), sa.Column("offer_url", sa.String(1000)), sa.Column("read_at", sa.DateTime(timezone=True)), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_price_alerts_owner_identity_mode_threshold", table_name="price_alerts")
    op.drop_table("notifications")
    op.drop_table("price_alerts")
    op.drop_table("wishlist_items")
