import uuid
from types import SimpleNamespace

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


@pytest.fixture(autouse=True)
def stub_catalog_expansion(monkeypatch):
    """Every provider added by candidate expansion stays offline in older tests."""
    async def no_games(*_args, **_kwargs):
        return []

    async def no_identities(*_args, **_kwargs):
        return {}

    monkeypatch.setattr(recommendations, "fetch_recommendation_similar_games", no_identities)
    monkeypatch.setattr(recommendations, "fetch_recommendation_catalog_games", no_games)
    monkeypatch.setattr(recommendations, "fetch_igdb_games_by_ids", no_identities)
    monkeypatch.setattr(recommendations, "fetch_igdb_games_by_steam_appids", no_identities)


def stub_cache_and_trending(monkeypatch, games):
    async def cache_get(_key): return None
    async def cache_set(*_args): return None
    async def trending(*_args, **_kwargs): return {"results": games}
    monkeypatch.setattr(recommendations, "cache_get", cache_get)
    monkeypatch.setattr(recommendations, "cache_set", cache_set)
    monkeypatch.setattr(recommendations, "fetch_igdb_trending_games", trending)


def catalog_game(game_id, name, genre="Action"):
    return {"id": game_id, "name": name, "genres": [genre], "platforms": ["PC"]}


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


@pytest.mark.anyio
async def test_contrasting_libraries_retrieve_taste_candidates_outside_shared_trending(monkeypatch):
    shared = [catalog_game(index, f"Popular {index}", "Adventure") for index in range(1, 7)]
    stub_cache_and_trending(monkeypatch, shared)
    seeds = {10: catalog_game(10, "Owned action"), 20: catalog_game(20, "Owned puzzle", "Puzzle")}

    async def details(ids): return {game_id: seeds[game_id] for game_id in ids}
    async def similar(game_ids, *, limit):
        assert limit <= 6
        return {game_id: [catalog_game(game_id + 100, f"Taste {game_id}", seeds[game_id]["genres"][0])] for game_id in game_ids}
    monkeypatch.setattr(recommendations, "fetch_igdb_games_by_ids", details)
    monkeypatch.setattr(recommendations, "fetch_recommendation_similar_games", similar)

    action = await recommendations.get_personalized_recommendations(User(), [CatalogItem(10, "Owned action")], [])
    puzzle = await recommendations.get_personalized_recommendations(User(), [CatalogItem(20, "Owned puzzle")], [])
    action_ids = [item["igdb_id"] for item in action["recommendations"]]
    puzzle_ids = [item["igdb_id"] for item in puzzle["recommendations"]]
    assert action_ids[0] == 110
    assert puzzle_ids[0] == 120
    assert set(action_ids) != set(puzzle_ids)


@pytest.mark.anyio
async def test_profile_genre_changes_retrieve_new_candidates_and_isolate_owner_cache(monkeypatch):
    stub_cache_and_trending(monkeypatch, [catalog_game(1, "Popular", "Adventure")])
    cache = {}
    reads = []

    async def cache_get(key):
        reads.append(key)
        return cache.get(key)
    async def cache_set(key, value, _ttl): cache[key] = value
    async def related(source, *, limit):
        assert limit <= 12
        genre = source["genres"][0]
        return [catalog_game(100 if genre.casefold() == "action" else 200, f"New {genre}", genre)]
    monkeypatch.setattr(recommendations, "cache_get", cache_get)
    monkeypatch.setattr(recommendations, "cache_set", cache_set)
    monkeypatch.setattr(recommendations, "fetch_recommendation_catalog_games", related)
    user = User(genres=["Action"])
    action = await recommendations.get_personalized_recommendations(user, [], [])
    user.favorite_genres = ["Puzzle"]
    puzzle = await recommendations.get_personalized_recommendations(user, [], [])
    other = User(genres=["Puzzle"])
    await recommendations.get_personalized_recommendations(other, [], [])
    cached = await recommendations.get_personalized_recommendations(user, [], [])

    assert action["recommendations"][0]["igdb_id"] == 100
    assert puzzle["recommendations"][0]["igdb_id"] == 200
    assert cached == puzzle
    assert len(cache) == 3
    assert reads[1] == reads[3]
    assert reads[1] != reads[2]
    assert reads[0].startswith("steam_recommendations:v6:")


@pytest.mark.anyio
async def test_steam_wishlist_uses_provider_identity_and_not_colliding_catalog_number(monkeypatch):
    stub_cache_and_trending(monkeypatch, [catalog_game(730, "Unrelated catalog game", "Puzzle"), catalog_game(50, "Canonical wished game")])
    details_calls = []
    steam_calls = []

    async def details(ids):
        details_calls.extend(ids)
        return {}
    async def steam_details(appids):
        steam_calls.extend(appids)
        return {730: catalog_game(50, "Canonical wished game")}
    async def similar(game_ids, *, limit):
        assert game_ids == [50]
        return {50: [catalog_game(51, "Wishlist taste")]}
    monkeypatch.setattr(recommendations, "fetch_igdb_games_by_ids", details)
    monkeypatch.setattr(recommendations, "fetch_igdb_games_by_steam_appids", steam_details)
    monkeypatch.setattr(recommendations, "fetch_recommendation_similar_games", similar)
    wishlist = [SimpleNamespace(source="steam", external_id="730", catalog_game_id=730, title="Storefront wished title")]

    result = await recommendations.get_personalized_recommendations(User(), [], [], wishlist=wishlist)

    assert [item["igdb_id"] for item in result["recommendations"]] == [51, 730]
    assert details_calls == []
    assert steam_calls == [730]


@pytest.mark.anyio
async def test_similar_candidates_deduplicate_and_never_reintroduce_owned_games(monkeypatch):
    stub_cache_and_trending(monkeypatch, [catalog_game(11, "Eligible")])
    async def details(ids): return {10: catalog_game(10, "Owned")}
    async def similar(*_args, **_kwargs):
        return {10: [catalog_game(10, "Canonical owned"), catalog_game(11, "Eligible"), catalog_game(12, "eligible"), {"id": True, "name": "Invalid boolean ID"}, catalog_game(13, "Extra")]}
    monkeypatch.setattr(recommendations, "fetch_igdb_games_by_ids", details)
    monkeypatch.setattr(recommendations, "fetch_recommendation_similar_games", similar)

    result = await recommendations.get_personalized_recommendations(User(), [CatalogItem(10, "Owned")], [])

    assert {item["igdb_id"] for item in result["recommendations"]} == {11, 13}
    assert len(result["recommendations"]) == 2


@pytest.mark.anyio
async def test_preference_retrieval_is_bounded_and_uses_played_steam_seeds(monkeypatch):
    stub_cache_and_trending(monkeypatch, [])
    seeds = []
    genres = []
    async def steam_details(appids): return {appid: catalog_game(appid + 1000, f"Owned {appid}") for appid in appids}
    async def similar(game_ids, *, limit):
        seeds.extend(game_ids)
        return {game_id: [catalog_game(game_id + 1000, f"Similar {game_id}")] for game_id in game_ids}
    async def related(source, *, limit):
        genres.extend(source["genres"])
        return []
    monkeypatch.setattr(recommendations, "fetch_igdb_games_by_steam_appids", steam_details)
    monkeypatch.setattr(recommendations, "fetch_recommendation_similar_games", similar)
    monkeypatch.setattr(recommendations, "fetch_recommendation_catalog_games", related)
    steam = [{"appid": appid, "name": f"Owned {appid}", "playtime_forever": appid * 120} for appid in range(20)]

    result = await recommendations.get_personalized_recommendations(User(), [], steam)

    assert seeds == [1019, 1018, 1017, 1016]
    assert genres == ["action"]
    assert result["recommendations"][0]["igdb_id"] == 2019


@pytest.mark.anyio
async def test_popular_fallback_survives_unavailable_preference_providers(monkeypatch):
    stub_cache_and_trending(monkeypatch, [catalog_game(1, "Popular")])
    async def unavailable(*_args, **_kwargs): raise RuntimeError("Catalog outage")
    monkeypatch.setattr(recommendations, "fetch_igdb_games_by_ids", unavailable)
    monkeypatch.setattr(recommendations, "fetch_recommendation_catalog_games", unavailable)
    result = await recommendations.get_personalized_recommendations(User(genres=["Action"]), [CatalogItem(10, "Owned")], [])
    assert [item["igdb_id"] for item in result["recommendations"]] == [1]


@pytest.mark.anyio
async def test_steam_wishlist_namespace_and_link_state_changes_invalidate_cache(monkeypatch):
    keys = []
    async def cache_get(key):
        keys.append(key)
        return {"recommendations": []}
    monkeypatch.setattr(recommendations, "cache_get", cache_get)
    item = SimpleNamespace(source="catalog", external_id="igdb:730", catalog_game_id=730, title="Same title", link_state=None)
    user = User()
    await recommendations.get_personalized_recommendations(user, [], [], wishlist=[item])
    item.source, item.external_id = "steam", "730"
    await recommendations.get_personalized_recommendations(user, [], [], wishlist=[item])
    item.link_state = "quarantined"
    await recommendations.get_personalized_recommendations(user, [], [], wishlist=[item])
    assert len(set(keys)) == 3


@pytest.mark.anyio
async def test_candidate_steam_identity_excludes_snapshot_ownership_when_reverse_lookup_fails(monkeypatch):
    candidate = {**catalog_game(50, "Canonical catalog title"), "steam_appid": 730}
    stub_cache_and_trending(monkeypatch, [candidate, catalog_game(730, "Unrelated numeric collision")])
    async def unavailable(*_args, **_kwargs): raise RuntimeError("Reverse lookup unavailable")
    monkeypatch.setattr(recommendations, "fetch_igdb_games_by_steam_appids", unavailable)
    saved = [SimpleNamespace(source="steam", external_id="730", catalog_game_id=None, title="Storefront edition", playtime_forever=600)]

    result = await recommendations.get_personalized_recommendations(User(), saved, [])

    assert [item["igdb_id"] for item in result["recommendations"]] == [730]


@pytest.mark.anyio
async def test_saved_steam_snapshot_expands_candidates_without_live_library(monkeypatch):
    stub_cache_and_trending(monkeypatch, [])
    async def steam_details(appids):
        assert appids == [730]
        return {730: catalog_game(50, "Canonical owned")}
    async def similar(game_ids, *, limit):
        assert game_ids == [50]
        return {50: [catalog_game(51, "Similar to played snapshot")]}
    monkeypatch.setattr(recommendations, "fetch_igdb_games_by_steam_appids", steam_details)
    monkeypatch.setattr(recommendations, "fetch_recommendation_similar_games", similar)
    saved = [SimpleNamespace(source="steam", external_id="730", catalog_game_id=None, title="Storefront edition", playtime_forever=600)]

    result = await recommendations.get_personalized_recommendations(User(), saved, [])

    assert [item["igdb_id"] for item in result["recommendations"]] == [51]


@pytest.mark.anyio
async def test_expansion_keeps_partial_results_when_similar_or_trending_is_unavailable(monkeypatch):
    stub_cache_and_trending(monkeypatch, [])
    async def unavailable(*_args, **_kwargs): raise RuntimeError("Catalog outage")
    async def details(ids): return {10: catalog_game(10, "Owned")}
    async def related(*_args, **_kwargs): return [catalog_game(11, "Related despite outage")]
    monkeypatch.setattr(recommendations, "fetch_igdb_trending_games", unavailable)
    monkeypatch.setattr(recommendations, "fetch_recommendation_similar_games", unavailable)
    monkeypatch.setattr(recommendations, "fetch_igdb_games_by_ids", details)
    monkeypatch.setattr(recommendations, "fetch_recommendation_catalog_games", related)

    result = await recommendations.get_personalized_recommendations(User(), [CatalogItem(10, "Owned")], [])

    assert [item["igdb_id"] for item in result["recommendations"]] == [11]


@pytest.mark.anyio
async def test_no_usable_tastes_skips_expansion_and_keeps_deterministic_popular_fallback(monkeypatch):
    stub_cache_and_trending(monkeypatch, [catalog_game(2, "B popular"), catalog_game(1, "A popular")])
    async def unexpected(*_args, **_kwargs): pytest.fail("No usable taste should retrieve personal candidates")
    monkeypatch.setattr(recommendations, "fetch_recommendation_similar_games", unexpected)
    monkeypatch.setattr(recommendations, "fetch_recommendation_catalog_games", unexpected)
    user = User()
    first = await recommendations.get_personalized_recommendations(user, [], [])
    second = await recommendations.get_personalized_recommendations(user, [], [])

    assert first["recommendations"] == second["recommendations"]
    assert [item["igdb_id"] for item in first["recommendations"]] == [1, 2]


@pytest.mark.anyio
async def test_owned_identity_from_expansion_excludes_an_incomplete_trending_duplicate(monkeypatch):
    stub_cache_and_trending(monkeypatch, [catalog_game(50, "Catalog edition")])
    async def related(*_args, **_kwargs):
        return [{**catalog_game(50, "Catalog edition"), "steam_appid": 730}, catalog_game(51, "Eligible")]
    monkeypatch.setattr(recommendations, "fetch_recommendation_catalog_games", related)

    result = await recommendations.get_personalized_recommendations(
        User(genres=["Action"]), [], [{"appid": 730, "name": "Storefront edition", "playtime_forever": 120}],
    )

    assert [item["igdb_id"] for item in result["recommendations"]] == [51]
