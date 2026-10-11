import pytest
from fastapi import HTTPException

from app.database import Game


pytestmark = pytest.mark.integration


def test_membership_matches_provider_identity_without_leaking_other_users(
    api_client, db_session, user_factory, auth_as
):
    owner = user_factory(email="membership-owner@example.com")
    other = user_factory(email="membership-other@example.com")
    db_session.add_all(
        [
            Game(owner_id=owner.id, title="Counter-Strike 2", source="steam", external_id="730"),
            Game(
                owner_id=owner.id,
                title="Counter-Strike 2",
                source="psn",
                external_id="psn-cs2",
                catalog_game_id=242408,
                link_state="linked",
            ),
            Game(
                owner_id=owner.id,
                title="Counter-Strike 2",
                source="psn",
                external_id="psn-raw",
                link_state="raw",
            ),
        ]
    )
    db_session.commit()

    auth_as(owner)
    by_steam = api_client.get("/library/membership?steam_appid=730")
    assert by_steam.status_code == 200
    assert by_steam.json()["owned"] is True
    assert [match["source"] for match in by_steam.json()["matches"]] == ["steam"]

    by_catalog = api_client.get("/library/membership?catalog_game_id=242408")
    assert by_catalog.status_code == 200
    assert [match["source"] for match in by_catalog.json()["matches"]] == ["psn"]

    numeric_collision = api_client.get("/library/membership?catalog_game_id=730")
    assert numeric_collision.status_code == 200
    assert numeric_collision.json() == {"owned": False, "matches": []}

    auth_as(other)
    hidden = api_client.get("/library/membership?steam_appid=730&catalog_game_id=242408")
    assert hidden.status_code == 200
    assert hidden.json() == {"owned": False, "matches": []}


def test_membership_rejects_missing_or_invalid_identity(api_client, user_factory, auth_as):
    auth_as(user_factory(email="membership-invalid@example.com"))
    assert api_client.get("/library/membership").status_code == 422
    assert api_client.get("/library/membership?steam_appid=0").status_code == 422


def test_membership_matches_catalog_and_manual_library_games(
    api_client, db_session, user_factory, auth_as
):
    owner = user_factory(email="membership-saved@example.com")
    db_session.add_all(
        [
            Game(
                owner_id=owner.id,
                title="Catalog game",
                source="catalog",
                external_id="igdb:123",
                catalog_game_id=123,
            ),
            Game(
                owner_id=owner.id,
                title="Manual game",
                source="manual",
                catalog_game_id=456,
            ),
        ]
    )
    db_session.commit()
    auth_as(owner)

    catalog = api_client.get("/library/membership?catalog_game_id=123")
    assert catalog.status_code == 200
    assert [match["source"] for match in catalog.json()["matches"]] == ["catalog"]

    manual = api_client.get("/library/membership?catalog_game_id=456")
    assert manual.status_code == 200
    assert [match["source"] for match in manual.json()["matches"]] == ["manual"]


def test_membership_includes_live_steam_library_games(
    api_client, db_session, user_factory, auth_as, monkeypatch
):
    owner = user_factory(email="membership-live-steam@example.com")
    owner.steam_id = "76561198000000001"
    db_session.commit()
    calls = []

    async def owned_games(steam_id):
        calls.append(steam_id)
        return [{"appid": 730, "name": "Counter-Strike 2"}]

    monkeypatch.setattr("app.main.fetch_owned_games", owned_games)
    auth_as(owner)

    owned = api_client.get("/library/membership?catalog_game_id=242408&steam_appid=730")
    assert owned.status_code == 200
    assert owned.json() == {
        "owned": True,
        "matches": [{"id": "steam:730", "source": "steam"}],
    }
    assert calls == [owner.steam_id]

    absent = api_client.get("/library/membership?steam_appid=440")
    assert absent.status_code == 200
    assert absent.json() == {"owned": False, "matches": []}


def test_membership_fails_closed_when_connected_steam_library_is_unavailable(
    api_client, db_session, user_factory, auth_as, monkeypatch
):
    owner = user_factory(email="membership-live-unavailable@example.com")
    owner.steam_id = "76561198000000002"
    db_session.commit()

    async def unavailable(_steam_id):
        raise HTTPException(status_code=502, detail="Steam library request failed")

    monkeypatch.setattr("app.main.fetch_owned_games", unavailable)
    auth_as(owner)
    response = api_client.get("/library/membership?steam_appid=730")
    assert response.status_code == 502
