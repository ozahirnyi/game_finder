"""add durable background jobs

Revision ID: d4e5f6a7b8c9
Revises: bc72e81f4a10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "bc72e81f4a10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # A prior queue-release attempt created this table and then reset Alembic
    # to bc72e81f4a10 during rollback.  Preserve that recovery-safe state.
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("background_jobs"):
        op.create_table(
        "background_jobs",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("owner_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("operation", sa.String(length=64), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="queued"),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("error", sa.String(length=500), nullable=True),
        sa.Column("lease_token", sa.String(length=36), nullable=True),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('queued', 'running', 'succeeded', 'failed')", name="ck_background_jobs_status"),
        )
        op.create_index("ix_background_jobs_owner_status", "background_jobs", ["owner_id", "status"])
        op.execute("CREATE UNIQUE INDEX uq_background_jobs_active_idempotency ON background_jobs (owner_id, operation, idempotency_key) WHERE status IN ('queued', 'running')")
        return
    existing_columns = {column["name"] for column in inspector.get_columns("background_jobs")}
    if "lease_token" not in existing_columns:
        op.add_column("background_jobs", sa.Column("lease_token", sa.String(length=36), nullable=True))
    if "lease_expires_at" not in existing_columns:
        op.add_column("background_jobs", sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_table("background_jobs")
