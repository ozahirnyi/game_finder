"""add public profiles and GameFinder social features

Revision ID: e6f7a8b9c0d1
Revises: a1b2c3d4e5f6
Create Date: 2026-07-17 00:00:00.000000
"""

from typing import Sequence, Union
import re

from alembic import op
import sqlalchemy as sa


revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}
    existing_tables = set(inspector.get_table_names())
    if "display_name" not in columns:
        op.add_column("users", sa.Column("display_name", sa.String(length=64), nullable=True))
        used: set[str] = set()
        rows = bind.execute(sa.text("SELECT id, email FROM users WHERE display_name IS NULL")).mappings()
        for row in rows:
            stem = re.sub(r"[^a-z0-9_-]+", "-", (row["email"].split("@", 1)[0]).lower()).strip("-_") or "player"
            candidate = stem[:48]
            suffix = 2
            while candidate in used:
                candidate = f"{stem[:59]}-{suffix}"
                suffix += 1
            used.add(candidate)
            bind.execute(sa.text("UPDATE users SET display_name = :name WHERE id = :id"), {"name": candidate, "id": row["id"]})
        op.alter_column("users", "display_name", nullable=False)
        op.create_unique_constraint("uq_users_display_name", "users", ["display_name"])

    if "friend_requests" not in existing_tables:
        op.create_table(
        "friend_requests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("sender_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recipient_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("message", sa.String(length=280)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("sender_id", "recipient_id", name="uq_friend_request_pair"),
        )
        op.create_index("ix_friend_requests_sender_id", "friend_requests", ["sender_id"])
        op.create_index("ix_friend_requests_recipient_id", "friend_requests", ["recipient_id"])
    if "friendships" not in existing_tables:
        op.create_table(
        "friendships",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_low_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_high_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_low_id", "user_high_id", name="uq_friendship_pair"),
        )
        op.create_index("ix_friendships_user_low_id", "friendships", ["user_low_id"])
        op.create_index("ix_friendships_user_high_id", "friendships", ["user_high_id"])
    if "conversations" not in existing_tables:
        op.create_table(
        "conversations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_low_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_high_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_low_id", "user_high_id", name="uq_conversation_pair"),
        )
        op.create_index("ix_conversations_user_low_id", "conversations", ["user_low_id"])
        op.create_index("ix_conversations_user_high_id", "conversations", ["user_high_id"])
    if "messages" not in existing_tables:
        op.create_table(
        "messages",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("conversation_id", sa.Uuid(), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body", sa.String(length=2000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        )
        op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])
    if "game_invites" not in existing_tables:
        op.create_table(
        "game_invites",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("sender_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recipient_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("game_id", sa.Integer()),
        sa.Column("game_name", sa.String(length=255), nullable=False),
        sa.Column("note", sa.String(length=280)),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True)),
        )
        op.create_index("ix_game_invites_sender_id", "game_invites", ["sender_id"])
        op.create_index("ix_game_invites_recipient_id", "game_invites", ["recipient_id"])
    if "notifications" not in existing_tables:
        op.create_table(
        "notifications",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_notifications_user_id", "notifications", ["user_id"])


def downgrade() -> None:
    for table in ("notifications", "game_invites", "messages", "conversations", "friendships", "friend_requests"):
        op.drop_table(table)
    op.drop_constraint("uq_users_display_name", "users", type_="unique")
    op.drop_column("users", "display_name")
