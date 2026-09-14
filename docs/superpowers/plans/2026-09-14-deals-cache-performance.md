# Deals Cache Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make cold genre-deals requests efficient by batching IGDB work and sharing country, game, and completed-response cache entries across users.

**Architecture:** Keep country-specific Steam candidate data separate from global IGDB metadata. The endpoint caches completed `country + canonical genres` responses for six hours; a cache miss reuses one-hour Steam candidates and seven-day per-Steam-app IGDB results. IGDB title searches use `multiquery` batches of ten while the client reserves rate-limit slots without holding its lock during network I/O.

**Tech Stack:** Python 3.11, FastAPI, asyncio, httpx, Redis, pytest.

## Global Constraints

- Preserve the `GenreDealResponse` schema and the existing Steam fallback behavior.
- Keep Steam candidates country-specific; never reuse price or availability data across countries.
- Cache successful and explicit empty IGDB search results for seven days, but never cache IGDB transport or timeout failures.
- Respect IGDB's limit of four request starts per second, eight open requests, and ten subqueries per multiquery request.
- Work only on `codex/deals-cache-performance`; do not touch generated `web/.output` files.

---

### Task 1: Batch and safely throttle IGDB title resolution

**Files:**
- Modify: `app/integrations/igdb.py:45-70, 188-215`
- Modify: `tests/test_igdb.py`

**Interfaces:**
- Consumes: `_query(endpoint: str, query: str) -> list[dict[str, Any]]` and `_FIELDS`.
- Produces: `fetch_igdb_games_batch(titles: list[str]) -> dict[str, list[dict[str, Any]]]`, which accepts at most ten distinct titles; and `fetch_igdb_games_batches(titles: list[str]) -> dict[str, list[dict[str, Any]]]`, which accepts any count and issues batches concurrently through the request governor.

- [ ] **Step 1: Write failing batch partitioning tests**

Add tests that monkeypatch `_query`, call `fetch_igdb_games_batches` with eleven unique titles, and assert two `multiquery` statements are made, with ten and one named subqueries respectively. Add a second test asserting duplicate and blank titles do not create extra subqueries.

```python
@pytest.mark.anyio
async def test_igdb_batches_more_than_ten_titles(monkeypatch):
    import app.integrations.igdb as client
    statements = []

    async def query(endpoint, statement):
        statements.append((endpoint, statement))
        return []

    monkeypatch.setattr(client, "_query", query)

    await client.fetch_igdb_games_batches([f"Game {index}" for index in range(11)])

    assert [endpoint for endpoint, _ in statements] == ["multiquery", "multiquery"]
    assert statements[0][1].count('query games "deal_') == 10
    assert statements[1][1].count('query games "deal_') == 1
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `rtk pytest -q tests/test_igdb.py -k "batches_more_than_ten_titles or ignores_duplicate_titles"`

Expected: FAIL because `fetch_igdb_games_batches` does not exist.

- [ ] **Step 3: Implement rate-slot reservation and batched resolver**

Refactor `_query` so `_request_lock` protects only the calculation of delay, sleep, credential acquisition, and `_last_request_at` update; release it before opening `httpx.AsyncClient` and awaiting `post`. Keep current error mapping unchanged.

Add the following public helper adjacent to `fetch_igdb_games_batch`:

```python
async def fetch_igdb_games_batches(titles: list[str]) -> dict[str, list[dict[str, Any]]]:
    unique_titles = list(dict.fromkeys(title.strip() for title in titles if title and title.strip()))
    batches = [unique_titles[offset:offset + 10] for offset in range(0, len(unique_titles), 10)]
    responses = await asyncio.gather(*(fetch_igdb_games_batch(batch) for batch in batches))
    return {
        title: results
        for response in responses
        for title, results in response.items()
    }
```

Rename the multiquery aliases in `fetch_igdb_games_batch` from `psn_{index}` to `deal_{index}` so its output remains purpose-neutral.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `rtk pytest -q tests/test_igdb.py -k "batches_more_than_ten_titles or ignores_duplicate_titles or igdb"`

Expected: PASS.

- [ ] **Step 5: Commit the isolated provider change**

Run:

```text
rtk git add app/integrations/igdb.py tests/test_igdb.py
rtk git commit -m "feat: batch rate-limited IGDB title lookups"
```

### Task 2: Add shared cache-aside helpers for deal sources

**Files:**
- Create: `app/deal_cache.py`
- Modify: `tests/test_genre_deals.py`

**Interfaces:**
- Consumes: `app.cache.build_cache_key`, `cache_get`, `cache_set`, Steam deal dictionaries with `steam_appid` and `name`, and `fetch_igdb_games_batches` from Task 1.
- Produces: `get_cached_steam_deal_candidates(country, fetch_candidates)`, `get_cached_igdb_deal_matches(deals, fetch_batches)`, `canonical_deal_genres(genres)`, and constants `STEAM_DEAL_CANDIDATES_TTL = 3600`, `IGDB_DEAL_MATCH_TTL = 604800`, `GENRE_DEALS_TTL = 21600`.

- [ ] **Step 1: Write failing cache-layer tests**

Create `tests/test_genre_deals.py`. Use fake async Redis `get`/`set` functions and a fake batch resolver. Cover:

```python
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

def test_canonical_deal_genres_is_order_independent():
    assert canonical_deal_genres([" RPG ", "action", "Action"]) == ("action", "rpg")
```

Also test that an IGDB exception leaves no new cache entry, and that two country requests use different Steam-candidate cache keys.

- [ ] **Step 2: Run the cache tests to verify they fail**

Run: `rtk pytest -q tests/test_genre_deals.py`

Expected: FAIL because `app.deal_cache` does not exist.

- [ ] **Step 3: Implement the cache-aside helpers**

In `app/deal_cache.py`, implement canonical genres using a sorted tuple of normalized names. Cache Steam candidates under `steam_deal_candidates_v1` with `country.upper()` and the one-hour TTL.

For IGDB matches, deduplicate deals by positive `steam_appid`, read each `igdb_deal_match_v1` entry, send only cache misses to `fetch_batches`, and write successful responses as `{ "results": [...] }` under the seven-day TTL. Use `asyncio.gather` for independent Redis reads and writes. Let provider exceptions propagate so they are never stored; the caller handles fallback.

- [ ] **Step 4: Run the cache tests to verify they pass**

Run: `rtk pytest -q tests/test_genre_deals.py`

Expected: PASS.

- [ ] **Step 5: Commit the cache layer**

Run:

```text
rtk git add app/deal_cache.py tests/test_genre_deals.py
rtk git commit -m "feat: cache shared deal sources"
```

### Task 3: Build genre groups from cached batches and share completed responses

**Files:**
- Modify: `app/genre_deals.py:46-155`
- Modify: `app/main.py:3886-3914`
- Modify: `tests/test_api_contracts.py:804-974`
- Modify: `tests/test_genre_deals.py`

**Interfaces:**
- Consumes: Task 1 `fetch_igdb_games_batches`, Task 2 cache helpers, `fetch_steam_store_deal_candidates`, `fetch_steam_store_game_genres`, and `get_json_cached`.
- Produces: unchanged `GET /prices/genre-deals` JSON, with a six-hour shared completed-response cache keyed by country and canonical genres.

- [ ] **Step 1: Write failing integration tests for shared response reuse**

Replace the current stable-key assertion with tests that give two different users equivalent genre sets in opposite orders, call the endpoint twice, and assert the same completed-response key and only one Steam candidate fetch. Add a test that changing only country yields different outer and Steam cache keys.

Add a group-builder test with eleven candidate deals and a fake `fetch_igdb_games_batches`; assert it receives all titles in one call, returns the expected popular cards and genre sections, and never calls the legacy single-title resolver.

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `rtk pytest -q tests/test_genre_deals.py tests/test_api_contracts.py -k "genre_deals"`

Expected: FAIL because the group builder still accepts the single-title resolver and the endpoint uses the one-hour v5 key.

- [ ] **Step 3: Implement batch-backed grouping and endpoint composition**

Change `build_genre_deal_groups` to accept a batch resolver returning title-to-results mappings. Build a unique union of candidates and popular deals, resolve the uncached matches once, then preserve the current exact-title-first matching, Steam metadata fallback, Steam genre fallback, popular ordering, and per-section five-item cap.

In `genre_deals`, use `canonical_deal_genres` for both the cache key and grouping order. Replace `steam_genre_deals_v5` with `steam_genre_deals_v6`, pass `GENRE_DEALS_TTL` to `get_json_cached`, and compose the lower layers as follows:

```python
async def fetch():
    candidates = await get_cached_steam_deal_candidates(
        country, fetch_steam_store_deal_candidates,
    )
    return await build_genre_deal_groups(
        country=country,
        favorite_genres=list(canonical_genres),
        candidates=candidates,
        fetch_igdb_matches=get_cached_igdb_deal_matches,
        fetch_igdb_batches=fetch_igdb_games_batches,
        fetch_steam_genres=fetch_steam_store_game_genres,
    )
```

Keep the existing 1.5-second timeout around each IGDB batch request. If a batch fails or times out, return Steam-backed cards and continue with Steam genre fallback; do not write an IGDB failure to Redis.

- [ ] **Step 4: Run focused and regression tests to verify they pass**

Run: `rtk pytest -q tests/test_genre_deals.py tests/test_api_contracts.py -k "genre_deals or igdb"`

Expected: PASS.

- [ ] **Step 5: Commit the endpoint integration**

Run:

```text
rtk git add app/genre_deals.py app/main.py tests/test_api_contracts.py tests/test_genre_deals.py
rtk git commit -m "fix: share cached genre deal results"
```

### Task 4: Verify the complete backend behavior

**Files:**
- Modify: none expected.

**Interfaces:**
- Consumes: all changes from Tasks 1-3.
- Produces: verified feature branch ready for review.

- [ ] **Step 1: Run the backend test suite**

Run: `rtk pytest -q`

Expected: PASS with no failures.

- [ ] **Step 2: Inspect only the feature diff and repository state**

Run:

```text
rtk git diff origin/main -- app/integrations/igdb.py app/deal_cache.py app/genre_deals.py app/main.py tests/test_igdb.py tests/test_genre_deals.py tests/test_api_contracts.py
rtk git status --short
```

Expected: the diff contains only the planned cache and batching work; no generated frontend output is modified.

- [ ] **Step 3: Push and open a pull request**

Run:

```text
rtk git push -u origin codex/deals-cache-performance
rtk gh pr create --base main --head codex/deals-cache-performance --title "Speed up shared genre deals" --body "Batches IGDB title searches and adds shared Steam, IGDB, and completed-response caches for Deals."
```

Expected: remote branch is pushed and GitHub returns the PR URL.
