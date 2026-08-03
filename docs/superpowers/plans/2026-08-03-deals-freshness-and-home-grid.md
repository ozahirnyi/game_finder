# Deals Freshness and Home Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the true deals cache age in the sidebar and fill the Home Price drops grid with twelve standard cards.

**Architecture:** Add an ISO cache-creation timestamp to the cached `/prices/deals` payload, then expose it through the existing Pydantic and TypeScript contracts. The Home call requests thirteen Steam deals while the sidebar retains twelve, yielding one featured deal and a 4 + 4 + 4 standard-card grid.

**Tech Stack:** FastAPI, Pydantic, Redis JSON cache, TanStack React Query, React, pytest, Vitest.

## Global Constraints

- Preserve existing deal fields and Steam fallback behaviour.
- Keep the sidebar request at `page_size=12`; only Home requests `page_size=13`.
- Show no refresh-age text when a timestamp is unavailable.
- Tests must stub provider and cache calls.

---

### Task 1: Expose shared deals-cache creation time

**Files:**
- Modify: `app/main.py`
- Modify: `app/schemas.py`
- Modify: `tests/test_api_contracts.py`

**Interfaces:**
- Produces: `HomeDealResponse.cached_at: datetime | None` serialized as ISO 8601.
- Produces: `/prices/deals` accepts `page_size=13`.

- [ ] **Step 1: Write failing backend tests**

```python
def test_homepage_deals_exposes_the_cache_creation_time(monkeypatch):
    response = client.get("/prices/deals?page_size=13")
    assert response.status_code == 200
    assert response.json()["cached_at"]
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk python -m pytest -q tests/test_api_contracts.py -k cache_creation_time`

Expected: FAIL because `cached_at` is absent or page size 13 is rejected.

- [ ] **Step 3: Implement the cached payload envelope**

```python
class HomeDealResponse(BaseModel):
    results: list[HomeDealItem] = Field(default_factory=list)
    cached_at: datetime | None = None

return {"results": deals, "cached_at": datetime.now(timezone.utc).isoformat()}
```

Raise the `/prices/deals` maximum page size from 12 to 13; cache the envelope so cache hits retain the original timestamp.

- [ ] **Step 4: Verify and commit**

Run: `rtk python -m pytest -q tests/test_api_contracts.py -k homepage_deals`

Expected: PASS.

Commit: `git commit -am "feat: expose deals cache freshness"`

### Task 2: Render true freshness and a complete Home grid

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/components/AppShell.tsx`
- Modify: `web/src/routes/index.tsx`
- Modify: `web/src/components/-AppShell.prefetch.test.tsx`
- Modify: `web/src/routes/-index.recommendations.test.tsx`

**Interfaces:**
- Consumes: `getDeals(country, pageSize?)` returning `{ results, cached_at? }`.
- Produces: sidebar label `refreshed <relative age> ago` from `cached_at`.

- [ ] **Step 1: Write failing frontend tests**

```tsx
expect(screen.getByText("12 price drops tracked · refreshed 4m ago")).toBeInTheDocument();
expect(await screen.findByText("Twelfth deal")).toBeInTheDocument();
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `rtk npm.cmd test -- --run src/components/-AppShell.prefetch.test.tsx src/routes/-index.recommendations.test.tsx`

Expected: FAIL because the sidebar age is hard-coded and Home requests only 12 deals.

- [ ] **Step 3: Implement the minimal UI contract**

```ts
export function getDeals(country: string, pageSize = 12) {
  return apiRequest<{ results: Deal[]; cached_at?: string | null }>(
    `/prices/deals?country=${encodeURIComponent(country)}&page_size=${pageSize}`,
  );
}
```

Use `getDeals(region, 13)` only on Home. Format `cached_at` from the current clock into minutes/hours; keep the count alone when it is missing or invalid.

- [ ] **Step 4: Verify and commit**

Run: `rtk npm.cmd test -- --run src/components src/routes src/lib && rtk npm.cmd run build`

Expected: PASS.

Commit: `git commit -am "feat: show deals freshness and complete home grid"`
