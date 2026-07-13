"""add telegram account fields

Revision ID: 2f4d8e1b9c03
Revises: b76f5b9fd30a
Create Date: 2026-07-09 18:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2f4d8e1b9c03"
down_revision: Union[str, Sequence[str], None] = "b76f5b9fd30a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}
    indexes = {index["name"] for index in inspector.get_indexes("users")}

    if "telegram_chat_id" not in columns:
        op.add_column("users", sa.Column("telegram_chat_id", sa.String(length=32), nullable=True))
    if "telegram_username" not in columns:
        op.add_column("users", sa.Column("telegram_username", sa.String(length=255), nullable=True))
    if "telegram_link_token" not in columns:
        op.add_column("users", sa.Column("telegram_link_token", sa.String(length=64), nullable=True))
    if "telegram_linked_at" not in columns:
        op.add_column("users", sa.Column("telegram_linked_at", sa.DateTime(timezone=True), nullable=True))

    if "ix_users_telegram_chat_id" not in indexes:
        op.create_index("ix_users_telegram_chat_id", "users", ["telegram_chat_id"], unique=True)
    if "ix_users_telegram_link_token" not in indexes:
        op.create_index("ix_users_telegram_link_token", "users", ["telegram_link_token"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}
    indexes = {index["name"] for index in inspector.get_indexes("users")}

    if "ix_users_telegram_link_token" in indexes:
        op.drop_index("ix_users_telegram_link_token", table_name="users")
    if "ix_users_telegram_chat_id" in indexes:
        op.drop_index("ix_users_telegram_chat_id", table_name="users")

    for column_name in ("telegram_linked_at", "telegram_link_token", "telegram_username", "telegram_chat_id"):
        if column_name in columns:
            op.drop_column("users", column_name)
