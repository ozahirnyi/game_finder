import importlib
import os
import uuid
from unittest.mock import MagicMock

import pytest
from sqlalchemy.exc import OperationalError

from app import auth, cache, crud, database, redis_client


def test_password_helpers_use_bcrypt_and_reject_oversized_input():
    hashed = auth.hash_password("correct horse")

    assert hashed.startswith("$2")
    assert auth.verify_password("correct horse", hashed)
    assert not auth.verify_password("wrong horse", hashed)
    with pytest.raises(ValueError, match="Password too long"):
        auth.hash_password("x" * 73)


def test_crud_user_and_game_create_list_helpers():
    db = MagicMock()
    game = MagicMock()
    user = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [game]
    db.query.return_value.filter.return_value.first.return_value = user

    assert crud.list_games(db, uuid.uuid4()) == [game]
    created_game = crud.create_game(db, {"title": "Manual"}, uuid.uuid4())
    assert created_game is db.add.call_args.args[0]
    db.refresh.assert_called_with(created_game)

    db.query.return_value.filter.return_value.first.return_value = None
    created_user = crud.create_user(db, "  USER@Example.COM ", "hash", display_name="Chosen")
    assert created_user.email == "user@example.com"
    assert created_user.display_name == "Chosen"
    assert crud.get_user_by_email(db, " USER@EXAMPLE.COM ") is None


def test_crud_build_display_name_uses_suffix_for_existing_user():
    db = MagicMock()
    first = MagicMock()
    first.id = uuid.uuid4()
    query = db.query.return_value.filter.return_value
    query.first.side_effect = [first, None]

    assert crud.build_display_name(db, "Name@example.com") == "name-2"


def test_wait_for_db_raises_after_all_retries(monkeypatch):
    engine = MagicMock()
    engine.connect.side_effect = OperationalError("down", {}, None)
    monkeypatch.setattr(database.time, "sleep", lambda _: None)

    with pytest.raises(Exception, match="DB not ready after retries"):
        database.wait_for_db(engine)
    assert engine.connect.call_count == 30


def test_redis_disabled_url_and_factory_failure(monkeypatch):
    monkeypatch.setenv("REDIS_URL", "")
    disabled = importlib.reload(redis_client)
    assert disabled.redis_client is None

    factory = MagicMock(side_effect=RuntimeError("invalid URL"))
    monkeypatch.setenv("REDIS_URL", "redis://example.test/0")
    monkeypatch.setattr(redis_client.redis, "from_url", factory)
    failed = importlib.reload(redis_client)
    assert failed.redis_client is None
    factory.assert_called_once_with("redis://example.test/0", decode_responses=True)

    monkeypatch.setenv("REDIS_URL", "")
    importlib.reload(redis_client)


def test_cache_key_is_stable_for_mapping_order_and_non_json_values():
    key_one = cache.build_cache_key("games", b=2, a=1)
    key_two = cache.build_cache_key("games", a=1, b=2)

    assert key_one == key_two
    assert key_one.startswith("games:")
    assert len(key_one.split(":", 1)[1]) == 64
