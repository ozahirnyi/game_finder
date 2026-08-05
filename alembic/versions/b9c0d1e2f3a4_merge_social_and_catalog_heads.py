"""merge social invitation and IGDB catalog migration heads

Revision ID: b9c0d1e2f3a4
Revises: a7b8c9d0e1f2, f8a9b0c1d2e3
"""

from typing import Sequence, Union


revision: str = "b9c0d1e2f3a4"
down_revision: Union[str, Sequence[str], None] = ("a7b8c9d0e1f2", "f8a9b0c1d2e3")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
