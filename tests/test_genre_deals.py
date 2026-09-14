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
