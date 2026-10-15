from unittest.mock import AsyncMock

import pytest

pytestmark = pytest.mark.integration


async def run_cached(_key, _ttl, fetch, **_kwargs):
    return await fetch()


@pytest.mark.parametrize("platforms", [("playstation",), ("xbox",), ("playstation", "xbox")])
def test_search_accepts_platform_families(api_client, app_main, monkeypatch, platforms):
    fetch = AsyncMock(return_value={"results": []})
    monkeypatch.setattr(app_main, "fetch_igdb_games", fetch)
    monkeypatch.setattr(app_main, "get_json_cached", run_cached)

    response = api_client.get("/search/games", params=[("platform", value) for value in platforms])

    assert response.status_code == 200
    fetch.assert_awaited_once_with("", page=1, filters=app_main.CatalogSearchFilters(platforms=platforms))


@pytest.mark.parametrize("platforms, expected_ids", [
    (("playstation",), [1, 2]),
    (("xbox",), [3, 4]),
    (("playstation", "xbox"), [1, 2, 3, 4]),
    (("ps4", "xbox_one"), [2, 4]),
    (("switch",), [5]),
])
def test_sale_search_uses_or_within_platforms_and_requires_other_facets(
    api_client, app_main, monkeypatch, platforms, expected_ids
):
    games = [
        {"id": game_id, "name": f"Adventure {game_id}", "platforms": [platform],
         "genres": ["Adventure"], "game_modes": ["Co op"]}
        for game_id, platform in enumerate([
            "PlayStation 5", "PlayStation 4", "Xbox Series X|S", "Xbox One", "Nintendo Switch",
            "PlayStation 5", "PlayStation 5", "PlayStation 5",
        ], start=1)
    ]
    games[5]["genres"] = ["Shooter"]
    games[6]["game_modes"] = ["Single player"]
    deals = [{"steam_appid": game["id"], "name": game["name"],
              "current": {"cut": 0 if game["id"] == 8 else 25}} for game in games]

    async def catalog(title, **_kwargs):
        return {"results": [game for game in games if game["name"] == title]}

    monkeypatch.setattr(app_main, "fetch_steam_store_deals", AsyncMock(return_value=deals))
    monkeypatch.setattr(app_main, "fetch_igdb_games", catalog)
    monkeypatch.setattr(app_main, "get_json_cached", run_cached)

    response = api_client.get("/search/games", params=[
        ("on_sale", "true"), ("genre", "adventure"), ("feature", "co_op"),
        *[("platform", value) for value in platforms],
    ])

    assert response.status_code == 200
    assert [game["id"] for game in response.json()["results"]] == expected_ids
def test_sale_coop_filter_accepts_the_catalogs_actual_mode_label(app_main):
    assert app_main._matches_catalog_filters(
        {"game_modes": ["Co-operative"]},
        app_main.CatalogSearchFilters(features=("co_op",)),
    )
