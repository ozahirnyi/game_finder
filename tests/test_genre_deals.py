import pytest


@pytest.mark.anyio
async def test_cached_igdb_matches_fetches_only_uncached_appids(monkeypatch):
    from app import deal_cache

    stored = {}
    requested_titles = []

    async def get(key):
        return stored.get(key)

    async def set_(key, value, ttl):
        stored[key] = value

    async def fetch_batches(titles):
        requested_titles.extend(titles)
        return {"Second Game": [{"id": 20, "name": "Second Game"}]}

    first = {"steam_appid": 1, "name": "First Game"}
    second = {"steam_appid": 2, "name": "Second Game"}
    stored[deal_cache.igdb_deal_match_key(1)] = {
        "results": [{"id": 10, "name": "First Game"}],
    }
    monkeypatch.setattr(deal_cache, "cache_get", get)
    monkeypatch.setattr(deal_cache, "cache_set", set_)

    matches = await deal_cache.get_cached_igdb_deal_matches(
        [first, second], fetch_batches,
    )

    assert requested_titles == ["Second Game"]
    assert matches[1]["results"][0]["id"] == 10
    assert matches[2]["results"][0]["id"] == 20
    assert stored[deal_cache.igdb_deal_match_key(2)]["results"][0]["id"] == 20


@pytest.mark.anyio
async def test_cached_igdb_matches_caches_explicit_empty_results(monkeypatch):
    from app import deal_cache

    stored = {}

    async def get(key):
        return stored.get(key)

    async def set_(key, value, ttl):
        stored[key] = value

    async def fetch_batches(_titles):
        return {}

    monkeypatch.setattr(deal_cache, "cache_get", get)
    monkeypatch.setattr(deal_cache, "cache_set", set_)

    matches = await deal_cache.get_cached_igdb_deal_matches(
        [{"steam_appid": 1, "name": "No Match"}], fetch_batches,
    )

    assert matches[1] == {"results": []}
    assert stored[deal_cache.igdb_deal_match_key(1)] == {"results": []}


@pytest.mark.anyio
async def test_cached_igdb_matches_does_not_store_provider_errors(monkeypatch):
    from app import deal_cache

    stored = {}

    async def get(key):
        return stored.get(key)

    async def set_(key, value, ttl):
        stored[key] = value

    async def unavailable(_titles):
        raise RuntimeError("offline")

    monkeypatch.setattr(deal_cache, "cache_get", get)
    monkeypatch.setattr(deal_cache, "cache_set", set_)

    with pytest.raises(RuntimeError, match="offline"):
        await deal_cache.get_cached_igdb_deal_matches(
            [{"steam_appid": 1, "name": "Unavailable"}], unavailable,
        )

    assert stored == {}


@pytest.mark.anyio
async def test_cached_steam_candidates_are_scoped_by_country(monkeypatch):
    from app import deal_cache

    stored = {}
    requested_countries = []

    async def get(key):
        return stored.get(key)

    async def set_(key, value, ttl):
        stored[key] = value

    async def fetch(country):
        requested_countries.append(country)
        return {"popular": [], "candidates": []}

    monkeypatch.setattr(deal_cache, "cache_get", get)
    monkeypatch.setattr(deal_cache, "cache_set", set_)

    await deal_cache.get_cached_steam_deal_candidates("us", fetch)
    await deal_cache.get_cached_steam_deal_candidates("CA", fetch)

    assert requested_countries == ["US", "CA"]
    assert deal_cache.steam_deal_candidates_key("US") != deal_cache.steam_deal_candidates_key("CA")


def test_canonical_deal_genres_is_order_independent():
    from app.deal_cache import canonical_deal_genres

    assert canonical_deal_genres([" RPG ", "action", "Action"]) == ("action", "rpg")


@pytest.mark.anyio
async def test_build_genre_deal_groups_resolves_all_candidates_in_one_batch():
    from app.genre_deals import build_genre_deal_groups

    candidates = [
        {"steam_appid": appid, "name": f"Action {appid}", "background_image": None, "url": None, "current": None}
        for appid in range(1, 12)
    ]
    requested_titles = []

    async def fetch_igdb_matches(deals, fetch_batches):
        requested_titles.extend(deal["name"] for deal in deals)
        batches = await fetch_batches(requested_titles)
        return {
            deal["steam_appid"]: {"results": batches[deal["name"]]}
            for deal in deals
        }

    async def fetch_igdb_batches(titles):
        assert titles == [deal["name"] for deal in candidates]
        return {
            title: [{"id": index, "name": title, "genres": ["Action"]}]
            for index, title in enumerate(titles, start=1)
        }

    result = await build_genre_deal_groups(
        country="US",
        favorite_genres=["Action"],
        candidates={"popular": candidates[:2], "candidates": candidates},
        fetch_igdb_matches=fetch_igdb_matches,
        fetch_igdb_batches=fetch_igdb_batches,
    )

    assert requested_titles == [deal["name"] for deal in candidates]
    assert [item["name"] for item in result["popular"]] == ["Action 1", "Action 2"]
    assert len(result["sections"][0]["results"]) == 5
