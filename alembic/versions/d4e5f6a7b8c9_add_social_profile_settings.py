"""add social profile settings

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
"""
from alembic import context, op
import sqlalchemy as sa


revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


VISIBILITY_COLUMNS = (
    "platforms_visibility",
    "current_game_visibility",
    "recent_games_visibility",
)


def upgrade() -> None:
    if context.is_offline_mode():
        op.add_column("users", sa.Column("public_nickname", sa.String(length=32), nullable=True))
        for name in VISIBILITY_COLUMNS:
            op.add_column(
                "users",
                sa.Column(name, sa.String(length=16), nullable=False, server_default="everyone"),
            )
        op.create_index(
            "uq_users_public_nickname_casefold",
            "users",
            [sa.text("lower(public_nickname)")],
            unique=True,
            postgresql_where=sa.text("public_nickname IS NOT NULL"),
        )
        for name in VISIBILITY_COLUMNS:
            op.create_check_constraint(
                f"ck_users_{name}", "users", f"{name} IN ('everyone', 'friends', 'nobody')"
            )
        return

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "public_nickname" not in columns:
        op.add_column("users", sa.Column("public_nickname", sa.String(length=32), nullable=True))
    for name in VISIBILITY_COLUMNS:
        if name not in columns:
            op.add_column(
                "users",
                sa.Column(name, sa.String(length=16), nullable=False, server_default="everyone"),
            )

    indexes = {index["name"] for index in inspector.get_indexes("users")}
    if "uq_users_public_nickname_casefold" not in indexes:
        op.create_index(
            "uq_users_public_nickname_casefold",
            "users",
            [sa.text("lower(public_nickname)")],
            unique=True,
            postgresql_where=sa.text("public_nickname IS NOT NULL"),
        )

    for name in VISIBILITY_COLUMNS:
        constraint = f"ck_users_{name}"
        existing = {item["name"] for item in inspector.get_check_constraints("users")}
        if constraint not in existing:
            op.create_check_constraint(constraint, "users", f"{name} IN ('everyone', 'friends', 'nobody')")


def downgrade() -> None:
    if context.is_offline_mode():
        for name in VISIBILITY_COLUMNS:
            op.drop_constraint(f"ck_users_{name}", "users", type_="check")
        op.drop_index("uq_users_public_nickname_casefold", table_name="users")
        for name in reversed(VISIBILITY_COLUMNS + ("public_nickname",)):
            op.drop_column("users", name)
        return

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    constraints = {item["name"] for item in inspector.get_check_constraints("users")}
    for name in VISIBILITY_COLUMNS:
        constraint = f"ck_users_{name}"
        if constraint in constraints:
            op.drop_constraint(constraint, "users", type_="check")
    indexes = {index["name"] for index in inspector.get_indexes("users")}
    if "uq_users_public_nickname_casefold" in indexes:
        op.drop_index("uq_users_public_nickname_casefold", table_name="users")
    columns = {column["name"] for column in inspector.get_columns("users")}
    for name in reversed(VISIBILITY_COLUMNS + ("public_nickname",)):
        if name in columns:
            op.drop_column("users", name)
