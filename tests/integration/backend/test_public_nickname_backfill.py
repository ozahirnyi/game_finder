import importlib.util
from pathlib import Path

import pytest

from app.database import User


pytestmark = pytest.mark.integration


def test_backfill_assigns_unique_nicknames_without_changing_existing_ones(
    api_client, db_session, user_factory, monkeypatch
):
    existing = user_factory(email="existing@example.com", display_name="Existing", public_nickname="alex")
    first = user_factory(email="first@example.com", display_name="Alex", public_nickname=None)
    second = user_factory(email="second@example.com", display_name="ALEX", public_nickname=None)
    path = Path(__file__).resolve().parents[3] / "alembic/versions/f1a2b3c4d5e6_backfill_public_nicknames.py"
    spec = importlib.util.spec_from_file_location("public_nickname_backfill", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    monkeypatch.setattr(migration.op, "get_bind", lambda: db_session.connection())

    migration.upgrade()
    db_session.expire_all()

    assert existing.public_nickname == "alex"
    assert {first.public_nickname.lower(), second.public_nickname.lower()} == {"alex_2", "alex_3"}
    for user in (first, second):
        response = api_client.get(f"/users/{user.public_id}")
        assert response.status_code == 200
        assert response.json()["nickname"] == user.public_nickname

    migration.upgrade()
    db_session.expire_all()
    assert {user.public_nickname.lower() for user in (existing, first, second)} == {
        "alex", "alex_2", "alex_3"
    }
