from alembic.config import Config
from alembic.script import ScriptDirectory


def test_alembic_has_a_single_upgrade_head():
    script = ScriptDirectory.from_config(Config("alembic.ini"))

    assert len(script.get_heads()) == 1
