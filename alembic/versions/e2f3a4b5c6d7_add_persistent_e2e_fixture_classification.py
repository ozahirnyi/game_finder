"""add persistent business E2E fixture classification

Revision ID: e2f3a4b5c6d7
Revises: d13a20260813
"""

from alembic import op
import sqlalchemy as sa

revision = "e2f3a4b5c6d7"
down_revision = "d13a20260813"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("e2e_fixture_key", sa.String(length=96), nullable=True))
    op.add_column("users", sa.Column("e2e_fixture_hidden", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_index("ix_users_e2e_fixture_key", "users", ["e2e_fixture_key"])
    op.add_column("games", sa.Column("e2e_fixture_key", sa.String(length=96), nullable=True))
    op.create_index("ix_games_e2e_fixture_key", "games", ["e2e_fixture_key"])
    op.create_table(
        "e2e_fixture_runs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("fixture_key", sa.String(length=96), nullable=False),
        sa.Column("environment", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("actor", sa.String(length=128), nullable=True),
        sa.Column("notes", sa.String(length=1000), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"), sa.UniqueConstraint("fixture_key"),
    )
    op.create_index("ix_e2e_fixture_runs_fixture_key", "e2e_fixture_runs", ["fixture_key"])
    op.create_table(
        "e2e_fixture_members",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("run_id", sa.UUID(), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=False),
        sa.Column("role", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["e2e_fixture_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"), sa.UniqueConstraint("run_id", "entity_type", "entity_id", name="uq_e2e_fixture_member"),
    )
    op.create_index("ix_e2e_fixture_members_run_id", "e2e_fixture_members", ["run_id"])


def downgrade() -> None:
    op.drop_index("ix_e2e_fixture_members_run_id", table_name="e2e_fixture_members")
    op.drop_table("e2e_fixture_members")
    op.drop_index("ix_e2e_fixture_runs_fixture_key", table_name="e2e_fixture_runs")
    op.drop_table("e2e_fixture_runs")
    op.drop_index("ix_games_e2e_fixture_key", table_name="games")
    op.drop_column("games", "e2e_fixture_key")
    op.drop_index("ix_users_e2e_fixture_key", table_name="users")
    op.drop_column("users", "e2e_fixture_hidden")
    op.drop_column("users", "e2e_fixture_key")
