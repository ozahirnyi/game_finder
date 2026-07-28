# Genre Deals Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/deals` show three discounted Steam bestsellers followed by up to five relevant deals for each of the user's first five favourite genres.

**Architecture:** Preserve `GET /prices/deals` as the flat public API. Add an authenticated `GET /prices/genre-deals` backed by a focused service that collects a bounded Steam candidate pool once, enriches each unique candidate once with RAWG genres, and caches the normalized result by country and selected genres. The TanStack `/deals` route consumes only the new grouped API.

**Tech Stack:** FastAPI, Pydantic v2, SQLAlchemy user profiles, httpx Steam/RAWG integrations, Redis JSON cache, React 19, TanStack Query/Router, Vitest, pytest.

## Global Constraints

- Do not change the dashboard or its `Price drops` block.
- Retain `GET /prices/deals` and `getHomepageDeals` unchanged for existing callers.
- Select at most five non-blank `favorite_genres`; when none are saved use exactly `Action`, `RPG`, `Adventure`, `Strategy`, `Indie`.
- Return exactly one section per selected genre and at most five relevant games per section; do not use unrelated games as fillers.
- Return up to three discounted Steam `top_sellers` as `popular`.
- Cache by uppercase country plus normalized, ordered selected genres.
- Use `apply_patch` for edits; run tests before every commit.

---

### Task 1: Build the Steam/RAWG grouped-deal service and its contract

**Files:**
- Create: `app/genre_deals.py`
- Modify: `app/steam_store.py`
- Modify: `app/integrations/rawg.py`
- Modify: `app/schemas.py:263-274`
- Modify: `app/main.py:19-35,1770-1800`
- Test: `tests/test_api_contracts.py`

**Interfaces:**
- Consumes: `fetch_steam_store_deals(country: str, page_size: int) -> list[dict[str, Any]]`, `fetch_rawg_games(query: str, page: int) -> dict[str, Any]`, `get_json_cached(key, ttl, fetch)`.
- Produces: `build_genre_deal_groups(country: str, favorite_genres: list[str]) -> dict[str, list[dict[str, Any]]]` and `GET /prices/genre-deals` returning `GenreDealResponse(popular, sections)`.

- [ ] **Step 1: Write failing endpoint tests for fallback selection, popular items and accurate grouping**

Add fixtures that provide discounted `top_sellers` and `specials`, RAWG results with `genres`, and an authenticated user whose `favorite_genres` is empty. Assert `GET /prices/genre-deals` returns `popular` with the first three discounted top-seller names, sections ordered `Action`, `RPG`, `Adventure`, `Strategy`, `Indie`, only matching games in each `results`, and empty arrays for unmatched genres. Add a second fixture with six saved genres and assert only the first five are requested. Example assertions:

```python
assert [item["name"] for item in payload["popular"]] == ["Hades", "Baldur's Gate 3", "Stardew Valley"]
assert [section["genre"] for section in payload["sections"]] == ["Action", "RPG", "Adventure", "Strategy", "Indie"]
assert [item["name"] for item in payload["sections"][0]["results"]] == ["Hades"]
assert payload["sections"][3]["results"] == []
```

- [ ] **Step 2: Run the new backend tests and confirm they fail because the endpoint/service does not exist**

Run: `rtk pytest tests/test_api_contracts.py -q -k genre_deals`

Expected: FAIL with a 404 response or missing `GenreDealResponse`/service symbol.

- [ ] **Step 3: Add the candidate, RAWG and Pydantic interfaces**

Keep `fetch_steam_store_deals` unchanged for old callers. Add a separate Steam helper that makes the same featured-categories request but returns `{"popular": [...], "candidates": [...]}`: `popular` is the first three valid discounted game records from `top_sellers`; `candidates` is deduplicated valid discounted games across `top_sellers` and `specials`, capped at 60. Extend each RAWG search record with normalized-source genre labels:

```python
"genres": [genre["name"] for genre in game.get("genres", []) if genre.get("name")]
```

Add schemas:

```python
class GenreDealSection(BaseModel):
    genre: str
    results: list[HomeDealItem] = Field(default_factory=list)

class GenreDealResponse(BaseModel):
    popular: list[HomeDealItem] = Field(default_factory=list)
    sections: list[GenreDealSection] = Field(default_factory=list)
```

- [ ] **Step 4: Implement the minimal grouping service and authenticated endpoint**

In `app/genre_deals.py`, define `DEFAULT_DEAL_GENRES = ("Action", "RPG", "Adventure", "Strategy", "Indie")`, normalize with `value.strip().casefold()`, and select the first five non-blank user values or the default. Enrich each candidate exactly once, matching the first RAWG result with an `id`; preserve Steam imagery/URL/current data and set `id`, `released`, RAWG cover fallback and a normalized genre set. Initialise all selected sections before classifying candidates, append only if the selected normalized genre is in the candidate's RAWG genre set and that section has fewer than five records. Return `popular` from the already enriched candidates and `sections` from the initialized section list.

Add:

```python
@app.get("/prices/genre-deals", response_model=GenreDealResponse)
async def genre_deals(current_user: User = Depends(get_current_user)):
    country = (current_user.steam_country_code or "US").strip().upper()
    genres = select_deal_genres(current_user.favorite_genres)
    key = build_cache_key("steam_genre_deals_v1", country=country, genres=[normalize_genre(g) for g in genres])
    return await get_json_cached(key, CACHE_TTL, lambda: build_genre_deal_groups(country, genres))
```

Import the service and response schema in `app/main.py`. Do not alter `/prices/deals` or `/dashboard`.

- [ ] **Step 5: Run the focused backend tests and confirm they pass**

Run: `rtk pytest tests/test_api_contracts.py -q -k "homepage_deals or genre_deals"`

Expected: PASS; existing flat endpoint assertions still pass and new grouping tests pass.

- [ ] **Step 6: Add tests for five-item caps, RAWG isolation and cache reuse**

Add a test that gives more than five matching Action candidates and asserts exactly five are returned; a RAWG exception for one candidate leaves other matching results intact. Make `get_json_cached` record its key and call the endpoint twice with the same profile/country, asserting equal keys and a `steam_genre_deals_v1` prefix; change the stored genre order and assert a distinct key.

- [ ] **Step 7: Run the complete backend contract test file**

Run: `rtk pytest tests/test_api_contracts.py -q`

Expected: PASS with no contract regressions.

- [ ] **Step 8: Commit the backend feature**

Run:

```text
rtk git add app/genre_deals.py app/steam_store.py app/integrations/rawg.py app/schemas.py app/main.py tests/test_api_contracts.py
rtk git commit -m "feat: add grouped genre deals API"
```

### Task 2: Render popular and genre sections on the TanStack deals route

**Files:**
- Modify: `web/src/lib/api.ts:45-75,550-560`
- Modify: `web/src/lib/lovable-data.ts:24-42`
- Modify: `web/src/routes/deals.tsx`
- Test: `web/src/test/catalog.routes.test.tsx`
- Test: `web/src/features/discovery/lovable-discovery.test.tsx`

**Interfaces:**
- Consumes: `GET /prices/genre-deals` returns `{ popular: HomeDeal[]; sections: Array<{ genre: string; results: HomeDeal[] }> }`.
- Produces: `getGenreDeals(): Promise<GenreDealResponse>` and a `/deals` route that renders popular deals plus selected genre sections.

- [ ] **Step 1: Write a failing route test for grouped deals**

Mock `getGenreDeals` with three `popular` games, an Action section containing an item with `id`, and an empty Strategy section. Render `DealsPage` and assert the “Popular on Steam” heading, game title, price, `-50%`, external store href, `/games/<id>` catalog href, “Action” heading, and “No matching current deals.” under Strategy. Assert `getHomepageDeals` is not called by the route.

- [ ] **Step 2: Run the focused route test and confirm it fails because `getGenreDeals` and grouped UI do not exist**

Run: `rtk proxy npm --prefix web test -- --run web/src/test/catalog.routes.test.tsx`

Expected: FAIL with a missing mocked export or missing heading.

- [ ] **Step 3: Add grouped API types and authenticated client call**

In `web/src/lib/api.ts` add:

```typescript
export type GenreDealSection = { genre: string; results: HomeDeal[] };
export type GenreDealResponse = { popular: HomeDeal[]; sections: GenreDealSection[] };

export function getGenreDeals() {
  return request<GenreDealResponse>("/prices/genre-deals", { auth: true });
}
```

Add `lovableQueryKeys.genreDeals = ["deals", "genre"] as const`, keeping the existing `deals(country)` key and `getHomepageDeals` untouched.

- [ ] **Step 4: Implement the minimal `/deals` page replacement**

Use `getGenreDeals` with `lovableQueryKeys.genreDeals`. Replace hero/flat-list data derivation with `popular` and `sections`. Reuse `DealPrices`, `DealLinks`, `GameCover` and router `Link`; render three compact popular cards, then each `section` with its `genre` heading and either up to five deal cards or this exact copy:

```tsx
<p className="text-sm text-muted-foreground">No matching current deals.</p>
```

Keep retry handling. For a 401, use the project’s protected-state presentation rather than silently calling the flat public endpoint; no route may nest a Steam `<a>` inside a catalog `<Link>`.

- [ ] **Step 5: Run focused frontend tests and confirm they pass**

Run: `rtk proxy npm --prefix web test -- --run web/src/test/catalog.routes.test.tsx web/src/features/discovery/lovable-discovery.test.tsx`

Expected: PASS, including existing deal retry coverage updated to mock `getGenreDeals`.

- [ ] **Step 6: Extend tests for fallback empty page and no catalog id**

Add one test with `popular: []` and five empty sections, asserting all genre headings and no-match copy render. Add a deal with `id: null`, asserting it still has an Open deal Steam link but no catalog-details link.

- [ ] **Step 7: Run the full frontend test suite and production build**

Run:

```text
rtk proxy npm --prefix web test
rtk proxy npm --prefix web run build
```

Expected: both commands exit 0.

- [ ] **Step 8: Commit the deals-page feature**

Run:

```text
rtk git add web/src/lib/api.ts web/src/lib/lovable-data.ts web/src/routes/deals.tsx web/src/test/catalog.routes.test.tsx web/src/features/discovery/lovable-discovery.test.tsx
rtk git commit -m "feat: show genre sections on deals page"
```

### Task 3: Final verification and draft PR

**Files:**
- Verify: all files changed by Tasks 1 and 2

**Interfaces:**
- Consumes: completed backend endpoint, frontend route and test suite.
- Produces: a verified branch and draft PR against `main`; it does not merge or deploy.

- [ ] **Step 1: Re-run backend tests from a clean command**

Run: `rtk pytest -q`

Expected: PASS with zero failures.

- [ ] **Step 2: Re-run the frontend test suite and production build from clean commands**

Run:

```text
rtk proxy npm --prefix web test
rtk proxy npm --prefix web run build
```

Expected: both commands exit 0.

- [ ] **Step 3: Check the final diff and working tree**

Run:

```text
rtk git diff main...HEAD --check
rtk git status --short
```

Expected: no whitespace errors and no unintended untracked or unstaged files.

- [ ] **Step 4: Push and create a draft pull request**

Run:

```text
rtk git push -u origin codex/genre-dashboard-deals
rtk proxy gh pr create --draft --base main --head codex/genre-dashboard-deals --title "feat: group deals by favorite genres" --body "## Summary\n- add cached grouped Steam genre deals\n- feature discounted Steam bestsellers\n- render genre sections on /deals\n\n## Verification\n- rtk pytest -q\n- npm --prefix web test\n- npm --prefix web run build"
```

Expected: push succeeds and GitHub returns a draft PR URL. Do not merge or deploy.
