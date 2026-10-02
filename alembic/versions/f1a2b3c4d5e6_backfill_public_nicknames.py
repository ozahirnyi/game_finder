"""backfill public nicknames for existing users

Revision ID: f1a2b3c4d5e6
Revises: a4b6c8d0e2f4
"""

import re

from alembic import op
import sqlalchemy as sa


revision = "f1a2b3c4d5e6"
down_revision = "a4b6c8d0e2f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    used = {
        nickname.casefold()
        for nickname in bind.execute(
            sa.text("SELECT public_nickname FROM users WHERE public_nickname IS NOT NULL")
        ).scalars()
    }
    missing = bind.execute(
        sa.text("SELECT id, display_name FROM users WHERE public_nickname IS NULL ORDER BY id")
    ).all()
    for user_id, display_name in missing:
        stem = re.sub(r"[^A-Za-z0-9_]+", "_", display_name or "").strip("_")[:32] or "player"
        if len(stem) < 3:
            stem = (stem + "player")[:32]
        candidate, suffix = stem, 2
        while candidate.casefold() in used:
            ending = f"_{suffix}"
            candidate = f"{stem[:32 - len(ending)]}{ending}"
            suffix += 1
        bind.execute(
            sa.text("UPDATE users SET public_nickname = :nickname WHERE id = :user_id"),
            {"nickname": candidate, "user_id": user_id},
        )
        used.add(candidate.casefold())


def downgrade() -> None:
    # Assigned nicknames may have been edited since migration; preserve them.
    pass
