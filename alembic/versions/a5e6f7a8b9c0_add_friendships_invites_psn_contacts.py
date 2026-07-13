"""add friendships invitations and PSN contacts

Revision ID: a5e6f7a8b9c0
Revises: d4e5f6a7b8c9
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "a5e6f7a8b9c0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    uuid_type = postgresql.UUID(as_uuid=True)
    op.create_table(
        "friendship_requests",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("requester_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recipient_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("requester_id", "recipient_id", name="uq_friendship_request_direction"),
        sa.CheckConstraint("requester_id <> recipient_id", name="ck_friendship_request_not_self"),
        sa.CheckConstraint("status IN ('pending', 'accepted', 'declined', 'cancelled')", name="ck_friendship_request_status"),
    )
    op.create_table(
        "friendships",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("user_low_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_high_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_low_id", "user_high_id", name="uq_friendship_canonical_pair"),
        sa.CheckConstraint("user_low_id < user_high_id", name="ck_friendship_canonical_order"),
    )
    op.create_table(
        "friendship_invites",
        sa.Column("owner_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("token_digest", sa.String(64), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("rotated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "psn_contacts",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("owner_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("online_id", sa.String(16), nullable=False),
        sa.Column("normalized_online_id", sa.String(16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("owner_id", "normalized_online_id", name="uq_psn_contact_owner_normalized_id"),
    )


def downgrade() -> None:
    op.drop_table("psn_contacts")
    op.drop_table("friendship_invites")
    op.drop_table("friendships")
    op.drop_table("friendship_requests")
