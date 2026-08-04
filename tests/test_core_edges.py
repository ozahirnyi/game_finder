import asyncio
import os
import subprocess
import sys
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from jose import jwt
from sqlalchemy.exc import OperationalError

from app import auth, cache, crud, database, genre_deals, openai_client, redis_client
from app.database import Game
from app.psn_export import parse_psn_export
from app.schemas import DirectMessageCreate, PriceAlertCreate, PriceAlertUpdate, SocialProfileUpdate


def test_auth_hash_verify_and_invalid_token_paths():
    hashed = auth.hash_password("correct horse")
    assert auth.verify_password("correct horse", hashed)
    assert not auth.verify_password("wrong horse", hashed)
    with pytest.raises(ValueError, match="too long"):
        auth.hash_password("x" * 73)
    with pytest.raises(HTTPException) as exc:
        auth.decode_access_token("not-a-token")
    assert exc.value.status_code == 401
    token = jwt.encode({"sub": str(uuid.uuid4()), "typ": "refresh"}, auth.SECRET_KEY, algorithm=auth.ALGORITHM)
    with pytest.raises(HTTPException, match="Invalid token"):
        auth.decode_access_token(token)


def test_auth_current_user_payload_and_not_found_paths(monkeypatch):
    db = MagicMock()
    monkeypatch.setattr(auth, "decode_access_token", lambda _: {"sub": 12})
    with pytest.raises(HTTPException, match="Invalid token payload"):
        auth.get_current_user("token", db)
    monkeypatch.setattr(auth, "decode_access_token", lambda _: {"sub": "bad-id"})
    with pytest.raises(HTTPException, match="Invalid user id"):
        auth.get_current_user("token", db)
    monkeypatch.setattr(auth, "decode_access_token", lambda _: {"sub": str(uuid.uuid4())})
    monkeypatch.setattr(auth, "get_user_by_id", lambda *_: None)
    with pytest.raises(HTTPException, match="User not found"):
        auth.get_current_user("token", db)


def test_auth_import_requires_secret_key():
    env = os.environ.copy()
    env["SECRET_KEY"] = ""
    result = subprocess.run([sys.executable, "-c", "import app.auth"], env=env, capture_output=True, text=True)
    assert result.returncode != 0
    assert "SECRET_KEY is not set" in result.stderr


def test_cache_hit_miss_and_redis_failure_paths(monkeypatch):
    async def scenario():
        fetch = AsyncMock(return_value={"fresh": True})
        monkeypatch.setattr(cache, "cache_get", AsyncMock(return_value={"cached": True}))
        monkeypatch.setattr(cache, "cache_set", AsyncMock())
        assert await cache.get_json_cached("k", 10, fetch) == {"cached": True}
        fetch.assert_not_awaited()
        get = AsyncMock(return_value=None)
        set_ = AsyncMock()
        monkeypatch.setattr(cache, "cache_get", get)
        monkeypatch.setattr(cache, "cache_set", set_)
        assert await cache.get_json_cached("k", 10, fetch) == {"fresh": True}
        set_.assert_awaited_once_with("k", {"fresh": True}, 10)
        redis_client.redis_client = None
        assert await redis_client.cache_get("k") is None
        await redis_client.cache_set("k", {"x": 1}, 2)
        failing = MagicMock()
        failing.get = AsyncMock(side_effect=RuntimeError("down"))
        failing.setex = AsyncMock(side_effect=RuntimeError("down"))
        redis_client.redis_client = failing
        assert await redis_client.cache_get("k") is None
        await redis_client.cache_set("k", {"x": 1}, 2)
        redis_client.redis_client = None
    asyncio.run(scenario())


def test_crud_update_delete_and_nickname_branches():
    db = MagicMock()
    query = db.query.return_value
    query.filter.return_value.first.return_value = None
    game_id = uuid.uuid4()
    assert crud.update_game(db, game_id, {"title": "x"}, uuid.uuid4()) is None
    assert crud.delete_game(db, game_id, uuid.uuid4()) is False
    game = MagicMock()
    query.filter.return_value.first.return_value = game
    assert crud.update_game(db, game_id, {"title": "new", "notes": "note"}, uuid.uuid4()) is game
    assert game.title == "new"
    assert game.notes == "note"
    query.filter.return_value.first.return_value = None
    assert crud.build_display_name(db, " Weird+Name@example.com ") == "weird-name"
    query.filter.return_value.first.return_value = None
    assert crud.build_public_nickname(db, "ab") == "abplayer"


def test_wait_for_db_retries_then_succeeds(monkeypatch):
    engine = MagicMock()
    connection = engine.connect.return_value
    connection.__enter__.side_effect = [OperationalError("x", {}, None), connection]
    monkeypatch.setattr(database.time, "sleep", MagicMock())
    database.wait_for_db(engine)
    assert engine.connect.call_count == 2


def test_genre_deals_igdb_fallback_and_missing_popular_match():
    async def candidates(_):
        return {"candidates": [{"steam_appid": 1, "name": "Deal", "current": 2}], "popular": [{"steam_appid": 2, "name": "Popular"}]}

    async def igdb(name, _):
        if name == "Deal":
            return {"results": []}
        return {"results": [{"id": 2, "name": "Other", "genres": ["Puzzle"]}]}

    result = asyncio.run(genre_deals.build_genre_deal_groups("UA", [" action ", "ACTION", " ", "RPG"], candidates, igdb))
    assert result["popular"][0]["id"] == 2
    assert len(result["sections"]) == 5


def test_genre_deals_keep_steam_navigation_and_use_steam_genres_when_igdb_is_down():
    async def candidates(_):
        return {
            "candidates": [{"steam_appid": 10, "name": "Steam Deal", "current": {}}],
            "popular": [{"steam_appid": 10, "name": "Steam Deal", "current": {}}],
        }

    async def igdb(_, __):
        raise genre_deals.IGDBError("down")

    async def steam_genres(appids, country):
        assert (appids, country) == ([10], "US")
        return {10: ["Action"]}

    result = asyncio.run(
        genre_deals.build_genre_deal_groups(
            "US", ["Action"], candidates, igdb, steam_genres,
        )
    )

    assert result["popular"][0]["steam_appid"] == 10
    assert result["sections"][0]["results"][0]["steam_appid"] == 10


def test_genre_deals_stop_calling_igdb_after_the_first_outage():
    igdb_calls = 0

    async def candidates(_):
        deals = [
            {"steam_appid": 10, "name": "First", "current": {}},
            {"steam_appid": 20, "name": "Second", "current": {}},
        ]
        return {"candidates": deals, "popular": deals}

    async def igdb(_, __):
        nonlocal igdb_calls
        igdb_calls += 1
        raise genre_deals.IGDBError("timeout")

    async def steam_genres(appids, _country):
        return {appid: ["Action"] for appid in appids}

    result = asyncio.run(
        genre_deals.build_genre_deal_groups("US", ["Action"], candidates, igdb, steam_genres)
    )

    assert igdb_calls == 1
    assert [item["steam_appid"] for item in result["sections"][0]["results"]] == [10, 20]


def test_openai_helpers_and_fallback_paths(monkeypatch):
    monkeypatch.setenv("AI_FALLBACK_ENABLED", "off")
    assert not openai_client.fallback_enabled()
    with pytest.raises(HTTPException) as exc:
        openai_client.fallback_or_raise("x", "bad")
    assert exc.value.status_code == 503
    monkeypatch.setenv("AI_FALLBACK_ENABLED", "yes")
    assert len(openai_client.fallback_or_raise("cozy", "bad")["recommendations"]) == 8
    with pytest.raises(ValueError, match="invalid JSON"):
        openai_client.parse_ai_response("{")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(RuntimeError):
        openai_client.get_client()
    assert "LIKED GAMES" in openai_client.build_prompt("x", [])


def test_openai_recommendation_configuration_and_invalid_response(monkeypatch):
    with pytest.raises(HTTPException, match="cannot be empty"):
        openai_client.get_recommendation("  ", [])
    monkeypatch.setenv("OPENAI_API_KEY", "key")
    monkeypatch.setenv("OPENAI_TIMEOUT_SECONDS", "bad")
    monkeypatch.setattr(openai_client, "get_client", MagicMock(return_value=MagicMock()))
    with pytest.raises(HTTPException, match="must be a number"):
        openai_client.get_recommendation("x", [])
    monkeypatch.setenv("OPENAI_TIMEOUT_SECONDS", "8")
    monkeypatch.setenv("AI_FALLBACK_ENABLED", "off")
    response = MagicMock(output_text="not-json")
    client = MagicMock()
    client.responses.create.return_value = response
    monkeypatch.setattr(openai_client, "get_client", lambda: client)
    with pytest.raises(HTTPException, match="OpenAI response was invalid"):
        openai_client.get_recommendation("x", [])


def test_psn_parser_and_schema_edge_validation():
    with pytest.raises(HTTPException, match="empty"):
        parse_psn_export(b"")
    with pytest.raises(HTTPException, match="Excel"):
        parse_psn_export(b"not-xlsx")
    assert SocialProfileUpdate(nickname="  player_1 ").nickname == "player_1"
    assert DirectMessageCreate(text=" hello ").text == "hello"
    with pytest.raises(ValueError):
        PriceAlertCreate(wishlist_catalog_game_id=1)
    with pytest.raises(ValueError):
        PriceAlertUpdate()
