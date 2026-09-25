"""Add typed message kinds and links to game invitations.

Revision ID: c6d8e0f2a4b6
Revises: e5f6a7b8c9d0
"""
from alembic import op
import sqlalchemy as sa


revision = "c6d8e0f2a4b6"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("messages") as batch:
        batch.add_column(sa.Column("kind", sa.String(length=24), nullable=False, server_default="text"))
        batch.add_column(sa.Column("game_invite_id", sa.Uuid(), nullable=True))
        batch.create_foreign_key(
            "fk_messages_game_invite_id_game_invites",
            "game_invites",
            ["game_invite_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch.create_unique_constraint("uq_messages_game_invite_id", ["game_invite_id"])


def downgrade():
    with op.batch_alter_table("messages") as batch:
        batch.drop_constraint("uq_messages_game_invite_id", type_="unique")
        batch.drop_constraint("fk_messages_game_invite_id_game_invites", type_="foreignkey")
        batch.drop_column("game_invite_id")
        batch.drop_column("kind")
