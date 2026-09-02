from alembic.config import Config
from alembic.script import ScriptDirectory


def test_alembic_has_a_single_upgrade_head():
    script = ScriptDirectory.from_config(Config("alembic.ini"))

    assert script.get_heads() == ["8d31c9f412ab"]
