"""add GameFinder friendships and friend requests

Revision ID: a1c4d6e8f0b2
Revises: c3d4e5f6a7b8
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1c4d6e8f0b2"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "friendships",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_low_id", sa.UUID(), nullable=False),
        sa.Column("user_high_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint("user_low_id < user_high_id", name="ck_friendships_ordered_users"),
        sa.ForeignKeyConstraint(["user_low_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_high_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_low_id", "user_high_id", name="uq_friendships_user_pair"),
    )
    op.create_index("ix_friendships_user_low_id", "friendships", ["user_low_id"], unique=False)
    op.create_index("ix_friendships_user_high_id", "friendships", ["user_high_id"], unique=False)
    op.create_table(
        "friend_requests",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("sender_id", sa.UUID(), nullable=False),
        sa.Column("recipient_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint("status IN ('pending', 'accepted', 'declined')", name="ck_friend_requests_status"),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sender_id", "recipient_id", name="uq_friend_requests_direction"),
    )
    op.create_index("ix_friend_requests_recipient_status", "friend_requests", ["recipient_id", "status"], unique=False)
    op.create_index("ix_friend_requests_sender_status", "friend_requests", ["sender_id", "status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_friend_requests_sender_status", table_name="friend_requests")
    op.drop_index("ix_friend_requests_recipient_status", table_name="friend_requests")
    op.drop_table("friend_requests")
    op.drop_index("ix_friendships_user_high_id", table_name="friendships")
    op.drop_index("ix_friendships_user_low_id", table_name="friendships")
    op.drop_table("friendships")
