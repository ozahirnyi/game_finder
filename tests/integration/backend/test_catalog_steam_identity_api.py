from unittest.mock import AsyncMock

import pytest

from app.catalog_cache import catalog_steam_appid, get_cached_snapshot, remember_catalog_steam_identities
from app.database import CatalogGameCache, Game
from app.integrations.igdb import IGDBError


pytestmark = pytest.mark.integration


async def run_cached(_key, _ttl, fetch, **_kwargs):
    return await fetch()


@pytest.mark.parametrize("reverse_match", [
    None,
    {"id": 25076, "name": "Red Dead Redemption 2", "steam_appid": 1174180},
])
def test_search_exact_steam_title_survives_stale_catalog_detail_and_blocks_owned_wishlist(
    api_client, app_main, db_session, user_factory, auth_as, monkeypatch, reverse_match
):
    owner = user_factory(email="catalog-steam-owner@example.com")
    other = user_factory(email="catalog-steam-other@example.com")
    db_session.add_all([
        Game(owner_id=owner.id, title="Red Dead Redemption 2", source="steam", external_id="1174180"),
        CatalogGameCache(
            igdb_id=25076,
            snapshot={"id": 25076, "name": "Red Dead Redemption 2", "steam_appid": None, "_catalog_snapshot_format": 3},
            steam_appid=None,
        ),
    ])
    db_session.commit()
    monkeypatch.setattr(app_main, "get_json_cached", run_cached)
    monkeypatch.setattr(app_main, "fetch_igdb_games", AsyncMock(return_value={"results": [
        {"id": 25076, "name": "Red Dead Redemption 2", "steam_appid": None},
    ]}))
    monkeypatch.setattr(app_main, "fetch_steam_store_game_price", AsyncMock(return_value={
        "appid": 1174180,
        "title": "Red Dead Redemption 2",
        "current": {"shop": "Steam", "price": {"amount": 19.99, "currency": "USD"}},
    }))
    verified = AsyncMock(return_value=reverse_match)
    monkeypatch.setattr(app_main, "fetch_igdb_game_by_steam_appid", verified)

    auth_as(owner)
    search = api_client.get("/search/games?q=Red%20Dead%20Redemption%202")
    assert search.status_code == 200
    assert search.json()["results"][0]["steam_appid"] == 1174180
    verified.assert_awaited_once_with(1174180)

    detail = api_client.get("/catalog/games/25076")
    assert detail.status_code == 200
    assert detail.json()["steam_appid"] == 1174180
    membership = api_client.get("/library/membership?catalog_game_id=25076")
    assert membership.json()["owned"] is True
    assert [match["source"] for match in membership.json()["matches"]] == ["steam"]
    assert api_client.post("/wishlist/catalog-games/25076").status_code == 409

    auth_as(other)
    assert api_client.get("/library/membership?catalog_game_id=25076").json()["owned"] is False
    assert api_client.post("/wishlist/catalog-games/25076").status_code == 201


@pytest.mark.parametrize("reverse_match, store_title", [
    (None, "Red Dead Redemption 2: Ultimate Edition"),
    ({"id": 999, "steam_appid": 1174180}, "Red Dead Redemption 2"),
])
def test_search_keeps_title_price_but_does_not_promote_unverified_appid(
    api_client, app_main, monkeypatch, reverse_match, store_title
):
    monkeypatch.setattr(app_main, "get_json_cached", run_cached)
    monkeypatch.setattr(app_main, "fetch_igdb_games", AsyncMock(return_value={"results": [
        {"id": 25076, "name": "Red Dead Redemption 2", "steam_appid": None},
    ]}))
    monkeypatch.setattr(app_main, "fetch_steam_store_game_price", AsyncMock(return_value={
        "appid": 1174180,
        "title": store_title,
        "current": {"shop": "Steam", "price": {"amount": 19.99, "currency": "USD"}},
    }))
    monkeypatch.setattr(app_main, "fetch_igdb_game_by_steam_appid", AsyncMock(return_value=reverse_match))

    response = api_client.get("/search/games?q=Red%20Dead%20Redemption%202")
    assert response.status_code == 200
    result = response.json()["results"][0]
    assert result["steam_appid"] is None
    assert result["current"]["price"]["amount"] == 19.99


def test_catalog_wishlist_rejects_owned_steam_game_from_confirmed_detail_without_search(
    api_client, app_main, db_session, user_factory, auth_as, monkeypatch
):
    owner = user_factory(email="direct-catalog-steam-owner@example.com")
    db_session.add(Game(owner_id=owner.id, title="Red Dead Redemption 2", source="steam", external_id="1174180"))
    db_session.commit()
    auth_as(owner)
    monkeypatch.setattr(app_main, "fetch_igdb_game_detail", AsyncMock(return_value={
        "id": 25076, "name": "Red Dead Redemption 2", "steam_appid": 1174180,
    }))

    assert api_client.post("/wishlist/catalog-games/25076").status_code == 409


def test_verified_identity_cache_preserves_existing_mapping_and_rejects_conflicts(db_session):
    db_session.add_all([
        CatalogGameCache(igdb_id=100, snapshot={"id": 100, "steam_appid": 440}, steam_appid=440),
        CatalogGameCache(igdb_id=200, snapshot={"id": 200}, steam_appid=None),
    ])
    db_session.commit()

    remember_catalog_steam_identities(db_session, [
        {"id": 100, "steam_appid": 440},
        {"id": 200, "steam_appid": 440},
        {"id": 200, "steam_appid": 730},
    ])

    assert catalog_steam_appid(db_session, 100) == 440
    assert catalog_steam_appid(db_session, 200) == 730
    assert db_session.get(CatalogGameCache, 200).snapshot["steam_appid"] == 730


def test_identity_cache_skips_non_sqlalchemy_session():
    class NoSession:
        pass

    remember_catalog_steam_identities(NoSession(), [{"id": 25076, "steam_appid": 1174180}])


@pytest.mark.anyio
async def test_cached_verified_steam_identity_survives_provider_outage_and_refresh(db_session):
    db_session.add(CatalogGameCache(
        igdb_id=25076,
        snapshot={"id": 25076, "name": "Red Dead Redemption 2", "steam_appid": None},
        steam_appid=1174180,
    ))
    db_session.commit()

    async def unavailable(_game_id):
        raise IGDBError("unavailable", status_code=503)

    assert (await get_cached_snapshot(db_session, 25076, unavailable))["steam_appid"] == 1174180

    async def refreshed(_game_id):
        return {"id": 25076, "name": "Red Dead Redemption 2", "steam_appid": None}

    assert (await get_cached_snapshot(db_session, 25076, refreshed))["steam_appid"] == 1174180
