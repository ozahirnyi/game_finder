"""upgrade deployed social data for public profiles and direct messages

Revision ID: b2c3d4e5f6a7
Revises: f7a8b9c0d1e2
"""
import secrets

from alembic import op
import sqlalchemy as sa


revision = "b2c3d4e5f6a7"
down_revision = "f7a8b9c0d1e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "public_id" not in user_columns:
        op.add_column("users", sa.Column("public_id", sa.String(length=32), nullable=True))
    if "public_nickname" not in user_columns:
        op.add_column("users", sa.Column("public_nickname", sa.String(length=32), nullable=True))

    used_public_ids = set(bind.execute(sa.text("SELECT public_id FROM users WHERE public_id IS NOT NULL")).scalars())
    for user_id in bind.execute(sa.text("SELECT id FROM users WHERE public_id IS NULL")).scalars():
        public_id = secrets.token_urlsafe(12)
        while public_id in used_public_ids:
            public_id = secrets.token_urlsafe(12)
        used_public_ids.add(public_id)
        bind.execute(sa.text("UPDATE users SET public_id = :public_id WHERE id = :user_id"), {"public_id": public_id, "user_id": user_id})
    op.alter_column("users", "public_id", existing_type=sa.String(length=32), nullable=False)

    user_indexes = {index["name"] for index in inspector.get_indexes("users")}
    if "uq_users_public_id" not in user_indexes:
        op.create_index("uq_users_public_id", "users", ["public_id"], unique=True)
    if "uq_users_public_nickname_casefold" not in user_indexes:
        op.create_index(
            "uq_users_public_nickname_casefold",
            "users",
            [sa.text("lower(public_nickname)")],
            unique=True,
            postgresql_where=sa.text("public_nickname IS NOT NULL"),
        )

    tables = set(inspector.get_table_names())
    if "friend_requests" not in tables:
        op.create_table(
            "friend_requests",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("sender_id", sa.UUID(), nullable=False),
            sa.Column("recipient_id", sa.UUID(), nullable=False),
            sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["recipient_id"], ["users.id"], ondelete="CASCADE"),
            sa.CheckConstraint("status IN ('pending', 'accepted', 'declined', 'cancelled')", name="ck_friend_requests_status"),
            sa.PrimaryKeyConstraint("id"),
        )
    else:
        request_columns = {column["name"] for column in inspector.get_columns("friend_requests")}
        if "status" not in request_columns:
            op.add_column("friend_requests", sa.Column("status", sa.String(length=16), nullable=True, server_default="pending"))
            bind.execute(sa.text("UPDATE friend_requests SET status = 'pending' WHERE status IS NULL"))
            op.alter_column("friend_requests", "status", existing_type=sa.String(length=16), nullable=False)
        if "updated_at" not in request_columns:
            op.add_column("friend_requests", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))
            bind.execute(sa.text("UPDATE friend_requests SET updated_at = created_at WHERE updated_at IS NULL"))
            op.alter_column("friend_requests", "updated_at", existing_type=sa.DateTime(timezone=True), nullable=False)

    request_indexes = {index["name"] for index in sa.inspect(bind).get_indexes("friend_requests")}
    if "ix_friend_requests_recipient_status" not in request_indexes:
        op.create_index("ix_friend_requests_recipient_status", "friend_requests", ["recipient_id", "status"])
    if "ix_friend_requests_sender_status" not in request_indexes:
        op.create_index("ix_friend_requests_sender_status", "friend_requests", ["sender_id", "status"])

    if "friendships" not in tables:
        op.create_table(
            "friendships",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("user_low_id", sa.UUID(), nullable=False),
            sa.Column("user_high_id", sa.UUID(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["user_low_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_high_id"], ["users.id"], ondelete="CASCADE"),
            sa.CheckConstraint("user_low_id < user_high_id", name="ck_friendships_canonical_pair"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_low_id", "user_high_id", name="uq_friendships_pair"),
        )

    if "direct_messages" not in tables:
        op.create_table(
            "direct_messages",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("friendship_id", sa.UUID(), nullable=False),
            sa.Column("author_id", sa.UUID(), nullable=False),
            sa.Column("text", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["friendship_id"], ["friendships.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
    message_indexes = {index["name"] for index in sa.inspect(bind).get_indexes("direct_messages")}
    if "ix_direct_messages_friendship_created" not in message_indexes:
        op.create_index("ix_direct_messages_friendship_created", "direct_messages", ["friendship_id", "created_at", "id"])


def downgrade() -> None:
    op.drop_index("ix_direct_messages_friendship_created", table_name="direct_messages")
    op.drop_table("direct_messages")
    op.drop_index("ix_friend_requests_sender_status", table_name="friend_requests")
    op.drop_index("ix_friend_requests_recipient_status", table_name="friend_requests")
    op.drop_index("uq_users_public_nickname_casefold", table_name="users")
    op.drop_index("uq_users_public_id", table_name="users")
    op.drop_column("users", "public_nickname")
    op.drop_column("users", "public_id")
