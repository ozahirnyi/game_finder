# AI Search Validated Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return up to ten AI-selected, IGDB-validated catalog cards without consuming quota on unsuccessful searches.

**Architecture:** Keep OpenAI responsible for interpreting an unrestricted natural-language request and selecting up to ten titles. Replace per-title IGDB enrichment with one bounded batch resolver, discard only unresolved titles, and commit a quota attempt only when at least one resolved card is returned. The browser receives catalog-backed recommendation data, applies a request timeout, and renders them with `GameCard` in a five-column desktop grid.

**Tech Stack:** FastAPI, SQLAlchemy, OpenAI Responses API, httpx/IGDB, React, TanStack Query, Vitest, pytest.

## Global Constraints

- Develop and verify in a local worktree; do not deploy as part of this work.
- Preserve natural-language AI prompts; never restrict them to catalog-search keywords.
- Request no more than ten recommendations and do not pad results to reach ten.
- Render only catalog-resolved games with a usable `igdb_id`.
- Count only successful responses that contain one or more renderable cards against the per-`user_id` UTC-day quota.
- Use the existing 60-second per-account cooldown.

---

### Task 1: Establish the local hardening baseline

**Files:**
- Modify: local worktree branch based on `origin/codex/ai-search-hardening-main`
- Verify: `app/main.py`, `app/recommendation_quota.py`, `app/recommendations.py`, `app/integrations/igdb.py`, `web/src/routes/search.tsx`

**Interfaces:**
- Consumes: the deployed hardening baseline's authenticated `POST /recommendations` and `GET /recommendations/quota`.
- Produces: an isolated local branch that contains the same quota, IGDB, and AI-search architecture as the deployed site.

- [ ] **Step 1: Fetch the hardening baseline and create an isolated worktree**

Run: `rtk git fetch origin codex/ai-search-hardening-main && rtk git worktree add -b codex/ai-search-validated-results-local <validated-worktree-path> origin/codex/ai-search-hardening-main`

Expected: the new worktree contains `app/recommendation_quota.py` and `web/src/routes/search.tsx` with AI mode.

- [ ] **Step 2: Verify the baseline before modification**

Run: `rtk pytest -q tests/test_recommendation_quota.py tests/test_recommendation_enrichment.py && rtk npm --prefix web test -- --run src/routes/-search.test.tsx`

Expected: both suites pass locally.

- [ ] **Step 3: Commit only baseline bookkeeping if required**

Run: `rtk git status --short`

Expected: no product-code changes; do not create a commit when the worktree is clean.

### Task 2: Make quota consumption conditional on a delivered result

**Files:**
- Modify: `app/recommendation_quota.py`
- Modify: `app/main.py`
- Test: `tests/test_recommendation_quota.py`
- Test: `tests/test_recommendation_edges.py`

**Interfaces:**
- Consumes: `get_quota_status(db, user_id)` and the authenticated recommendation route.
- Produces: `assert_quota_available(db, user_id, now=None) -> QuotaSnapshot` and `consume_quota(db, user_id, now=None) -> QuotaSnapshot`.

- [ ] **Step 1: Write failing quota tests**

```python
def test_availability_check_does_not_consume_an_attempt(session, user):
    snapshot = assert_quota_available(session, user.id, utc(2026, 9, 4, 12))
    assert snapshot.remaining == 3
    assert get_quota_status(session, user.id, utc(2026, 9, 4, 12)).remaining == 3

def test_consume_quota_decrements_only_after_a_success(session, user):
    assert_quota_available(session, user.id, utc(2026, 9, 4, 12))
    result = consume_quota(session, user.id, utc(2026, 9, 4, 12))
    assert result.remaining == 2
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `rtk pytest -q tests/test_recommendation_quota.py -k "availability or consume"`

Expected: FAIL because the new functions do not exist.

- [ ] **Step 3: Split reservation into check and consumption operations**

```python
def assert_quota_available(db: Session, user_id: uuid.UUID, now: datetime | None = None) -> QuotaSnapshot:
    # Lock the user row, calculate the current snapshot, and raise QuotaDenied
    # for limit or cooldown without mutating attempt_count.

def consume_quota(db: Session, user_id: uuid.UUID, now: datetime | None = None) -> QuotaSnapshot:
    # Lock again, re-check the limit/cooldown, increment attempt_count and commit.
```

Update `recommendations()` to call `assert_quota_available` before provider work and `consume_quota` only after it has non-empty resolved output.

- [ ] **Step 4: Test the route's failure path**

```python
def test_catalog_failure_returns_error_without_spending_quota(client, db, user, monkeypatch):
    monkeypatch.setattr("app.main.get_recommendation", lambda *_: {"recommendations": []})
    response = client.post("/recommendations", json={"prompt": "anything"}, headers=auth(user))
    assert response.status_code == 503
    assert get_quota_status(db, user.id).remaining == 3
```

- [ ] **Step 5: Run backend tests**

Run: `rtk pytest -q tests/test_recommendation_quota.py tests/test_recommendation_edges.py`

Expected: PASS.

- [ ] **Step 6: Commit**

Run: `rtk git add app/recommendation_quota.py app/main.py tests/test_recommendation_quota.py tests/test_recommendation_edges.py && rtk git commit -m "fix: consume AI quota after successful results"`

Expected: one focused commit.

### Task 3: Generate up to ten titles and resolve them in one IGDB batch

**Files:**
- Modify: `app/openai_client.py`
- Modify: `app/integrations/igdb.py`
- Modify: `app/recommendations.py`
- Modify: `app/main.py`
- Test: `tests/test_recommendation_enrichment.py`
- Test: `tests/test_igdb.py`

**Interfaces:**
- Consumes: `get_recommendation(prompt, liked_game_ids) -> dict` and `fetch_igdb_games_batch(titles) -> dict[str, list[dict]]`.
- Produces: at most ten distinct AI candidates and `enrich_recommendations(items, search_titles)` that returns only exact, resolved catalog records.

- [ ] **Step 1: Write failing AI response and batch-resolution tests**

```python
def test_build_prompt_allows_fewer_than_ten_recommendations():
    prompt = build_prompt("a strange, quiet game", [])
    assert "Up to 10 recommendations" in prompt
    assert "Exactly 8" not in prompt

@pytest.mark.asyncio
async def test_enrichment_omits_unresolved_titles():
    async def batch(titles):
        assert titles == ["Hades", "Invented Game"]
        return {"Hades": [{"id": 1, "name": "Hades"}], "Invented Game": []}
    enriched = await enrich_recommendations(
        [{"title": "Hades"}, {"title": "Invented Game"}], batch
    )
    assert [item["title"] for item in enriched] == ["Hades"]
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `rtk pytest -q tests/test_recommendation_enrichment.py tests/test_igdb.py -k "unresolved or batch or fewer"`

Expected: FAIL because the existing enrichment invokes one title search per item and preserves unresolved output.

- [ ] **Step 3: Change the model contract and batch resolver**

```python
# app/openai_client.py prompt constraint
# - Return up to 10 distinct, genuinely relevant games; do not pad the list.

# app/recommendations.py
async def enrich_recommendations(items, search_titles):
    titles = [item["title"] for item in items]
    matches_by_title = await search_titles(titles)
    return [
        {**item, "game": exact_match}
        for item in items
        if (exact_match := find_exact_match(item["title"], matches_by_title.get(item["title"], [])))
    ]
```

Call `fetch_igdb_games_batch` once from `app/main.py`, set one bounded request budget, and retry only `httpx.TransportError` once. Do not invoke individual `fetch_igdb_games` calls during AI enrichment.

- [ ] **Step 4: Add route-level subset and zero-match coverage**

```python
def test_recommendations_returns_only_resolved_catalog_games(client, user, monkeypatch):
    # AI returns two titles; batch resolver returns a catalog match for one.
    response = client.post("/recommendations", json={"prompt": "moody games"}, headers=auth(user))
    assert response.status_code == 200
    assert len(response.json()["recommendations"]) == 1
    assert response.json()["recommendations"][0]["game"]["id"] == 42
```

- [ ] **Step 5: Run backend tests**

Run: `rtk pytest -q tests/test_recommendation_enrichment.py tests/test_igdb.py tests/test_recommendation_edges.py`

Expected: PASS.

- [ ] **Step 6: Commit**

Run: `rtk git add app/openai_client.py app/integrations/igdb.py app/recommendations.py app/main.py tests/test_recommendation_enrichment.py tests/test_igdb.py tests/test_recommendation_edges.py && rtk git commit -m "fix: batch validate AI recommendations"`

Expected: one focused commit.

### Task 4: Render only catalog-backed cards and bound browser waiting

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/routes/search.tsx`
- Test: `web/src/routes/-search.test.tsx`

**Interfaces:**
- Consumes: `RecommendationResponse.recommendations`, where each item includes `game.id` and catalog card metadata.
- Produces: a cancellable `getRecommendations(prompt)` request and AI cards rendered through `GameCard`.

- [ ] **Step 1: Write failing UI tests**

```tsx
it("renders only resolved AI recommendations as catalog cards", async () => {
  api.getRecommendations.mockResolvedValue({ recommendations: [resolvedHades] });
  render(<SearchPage />);
  await userEvent.click(screen.getByRole("button", { name: "Ask AI" }));
  expect(await screen.findByRole("link", { name: /Hades/i })).toHaveAttribute("href", "/games/1");
  expect(screen.queryByText("Search for Hades")).not.toBeInTheDocument();
});

it("ends loading and shows retryable feedback after the AI request times out", async () => {
  api.getRecommendations.mockRejectedValue(new ApiError("AI search timed out", 504));
  render(<SearchPage />);
  await userEvent.click(screen.getByRole("button", { name: "Ask AI" }));
  expect(await screen.findByText(/timed out/i)).toBeVisible();
});
```

- [ ] **Step 2: Run the focused UI test to verify it fails**

Run: `rtk npm --prefix web test -- --run src/routes/-search.test.tsx`

Expected: FAIL because current AI output uses title articles and offers a search fallback.

- [ ] **Step 3: Implement API cancellation and card rendering**

```ts
export function getRecommendations(prompt: string) {
  return request<RecommendationResponse>("/recommendations", {
    method: "POST", auth: true, body: { prompt, liked_game_ids: [] }, timeoutMs: 30_000,
  });
}
```

Extend the shared `request` helper to create an `AbortController` for `timeoutMs` and map aborts to `ApiError("AI search timed out", 504)`. In `search.tsx`, map every returned resolved `item.game` to `GameCard`, remove the title-only fallback anchor, and use `lg:grid-cols-5` for the AI results grid.

- [ ] **Step 4: Add subset presentation coverage**

```tsx
it("shows the available subset without an error", async () => {
  api.getRecommendations.mockResolvedValue({ recommendations: [resolvedHades, resolvedCeleste] });
  render(<SearchPage />);
  await userEvent.click(screen.getByRole("button", { name: "Ask AI" }));
  expect(await screen.findAllByRole("link", { name: /Hades|Celeste/i })).toHaveLength(2);
  expect(screen.queryByText(/No AI matches found/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 5: Run frontend verification**

Run: `rtk npm --prefix web test -- --run src/routes/-search.test.tsx src/lib/api.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Run: `rtk git add web/src/lib/api.ts web/src/routes/search.tsx web/src/routes/-search.test.tsx web/src/lib/api.test.ts && rtk git commit -m "fix: render resilient AI catalog cards"`

Expected: one focused commit.

### Task 5: Run the local acceptance suite and prepare review

**Files:**
- Verify: backend recommendation, quota, IGDB, and frontend search tests

**Interfaces:**
- Consumes: all completed tasks.
- Produces: locally verified implementation ready for user testing; no deployment action.

- [ ] **Step 1: Run all focused backend tests**

Run: `rtk pytest -q tests/test_config.py tests/test_recommendation_quota.py tests/test_recommendation_edges.py tests/test_recommendation_enrichment.py tests/test_igdb.py`

Expected: PASS.

- [ ] **Step 2: Run all frontend tests and build**

Run: `rtk npm --prefix web test -- --run && rtk npm --prefix web run build`

Expected: PASS and a successful production build.

- [ ] **Step 3: Manually verify locally**

Run the local backend and web app with development credentials, sign in, submit a natural-language prompt, and confirm that every displayed card opens its local catalog route. Disconnect or mock IGDB once and confirm the UI exits loading and the quota value remains unchanged.

- [ ] **Step 4: Inspect the task diff**

Run: `rtk diff -- app/openai_client.py app/integrations/igdb.py app/recommendations.py app/recommendation_quota.py app/main.py web/src/lib/api.ts web/src/routes/search.tsx`

Expected: only the validated-result, quota, timeout, and AI-card changes are present.

- [ ] **Step 5: Push for review after local user approval**

Run: `rtk git push -u origin codex/ai-search-validated-results-local`

Expected: branch is available for a pull request. Do not deploy until local behavior is approved.
