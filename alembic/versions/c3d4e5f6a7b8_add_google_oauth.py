"""add Google OAuth identities and authorization transactions

Revision ID: c3d4e5f6a7b8
Revises: b76f5b9fd30a
"""
from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a7b8"
down_revision = "e1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    duplicates = bind.execute(sa.text("SELECT lower(trim(email)) FROM users GROUP BY lower(trim(email)) HAVING count(*) > 1")).fetchone()
    if duplicates:
        raise RuntimeError("Cannot normalize users.email: case-insensitive duplicate emails exist")
    op.execute("UPDATE users SET email = lower(trim(email))")
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=True)
    op.create_table(
        "oauth_identities",
        sa.Column("id", sa.UUID(), nullable=False), sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False), sa.Column("provider_subject", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("linked_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"), sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "provider_subject", name="uq_oauth_identity_provider_subject"),
        sa.UniqueConstraint("user_id", "provider", name="uq_oauth_identity_user_provider"),
    )
    op.create_table(
        "oauth_authorization_transactions",
        sa.Column("state", sa.String(length=128), nullable=False), sa.Column("code_verifier", sa.String(length=128), nullable=False),
        sa.Column("nonce", sa.String(length=128), nullable=False), sa.Column("mode", sa.String(length=16), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True), sa.Column("exchange_code", sa.String(length=128), nullable=True),
        sa.Column("result_user_id", sa.UUID(), nullable=True), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["result_user_id"], ["users.id"], ondelete="CASCADE"), sa.PrimaryKeyConstraint("state"), sa.UniqueConstraint("exchange_code"),
    )


def downgrade() -> None:
    op.drop_table("oauth_authorization_transactions")
    op.drop_table("oauth_identities")
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=False)
