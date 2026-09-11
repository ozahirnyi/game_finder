"""add background job leases

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
"""

from alembic import op
import sqlalchemy as sa


revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("background_jobs"):
        return
    columns = {column["name"] for column in inspector.get_columns("background_jobs")}
    if "lease_token" not in columns:
        op.add_column("background_jobs", sa.Column("lease_token", sa.String(length=36), nullable=True))
    if "lease_expires_at" not in columns:
        op.add_column("background_jobs", sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    pass
