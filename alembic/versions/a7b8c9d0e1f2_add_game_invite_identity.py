"""add canonical game identity to invitations

Revision ID: a7b8c9d0e1f2
Revises: b2c3d4e5f6a7
"""

from alembic import op
import sqlalchemy as sa

revision = "a7b8c9d0e1f2"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {item["name"] for item in sa.inspect(op.get_bind()).get_columns("game_invites")}
    if "source" not in columns:
        op.add_column("game_invites", sa.Column("source", sa.String(length=32), nullable=True))
    if "external_id" not in columns:
        op.add_column("game_invites", sa.Column("external_id", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("game_invites", "external_id")
    op.drop_column("game_invites", "source")
