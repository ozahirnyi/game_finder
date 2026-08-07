"""add social foundation

Revision ID: a1b2c3d4e5f6
Revises: 8c1d9e7f6a02
"""

import secrets

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "a1b2c3d4e5f6"
down_revision = "8c1d9e7f6a02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    uuid = postgresql.UUID(as_uuid=True)
    op.add_column("users", sa.Column("display_name", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("profile_id", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("friend_code", sa.String(64), nullable=True))
    users = op.get_bind().execute(sa.text("SELECT id, steam_persona_name FROM users")).mappings()
    for user in users:
        suffix = secrets.token_urlsafe(4)
        op.get_bind().execute(sa.text("UPDATE users SET display_name=:name, profile_id=:profile, friend_code=:code WHERE id=:id"), {"id": user["id"], "name": (user["steam_persona_name"] or f"Player-{suffix}").strip()[:64], "profile": secrets.token_urlsafe(12), "code": secrets.token_urlsafe(12)})
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("display_name", nullable=False)
        batch_op.alter_column("profile_id", nullable=False)
        batch_op.alter_column("friend_code", nullable=False)
    op.create_index("ix_users_profile_id", "users", ["profile_id"], unique=True)
    op.create_index("ix_users_friend_code", "users", ["friend_code"], unique=True)
    op.create_index("ix_users_display_name_lower", "users", [sa.text("lower(display_name)")])
    op.create_table("friend_requests", sa.Column("id", uuid, primary_key=True), sa.Column("sender_id", uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("recipient_id", uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("status", sa.String(16), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("sender_id", "recipient_id", name="uq_friend_request_direction"))
    op.create_index("ix_friend_requests_sender_id", "friend_requests", ["sender_id"])
    op.create_index("ix_friend_requests_recipient_id", "friend_requests", ["recipient_id"])
    op.create_table("friendships", sa.Column("id", uuid, primary_key=True), sa.Column("user_low_id", uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("user_high_id", uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("user_low_id", "user_high_id", name="uq_friendship_pair"))
    op.create_table("direct_messages", sa.Column("id", uuid, primary_key=True), sa.Column("friendship_id", uuid, sa.ForeignKey("friendships.id", ondelete="CASCADE"), nullable=False), sa.Column("author_id", uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("text", sa.String(2000), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_table("game_invites", sa.Column("id", uuid, primary_key=True), sa.Column("friendship_id", uuid, sa.ForeignKey("friendships.id", ondelete="CASCADE"), nullable=False), sa.Column("sender_id", uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("recipient_id", uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("game_id", sa.String(64), nullable=False), sa.Column("game_title", sa.String(255), nullable=False), sa.Column("status", sa.String(16), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False))
    with op.batch_alter_table("notifications") as batch_op:
        for name, column, target in (("friend_request_id", "friend_request_id", "friend_requests"), ("friendship_id", "friendship_id", "friendships"), ("direct_message_id", "direct_message_id", "direct_messages"), ("game_invite_id", "game_invite_id", "game_invites")):
            batch_op.add_column(sa.Column(column, uuid, nullable=True))
            batch_op.create_foreign_key(f"fk_notifications_{name}", target, [column], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    with op.batch_alter_table("notifications") as batch_op:
        for name in ("game_invite_id", "direct_message_id", "friendship_id", "friend_request_id"):
            batch_op.drop_constraint(f"fk_notifications_{name}", type_="foreignkey")
            batch_op.drop_column(name)
    op.drop_table("game_invites")
    op.drop_table("direct_messages")
    op.drop_table("friendships")
    op.drop_table("friend_requests")
    op.drop_index("ix_users_display_name_lower", table_name="users")
    op.drop_index("ix_users_friend_code", table_name="users")
    op.drop_index("ix_users_profile_id", table_name="users")
    op.drop_column("users", "friend_code")
    op.drop_column("users", "profile_id")
    op.drop_column("users", "display_name")
