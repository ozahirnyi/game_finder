"""Bridge the deployed game catalogue revision.

Revision ID: d5e6f7a8b9c0
Revises: c3d4e5f6a7b8

The production database was migrated through this revision before this
branch was created.  The application no longer relies on its catalogue
column, so the bridge intentionally has no schema operation; it restores
the revision graph so later migrations can be applied safely.
"""

from typing import Sequence, Union


revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
