"""add manual activity and Steam social snapshots

Revision ID: b1c2d3e4f5a6
Revises: a5e6f7a8b9c0
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "b1c2d3e4f5a6"
down_revision = "a5e6f7a8b9c0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    uuid_type = postgresql.UUID(as_uuid=True)
    op.create_table(
        "manual_activities",
        sa.Column("owner_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("current_game", sa.String(255), nullable=True),
        sa.Column("recent_games", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "steam_social_snapshots",
        sa.Column("owner_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("contacts", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("last_error", sa.String(255), nullable=True),
        sa.Column("refreshed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("steam_social_snapshots")
    op.drop_table("manual_activities")
