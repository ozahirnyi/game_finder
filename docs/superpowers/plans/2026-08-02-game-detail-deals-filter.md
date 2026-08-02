# Game-detail navigation, daily recommendations, and Deals genre filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all catalog game cards open reliable detail pages, refresh recommendations daily, and let users filter Deals by five genres.

**Architecture:** Preserve the backend grouped-deals response and resolve the game-detail contract in the route loader. All non-Steam internal links carry a title so a failed numeric lookup can be replaced only by an exact catalog search match. The Deals page retains all five returned sections in query state and locally switches the selected genre.

**Tech Stack:** FastAPI, Redis, React, TanStack Router/Query, Vitest, pytest.

## Global Constraints

- Recommendations expire after exactly `24 * 60 * 60` seconds; a profile/library fingerprint change still creates a different cache entry.
- Catalog fallback accepts only `exactCatalogMatch` results.
- Deals shows exactly four popular cards, five genre chips, and at most five large cards for the selected genre.
- Steam links retain `source=steam`; catalog links include `title`.

---

### Task 1: Make catalog game navigation resilient

**Files:**
- Modify: `web/src/routes/games.$gameId.tsx`
- Modify: `web/src/routes/deals.tsx`
- Modify: `web/src/routes/-games.$gameId.test.ts`
- Modify: `web/src/routes/-deals.genre.test.tsx`

**Interfaces:**
- Consumes: `getCatalogGame(id)`, `searchGames(title)`, and `exactCatalogMatch(results, title)`.
- Produces: a detail loader that resolves an exact title when the supplied catalog ID is unavailable or mismatched.

- [ ] Write a failing loader test: mock `getCatalogGame("999")` to reject, mock `searchGames("Hades")` with exact id `77`, and assert the loader returns game id `"77"`.
- [ ] Run: `npm.cmd test -- --run src/routes/-games.$gameId.test.ts`. Expected: the fallback path is absent or fails.
- [ ] Keep the existing loader algorithm but require all catalog links to provide `search={{ title: deal.name }}`:

```tsx
return link ? <Link to="/games/$gameId" {...link} search={{ title: deal.name }} /> : content;
```

For Steam links, merge `title` into the existing `{ source: "steam", title: deal.name }` search object instead of replacing it.

- [ ] Ensure loader fallback remains exact:

```ts
const results = await searchGames(deps.title);
const match = exactCatalogMatch(results.results, deps.title);
if (!match) throw new Error("Catalog game unavailable");
catalog = await getCatalogGame(match.id);
```

- [ ] Extend the Deals test to assert the catalog-card link includes `?title=Action%20game`; run the two focused route tests.
- [ ] Commit: `fix: resolve game details from exact titles`.

### Task 2: Refresh recommendations once per day

**Files:**
- Modify: `app/steam_recommendations.py`
- Modify: `tests/test_steam_recommendations.py`

**Interfaces:**
- Consumes: Redis `cache_get` / `cache_set` and the profile/library fingerprint.
- Produces: recommendation cache entries with a 24-hour TTL and an ISO `cache_expires_at` one day ahead.

- [ ] Write a failing assertion in `test_cached_recommendations_reuse_a_matching_user_library`:

```python
assert calls["ttl"] == 24 * 60 * 60
```

Capture `ttl` in the mocked `cache_set`.
- [ ] Run: `pytest tests/test_steam_recommendations.py -k cached_recommendations -v`. Expected: current TTL is `21600`.
- [ ] Change the shared constant:

```python
CACHE_TTL_SECONDS = 24 * 60 * 60
```

- [ ] Run: `pytest tests/test_steam_recommendations.py -v`. Expected: all tests pass.
- [ ] Commit: `fix: refresh recommendations daily`.

### Task 3: Filter Deals with five genre chips and large cards

**Files:**
- Modify: `web/src/routes/deals.tsx`
- Modify: `web/src/routes/-deals.genre.test.tsx`

**Interfaces:**
- Consumes: `GenreDealResponse = { popular: Deal[]; sections: { genre: string; results: Deal[] }[] }` from `getGenreDeals()`.
- Produces: `selectedGenre` state, five buttons, and one five-card large-card grid.

- [ ] Write a failing test that clicks the `RPG` chip and asserts the Action game is absent while `RPG game` is rendered.
- [ ] Run: `npm.cmd test -- --run src/routes/-deals.genre.test.tsx`. Expected: all genre sections are still rendered together.
- [ ] Add state initialized from the first API section and choose the active section by genre:

```tsx
const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
const sections = data.sections.slice(0, 5);
const activeGenre = selectedGenre ?? sections[0]?.genre;
const activeSection = sections.find((section) => section.genre === activeGenre) ?? sections[0];
```

- [ ] Render five buttons using `aria-pressed={activeGenre === section.genre}` and `onClick={() => setSelectedGenre(section.genre)}`. Keep `Popular on Steam` as `DealSection` with four cards.
- [ ] Render `activeSection` only with a large card layout based on `GameCard`, capped via `activeSection.results.slice(0, 5)`.
- [ ] Run: `npm.cmd test -- --run src/routes/-deals.genre.test.tsx` and `npm.cmd run build`. Expected: test and production build pass.
- [ ] Commit: `feat: filter Deals by genre`.

### Task 4: Final verification

- [ ] Run: `pytest tests/test_steam_recommendations.py -v`.
- [ ] Run from `web`: `npm.cmd test -- --run src/routes/-games.$gameId.test.ts src/routes/-deals.genre.test.tsx src/routes/-index.recommendations.test.tsx`.
- [ ] Run from `web`: `npm.cmd run build`.
- [ ] Run: `pytest -q -k "not auth_import_requires_secret_key"`.
- [ ] Inspect `git diff origin/main...HEAD` to confirm only navigation, TTL, Deals filtering, and tests are included.
