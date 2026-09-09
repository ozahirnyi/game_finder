"""Persist contact policy, Steam import claims and message retry identities.

Revision ID: af42c8d9e510
Revises: 8d31c9f412ab
"""
from alembic import op
import sqlalchemy as sa
import uuid

revision = "af42c8d9e510"
down_revision = "8d31c9f412ab"
branch_labels = None
depends_on = None


def migrate_legacy_messages(connection):
    """Copy legacy history, keeping stable message IDs and existing chat pairs."""
    friendships = sa.table("friendships", sa.column("id", sa.Uuid()),
                           sa.column("user_low_id", sa.Uuid()), sa.column("user_high_id", sa.Uuid()))
    legacy = sa.table("direct_messages", sa.column("id", sa.Uuid()),
                      sa.column("friendship_id", sa.Uuid()), sa.column("author_id", sa.Uuid()),
                      sa.column("text", sa.Text()), sa.column("created_at", sa.DateTime(timezone=True)))
    conversations = sa.table("conversations", sa.column("id", sa.Uuid()),
                             sa.column("user_low_id", sa.Uuid()), sa.column("user_high_id", sa.Uuid()),
                             sa.column("created_at", sa.DateTime(timezone=True)),
                             sa.column("updated_at", sa.DateTime(timezone=True)))
    messages = sa.table("messages", sa.column("id", sa.Uuid()), sa.column("conversation_id", sa.Uuid()),
                        sa.column("sender_id", sa.Uuid()), sa.column("body", sa.String(2000)),
                        sa.column("created_at", sa.DateTime(timezone=True)))
    pairs = connection.execute(sa.select(friendships).where(
        friendships.c.id.in_(sa.select(legacy.c.friendship_id)))).mappings().all()
    for pair in pairs:
        low, high = pair["user_low_id"], pair["user_high_id"]
        condition = sa.and_(conversations.c.user_low_id == low, conversations.c.user_high_id == high)
        conversation_id = connection.execute(sa.select(conversations.c.id).where(condition)).scalar_one_or_none()
        latest = connection.execute(sa.select(sa.func.max(legacy.c.created_at)).where(
            legacy.c.friendship_id == pair["id"])).scalar_one()
        if conversation_id is None:
            earliest = connection.execute(sa.select(sa.func.min(legacy.c.created_at)).where(
                legacy.c.friendship_id == pair["id"])).scalar_one()
            conversation_id = uuid.uuid5(uuid.NAMESPACE_URL, f"playfinder:conversation:{low}:{high}")
            connection.execute(conversations.insert().values(id=conversation_id, user_low_id=low,
                               user_high_id=high, created_at=earliest, updated_at=latest))
        else:
            connection.execute(conversations.update().where(condition, conversations.c.updated_at < latest).values(updated_at=latest))
        missing = sa.select(legacy.c.id, sa.literal(conversation_id, type_=sa.Uuid()), legacy.c.author_id,
                            legacy.c.text, legacy.c.created_at).where(
            legacy.c.friendship_id == pair["id"], ~legacy.c.id.in_(sa.select(messages.c.id)))
        connection.execute(messages.insert().from_select(
            ["id", "conversation_id", "sender_id", "body", "created_at"], missing))


def upgrade():
    op.add_column("users", sa.Column("steam_friends_synced_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table("social_blocks",
        sa.Column("blocker_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("blocked_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("blocker_id != blocked_id", name="ck_social_block_not_self"),
    )
    op.create_table("steam_friend_suppressions",
        sa.Column("user_low_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_high_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("user_low_id < user_high_id", name="ck_steam_suppression_pair"),
    )
    with op.batch_alter_table("messages") as batch:
        batch.add_column(sa.Column("client_message_id", sa.Uuid(), nullable=True))
        batch.create_unique_constraint("uq_message_sender_client", ["sender_id", "client_message_id"])
    op.create_index("ix_messages_conversation_cursor", "messages", ["conversation_id", "created_at", "id"])
    migrate_legacy_messages(op.get_bind())


def downgrade():
    op.drop_index("ix_messages_conversation_cursor", table_name="messages")
    with op.batch_alter_table("messages") as batch:
        batch.drop_constraint("uq_message_sender_client", type_="unique")
        batch.drop_column("client_message_id")
    op.drop_table("steam_friend_suppressions")
    op.drop_table("social_blocks")
    op.drop_column("users", "steam_friends_synced_at")
