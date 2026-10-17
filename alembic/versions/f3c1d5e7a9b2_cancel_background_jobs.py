"""Allow cancelled background jobs without losing saved progress."""
from alembic import op
import sqlalchemy as sa

revision = 'f3c1d5e7a9b2'
down_revision = 'f2b0c4d6e8a1'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('background_jobs') as batch:
        batch.drop_constraint('ck_background_jobs_status', type_='check')
        batch.create_check_constraint('ck_background_jobs_status',
                                      "status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')")


def downgrade():
    op.execute(sa.text("UPDATE background_jobs SET status = 'failed' WHERE status = 'cancelled'"))
    with op.batch_alter_table('background_jobs') as batch:
        batch.drop_constraint('ck_background_jobs_status', type_='check')
        batch.create_check_constraint('ck_background_jobs_status',
                                      "status IN ('queued', 'running', 'succeeded', 'failed')")
