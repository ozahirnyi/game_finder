# Cold Cache Refresh Implementation Plan

> **For agentic workers:** Execute this plan inline, task by task, with focused tests before implementation.

**Goal:** Serve stale catalog/deal cache data immediately while refreshing it in the background, and wait for signed-in profile region before loading home and sidebar deals.

**Architecture:** Add an explicit opt-in to `app.cache.get_json_cached` for stale-first responses and deduplicated in-process refreshes; enable it only for external-provider fetches that do not depend on request-scoped database state. Gate both home and sidebar deals queries on profile completion for signed-in users while leaving guest behavior unchanged.

**Tech Stack:** Python asyncio, pytest, React, TanStack Query, Vitest, Testing Library.

## Global Constraints

- Preserve `CACHE_TTL` and the existing 24-hour `STALE_CACHE_TTL`.
- Keep synchronous fetch behavior when neither fresh nor stale cache data exists.
- Keep synchronous behavior for fetch closures that capture request-scoped database sessions.
- Do not require live provider calls in unit tests.

---

### Task 1: Return stale cache data while refreshing

**Files:**
- Modify: `app/cache.py`
- Test: `tests/test_core_edges.py`

**Interfaces:**
- `get_json_cached(key, ttl, fetch_func, *, stale_while_revalidate=False)` keeps its return type and defaults to synchronous behavior.
- Fresh cache hits return immediately without calling the provider.
- `stale_while_revalidate=True` makes stale hits return immediately and schedule at most one refresh task per key in this process.

- [ ] Write a test whose fresh lookup misses, stale lookup returns a value, and provider waits on an event; opt in to stale-while-revalidate, assert the helper returns stale data before releasing the provider, then assert refreshed values are written to both keys. Add a test proving the default path awaits the provider despite a stale value.
- [ ] Run `pytest tests/test_core_edges.py::test_stale_cache_returns_while_one_background_refresh_updates_both_copies -q`; confirm it fails because current behavior blocks on `fetch_func`.
- [ ] Add a keyword-only `stale_while_revalidate: bool = False` parameter, per-key task registry, and background refresh helper in `app/cache.py`; preserve synchronous fetch and stale-on-error behavior when disabled or when there is no stale value.
- [ ] Opt in only external-provider cache callsites in `app/main.py`; leave the `catalog_game_detail` fetch that captures a request-scoped database session on the default synchronous path.
- [ ] Run the focused test and `pytest tests/test_core_edges.py::test_cache_hit_miss_and_redis_failure_paths -q`; confirm both pass.

### Task 2: Wait for a signed-in user's profile region

**Files:**
- Modify: `web/src/components/AppShell.tsx`
- Test: `web/src/components/-AppShell.prefetch.test.tsx`

**Interfaces:**
- Guests continue to load sidebar deals after idle scheduling.
- Signed-in users start the sidebar deals request only after the profile query settles; the resolved profile's region is used.

- [ ] Add a test with a pending profile promise; after the sidebar becomes idle, assert `getDeals` was not called, resolve the profile with `price_country_code: "UA"`, and assert `getDeals("UA")` is called.
- [ ] Run `cd web; npm.cmd test -- --run src/components/-AppShell.prefetch.test.tsx`; confirm the new test fails because the US fallback request starts before the profile resolves.
- [ ] Gate `dealsQuery.enabled` on both `sidebarDealsReady` and either guest status or settled profile query.
- [ ] Run the AppShell test file and confirm all tests pass.

### Task 3: Wait for a signed-in user's profile region on the home page

**Files:**
- Modify: `web/src/routes/index.tsx`
- Test: `web/src/routes/-index.recommendations.test.tsx`

**Interfaces:**
- Guests continue loading home deals without a profile request.
- Signed-in users start home deals only after the profile query settles and use its region.

- [ ] Add a test with a deferred profile promise, clear `getDeals` call history, and assert no home deals request occurs while the profile is pending; resolve with `price_country_code: "UA"` and assert `getDeals("UA", 13)`.
- [ ] Run `cd web; npm.cmd test -- --run src/routes/-index.recommendations.test.tsx`; confirm the assertion fails because the current code requests `US` while the profile is pending.
- [ ] Set the home deals query `enabled` condition to `!signedIn || !profileQuery.isPending`.
- [ ] Rerun the focused index test file and confirm it passes.

### Task 4: Verify both changes together

- [ ] Run `pytest tests/test_core_edges.py -q`.
- [ ] Run `cd web; npm.cmd test -- --run src/components/-AppShell.prefetch.test.tsx src/routes/-index.recommendations.test.tsx`.
- [ ] Inspect `git diff --check` and confirm only the cache helper, selected backend cache callsites, AppShell/home route query gates, focused tests, and design/plan notes changed.
