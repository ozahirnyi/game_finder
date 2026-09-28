# Cold Cache Refresh Implementation Plan

> **For agentic workers:** Execute this plan inline, task by task, with focused tests before implementation.

**Goal:** Serve stale catalog/deal cache data immediately while refreshing it in the background, and wait for signed-in profile region before loading sidebar deals.

**Architecture:** Extend `app.cache.get_json_cached` to return a stale copy on fresh-cache misses and run a deduplicated in-process refresh task. Gate the sidebar deals query on profile completion for signed-in users while leaving guest behavior unchanged.

**Tech Stack:** Python asyncio, pytest, React, TanStack Query, Vitest, Testing Library.

## Global Constraints

- Preserve `CACHE_TTL` and the existing 24-hour `STALE_CACHE_TTL`.
- Keep synchronous fetch behavior when neither fresh nor stale cache data exists.
- Do not require live provider calls in unit tests.

---

### Task 1: Return stale cache data while refreshing

**Files:**
- Modify: `app/cache.py`
- Test: `tests/test_core_edges.py`

**Interfaces:**
- `get_json_cached(key, ttl, fetch_func)` keeps its current signature and return type.
- Fresh cache hits return immediately without calling the provider.
- Stale cache hits return immediately and schedule at most one refresh task per key in this process.

- [ ] Write a test whose fresh lookup misses, stale lookup returns a value, and provider waits on an event; assert the helper returns stale data before releasing the provider, then assert refreshed values are written to both keys.
- [ ] Run `pytest tests/test_core_edges.py::test_cache_returns_stale_while_refresh_runs -q`; confirm it fails because current behavior blocks on `fetch_func`.
- [ ] Add a per-key task registry and background refresh helper in `app/cache.py`; preserve synchronous fetch and stale-on-error paths when there is no stale value.
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

### Task 3: Verify both changes together

- [ ] Run `pytest tests/test_core_edges.py -q`.
- [ ] Run `cd web; npm.cmd test -- --run src/components/-AppShell.prefetch.test.tsx`.
- [ ] Inspect `git diff --check` and confirm only the cache helper, AppShell query gate, focused tests, and design/plan notes changed.
