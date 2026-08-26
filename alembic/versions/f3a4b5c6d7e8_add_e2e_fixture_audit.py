"""add persistent fixture audit events

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
"""

from alembic import op
import sqlalchemy as sa

revision = "f3a4b5c6d7e8"
down_revision = "e2f3a4b5c6d7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "e2e_fixture_audit",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("fixture_key", sa.String(length=96), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("actor", sa.String(length=128), nullable=True),
        sa.Column("dry_run", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_e2e_fixture_audit_fixture_key", "e2e_fixture_audit", ["fixture_key"])


def downgrade() -> None:
    op.drop_index("ix_e2e_fixture_audit_fixture_key", table_name="e2e_fixture_audit")
    op.drop_table("e2e_fixture_audit")
