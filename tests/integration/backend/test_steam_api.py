from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from app.database import Game


pytestmark = pytest.mark.integration


def linked_user(user_factory, email="steam@example.com"):
    return user_factory(
        email=email,
        steam_id="76561198000000000",
        steam_persona_name="Steam Player",
        steam_avatar="https://avatar.example/steam.jpg",
        steam_country_code="UA",
        steam_linked_at=datetime.now(timezone.utc),
    )


def steam_games():
    return [
        {
            "appid": 10,
            "name": "Portal",
            "playtime_forever": 120,
            "playtime_2weeks": 20,
            "img_icon_url": "portal-icon",
        },
        {
            "appid": 20,
            "name": "Hades",
            "playtime_forever": 60,
            "playtime_2weeks": 0,
            "img_icon_url": None,
        },
    ]


def test_steam_me_returns_unlinked_account(api_client, user_factory, auth_as):
    user = user_factory(email="unlinked@example.com")
    auth_as(user)

    response = api_client.get("/steam/me")

    assert response.status_code == 200
    assert response.json() == {
        "linked": False,
        "steam_id": None,
        "persona_name": None,
        "avatar": None,
        "country_code": None,
        "linked_at": None,
    }


def test_steam_me_returns_linked_account(api_client, user_factory, auth_as):
    user = linked_user(user_factory, "linked@example.com")
    auth_as(user)

    response = api_client.get("/steam/me")

    assert response.status_code == 200
    payload = response.json()
    assert payload["linked"] is True
    assert payload["steam_id"] == user.steam_id
    assert payload["persona_name"] == "Steam Player"


def test_delete_steam_me_clears_account_and_owned_rows(
    api_client, db_session, user_factory, auth_as
):
    user = linked_user(user_factory, "unlink@example.com")
    db_session.add_all(
        [
            Game(owner_id=user.id, title="Steam game", source="steam", external_id="10"),
            Game(owner_id=user.id, title="Manual game", source="manual"),
        ]
    )
    db_session.commit()
    auth_as(user)

    response = api_client.delete("/steam/me")

    assert response.status_code == 200
    db_session.refresh(user)
    assert user.steam_id is None
    assert user.steam_persona_name is None
    assert user.steam_avatar is None
    assert user.steam_country_code is None
    assert user.steam_linked_at is None
    assert db_session.query(Game).filter(Game.owner_id == user.id, Game.source == "steam").count() == 0
    assert db_session.query(Game).filter(Game.owner_id == user.id, Game.source == "manual").count() == 1


def test_steam_library_requires_linked_account(api_client, user_factory, auth_as):
    user = user_factory(email="library-unlinked@example.com")
    auth_as(user)

    response = api_client.get("/steam/library")

    assert response.status_code == 409
    assert response.json()["detail"] == "Connect Steam first"


def test_steam_library_returns_games_from_mocked_boundary(
    api_client, app_main, user_factory, auth_as, monkeypatch
):
    user = linked_user(user_factory, "library@example.com")
    auth_as(user)
    requested = []

    async def fake_fetch(steam_id):
        requested.append(steam_id)
        return steam_games()

    monkeypatch.setattr(app_main, "fetch_owned_games", fake_fetch)

    response = api_client.get("/steam/library")

    assert response.status_code == 200
    assert requested == [user.steam_id]
    assert [game["appid"] for game in response.json()["games"]] == [10, 20]


def test_steam_library_maps_external_http_error(
    api_client, app_main, user_factory, auth_as, monkeypatch
):
    user = linked_user(user_factory, "library-error@example.com")
    auth_as(user)

    async def unavailable(_steam_id):
        raise HTTPException(status_code=503, detail="Steam library unavailable")

    monkeypatch.setattr(app_main, "fetch_owned_games", unavailable)

    response = api_client.get("/steam/library")

    assert response.status_code == 503
    assert response.json()["detail"] == "Steam library unavailable"


def test_steam_library_sync_removes_legacy_imports_and_keeps_response_games(
    api_client, app_main, db_session, user_factory, auth_as, monkeypatch
):
    user = linked_user(user_factory, "sync@example.com")
    db_session.add_all(
        [
            Game(owner_id=user.id, title="Legacy one", source="steam", external_id="10"),
            Game(owner_id=user.id, title="Legacy two", source="steam", external_id="20"),
            Game(owner_id=user.id, title="Keep me", source="manual"),
        ]
    )
    db_session.commit()
    auth_as(user)

    async def fake_fetch(steam_id):
        assert steam_id == user.steam_id
        return steam_games()

    monkeypatch.setattr(app_main, "fetch_owned_games", fake_fetch)

    response = api_client.post("/steam/library/sync")

    assert response.status_code == 200
    assert response.json()["removed"] == 2
    assert response.json()["created"] == 0
    assert [game["appid"] for game in response.json()["games"]] == [10, 20]
    assert db_session.query(Game).filter(Game.owner_id == user.id, Game.source == "steam").count() == 0
    assert db_session.query(Game).filter(Game.owner_id == user.id, Game.source == "manual").count() == 1


def test_steam_social_returns_page_metadata_and_private_friend(
    api_client, app_main, user_factory, auth_as, monkeypatch
):
    user = linked_user(user_factory, "social@example.com")
    friend = user_factory(email="friend@example.com", steam_id="friend-steam")
    auth_as(user)

    async def fake_owned(steam_id):
        if steam_id == user.steam_id:
            return steam_games()
        raise HTTPException(status_code=403, detail="Private library")

    async def fake_friends(steam_id, *, limit, offset):
        assert (steam_id, limit, offset) == (user.steam_id, 1, 2)
        return ([{"steam_id": friend.steam_id, "persona_name": "Friend", "avatar": None}], 5)

    monkeypatch.setattr(app_main, "fetch_owned_games", fake_owned)
    monkeypatch.setattr(app_main, "fetch_steam_friends", fake_friends)

    response = api_client.get("/steam/social?friends_limit=1&friends_offset=2")

    assert response.status_code == 200
    payload = response.json()
    assert payload["friends_total"] == 5
    assert payload["friends_has_more"] is True
    assert payload["private_libraries"] == 1
    assert payload["friends"][0]["library_public"] is False


def test_steam_recommendations_require_linked_account(api_client, user_factory, auth_as):
    user = user_factory(email="recommendations-unlinked@example.com")
    auth_as(user)

    response = api_client.post("/steam/recommendations", json={"prompt": "co-op"})

    assert response.status_code == 409
    assert response.json()["detail"] == "Connect Steam first"


def test_steam_recommendations_use_mocked_library_and_cache(
    api_client, app_main, user_factory, auth_as, monkeypatch
):
    user = linked_user(user_factory, "recommendations@example.com")
    auth_as(user)
    calls = {}

    async def fake_owned(steam_id):
        calls["steam_id"] = steam_id
        return steam_games()

    async def fake_recommendations(user_id, games, prompt):
        calls.update(user_id=user_id, games=games, prompt=prompt)
        return {"recommendations": [{"title": "Celeste", "reason": "Platforming"}]}

    monkeypatch.setattr(app_main, "fetch_owned_games", fake_owned)
    monkeypatch.setattr(app_main, "get_cached_steam_recommendations", fake_recommendations)

    response = api_client.post("/steam/recommendations", json={"prompt": "co-op"})

    assert response.status_code == 200
    assert calls["steam_id"] == user.steam_id
    assert calls["user_id"] == user.id
    assert calls["games"] == steam_games()
    assert calls["prompt"] == "co-op"
    assert response.json()["recommendations"][0]["title"] == "Celeste"
