"""Store each user's preferred price country."""

from alembic import op
import sqlalchemy as sa


revision = "bc72e81f4a10"
down_revision = "af42c8d9e510"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("price_country_code", sa.String(length=2), nullable=False, server_default="US"),
    )


def downgrade() -> None:
    op.drop_column("users", "price_country_code")
