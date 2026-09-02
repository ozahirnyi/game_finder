import uuid

import pytest

import app.steam_recommendations as recommendations


class User:
    def __init__(self, *, genres=None, platforms=None):
        self.id = uuid.uuid4()
        self.favorite_genres = genres or []
        self.platforms = platforms or []
        self.bio = None


class CatalogItem:
    def __init__(self, catalog_game_id: int, title: str):
        self.catalog_game_id = catalog_game_id
        self.title = title


@pytest.mark.anyio
async def test_personal_recommendations_rank_verified_catalog_games_and_exclude_collections(monkeypatch):
    async def cache_get(_key):
        return None

    async def cache_set(*_args):
        return None

    async def trending(*, page, page_size):
        assert (page, page_size) == (1, 24)
        return {"results": [
            {"id": 1, "name": "Library game", "genres": ["Action"], "platforms": ["PC"]},
            {"id": 2, "name": "Wishlist game", "genres": ["Action"], "platforms": ["PC"]},
            {"id": 3, "name": "Action choice", "background_image": "action-cover", "genres": ["Action"], "platforms": ["PC"]},
            {"id": 4, "name": "Puzzle choice", "genres": ["Puzzle"], "platforms": ["PC"]},
            {"id": 3, "name": "Action choice duplicate", "genres": ["Action"], "platforms": ["PC"]},
            {"id": None, "name": "Unverified", "genres": ["Action"], "platforms": ["PC"]},
        ]}

    async def details(igdb_ids):
        games = {
            1: {"id": 1, "name": "Library game", "genres": ["Action"], "platforms": ["PC"]},
            10: {"id": 10, "name": "Favorite", "genres": ["Action"], "platforms": ["PC"]},
            20: {"id": 20, "name": "Wishlist game", "genres": ["Puzzle"], "platforms": ["PC"]},
        }
        return {igdb_id: games[igdb_id] for igdb_id in igdb_ids}

    monkeypatch.setattr(recommendations, "cache_get", cache_get)
    monkeypatch.setattr(recommendations, "cache_set", cache_set)
    monkeypatch.setattr(recommendations, "fetch_igdb_trending_games", trending)
    monkeypatch.setattr(recommendations, "fetch_igdb_games_by_ids", details)

    result = await recommendations.get_personalized_recommendations(
        User(genres=["Action"], platforms=["PC"]),
        [CatalogItem(1, "Library game")],
        [],
        [CatalogItem(10, "Favorite")],
        [CatalogItem(20, "Wishlist game")],
    )

    assert [item["igdb_id"] for item in result["recommendations"]] == [3, 4]
    assert result["recommendations"][0] == {
        "title": "Action choice",
        "reason": "Matches your favorite genres: Action.",
        "tags": ["Action"],
        "igdb_id": 3,
        "cover_url": "action-cover",
    }


@pytest.mark.anyio
async def test_personal_recommendations_fingerprint_includes_favorites_wishlist_and_steam_playtime(monkeypatch):
    keys = []

    async def cache_get(key):
        keys.append(key)
        return {"recommendations": []}

    monkeypatch.setattr(recommendations, "cache_get", cache_get)
    user = User(genres=["Action"], platforms=["PC"])
    saved = [CatalogItem(1, "Saved")]
    steam = [{"appid": 7, "name": "Steam", "playtime_forever": 12}]

    await recommendations.get_personalized_recommendations(user, saved, steam, [CatalogItem(2, "Favorite")], [CatalogItem(3, "Wishlist")])
    await recommendations.get_personalized_recommendations(user, saved, steam, [CatalogItem(4, "Other favorite")], [CatalogItem(3, "Wishlist")])
    await recommendations.get_personalized_recommendations(user, saved, [{"appid": 7, "name": "Steam", "playtime_forever": 13}], [CatalogItem(4, "Other favorite")], [CatalogItem(3, "Wishlist")])

    assert len(set(keys)) == 3


@pytest.mark.anyio
async def test_personal_recommendations_returns_empty_when_catalog_has_no_verified_candidates(monkeypatch):
    async def cache_get(_key):
        return None

    async def cache_set(*_args):
        return None

    async def trending(*_args, **_kwargs):
        return {"results": [{"id": None, "name": "Unknown"}, {"id": 2, "name": "", "genres": [], "platforms": []}]}

    monkeypatch.setattr(recommendations, "cache_get", cache_get)
    monkeypatch.setattr(recommendations, "cache_set", cache_set)
    monkeypatch.setattr(recommendations, "fetch_igdb_trending_games", trending)

    result = await recommendations.get_personalized_recommendations(User(), [], [])

    assert result["recommendations"] == []


@pytest.mark.anyio
async def test_personal_recommendations_exclude_a_steam_game_by_its_verified_catalog_id(monkeypatch):
    async def cache_get(_key):
        return None

    async def cache_set(*_args):
        return None

    async def trending(*_args, **_kwargs):
        return {"results": [
            {"id": 3, "name": "Canonical catalog title", "genres": ["Action"], "platforms": ["PC"]},
            {"id": 4, "name": "Eligible", "genres": ["Puzzle"], "platforms": ["PC"]},
        ]}

    async def by_steam_appids(appids):
        assert appids == [99]
        return {99: {"id": 3, "name": "Canonical catalog title", "genres": ["Action"], "platforms": ["PC"]}}

    monkeypatch.setattr(recommendations, "cache_get", cache_get)
    monkeypatch.setattr(recommendations, "cache_set", cache_set)
    monkeypatch.setattr(recommendations, "fetch_igdb_trending_games", trending)
    monkeypatch.setattr(recommendations, "fetch_igdb_games_by_steam_appids", by_steam_appids)

    result = await recommendations.get_personalized_recommendations(
        User(), [], [{"appid": 99, "name": "Steam storefront edition", "playtime_forever": 120}],
    )

    assert [item["igdb_id"] for item in result["recommendations"]] == [4]


@pytest.mark.anyio
async def test_personal_recommendations_weight_favorites_more_than_wishlist(monkeypatch):
    async def cache_get(_key): return None
    async def cache_set(*_args): return None
    async def trending(*_args, **_kwargs):
        return {"results": [
            {"id": 3, "name": "Action choice", "genres": ["Action"], "platforms": []},
            {"id": 4, "name": "Puzzle choice", "genres": ["Puzzle"], "platforms": []},
        ]}
    async def details(igdb_ids):
        games = {10: {"id": 10, "name": "Favorite", "genres": ["Action"], "platforms": []}, 20: {"id": 20, "name": "Wishlist", "genres": ["Puzzle"], "platforms": []}}
        return {igdb_id: games[igdb_id] for igdb_id in igdb_ids}

    monkeypatch.setattr(recommendations, "cache_get", cache_get)
    monkeypatch.setattr(recommendations, "cache_set", cache_set)
    monkeypatch.setattr(recommendations, "fetch_igdb_trending_games", trending)
    monkeypatch.setattr(recommendations, "fetch_igdb_games_by_ids", details)

    result = await recommendations.get_personalized_recommendations(User(), [], [], [CatalogItem(10, "Favorite")], [CatalogItem(20, "Wishlist")])

    assert [item["igdb_id"] for item in result["recommendations"]] == [3, 4]


@pytest.mark.anyio
async def test_personal_recommendations_use_steam_playtime_to_break_genre_ties(monkeypatch):
    async def cache_get(_key): return None
    async def cache_set(*_args): return None
    async def trending(*_args, **_kwargs):
        return {"results": [
            {"id": 3, "name": "Action choice", "genres": ["Action"], "platforms": []},
            {"id": 4, "name": "Puzzle choice", "genres": ["Puzzle"], "platforms": []},
        ]}
    async def by_steam_appids(appids):
        games = {1: {"id": 10, "name": "Owned action", "genres": ["Action"], "platforms": []}, 2: {"id": 20, "name": "Owned puzzle", "genres": ["Puzzle"], "platforms": []}}
        return {appid: games[appid] for appid in appids}

    monkeypatch.setattr(recommendations, "cache_get", cache_get)
    monkeypatch.setattr(recommendations, "cache_set", cache_set)
    monkeypatch.setattr(recommendations, "fetch_igdb_trending_games", trending)
    monkeypatch.setattr(recommendations, "fetch_igdb_games_by_steam_appids", by_steam_appids)

    action_first = await recommendations.get_personalized_recommendations(User(), [], [{"appid": 1, "name": "Owned action", "playtime_forever": 600}, {"appid": 2, "name": "Owned puzzle", "playtime_forever": 120}])
    puzzle_first = await recommendations.get_personalized_recommendations(User(), [], [{"appid": 1, "name": "Owned action", "playtime_forever": 120}, {"appid": 2, "name": "Owned puzzle", "playtime_forever": 600}])

    assert [item["igdb_id"] for item in action_first["recommendations"]] == [3, 4]
    assert [item["igdb_id"] for item in puzzle_first["recommendations"]] == [4, 3]


@pytest.mark.anyio
async def test_personal_recommendations_batch_resolve_a_large_steam_library(monkeypatch):
    calls = []

    async def cache_get(_key): return None
    async def cache_set(*_args): return None
    async def trending(*_args, **_kwargs):
        return {"results": [{"id": 3, "name": "Eligible", "genres": ["Action"], "platforms": []}]}
    async def by_steam_appids(appids):
        calls.append(list(appids))
        return {appid: {"id": 100 + appid, "name": f"Owned {appid}", "genres": ["Action"], "platforms": []} for appid in appids}

    monkeypatch.setattr(recommendations, "cache_get", cache_get)
    monkeypatch.setattr(recommendations, "cache_set", cache_set)
    monkeypatch.setattr(recommendations, "fetch_igdb_trending_games", trending)
    monkeypatch.setattr(recommendations, "fetch_igdb_games_by_steam_appids", by_steam_appids)

    steam_games = [{"appid": appid, "name": f"Steam {appid}", "playtime_forever": appid} for appid in range(1, 41)]
    result = await recommendations.get_personalized_recommendations(User(), [], steam_games)

    assert result["recommendations"][0]["igdb_id"] == 3
    assert calls == [list(range(1, 41))]
