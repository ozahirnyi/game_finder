# Recent Active Player Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Report Steam availability accurately so the recent-player ranking cannot silently become an empty list after a provider failure.

**Architecture:** The API returns `RecentGamePlayersRead { players, status }` instead of a bare array. The backend aggregates only non-private Steam lookup failures; the frontend renders a generic partial-data notice or the existing retryable unavailable state.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy, pytest; React, TypeScript, TanStack Query, Vitest.

## Global Constraints

- Do not expose another user's Steam privacy, account, or provider-failure details.
- Continue filtering by social visibility and library visibility.
- Preserve descending playtime ranking, de-duplication, and the ten-player limit.
- Private Steam libraries (`HTTP 409`) are expected and do not degrade the response.

---

### Task 1: Add the backend availability contract

**Files:**
- Modify: `app/schemas.py:641-642`
- Modify: `app/main.py:76,1692-1782`
- Test: `tests/test_social_api.py:113-197`

**Interfaces:**
- Produces `RecentGamePlayersRead(players: list[RecentGamePlayerRead], status: Literal["ready", "partial", "unavailable"])`.
- Produces `recent_steam_players_for_app(...) -> RecentGamePlayersRead`.
- Both active-player routes return `RecentGamePlayersRead`.

- [ ] **Step 1: Write failing backend contract tests**

```python
def test_recent_steam_players_marks_provider_failure_as_partial(monkeypatch, social_db):
    # Create a viewer, a stored active player, and a public Steam user whose lookup raises HTTPException(502).
    # GET /steam/games/12345/active-players must return:
    # {"status": "partial", "players": [{"public_id": "active-id", ...}]}.

def test_recent_steam_players_marks_all_provider_failures_unavailable(monkeypatch, social_db):
    # Create a viewer and an eligible linked Steam user whose lookup raises HTTPException(503).
    # GET /steam/games/12345/active-players must return {"status": "unavailable", "players": []}.

def test_recent_steam_players_keeps_private_library_ready(monkeypatch, social_db):
    # A linked player whose lookup raises HTTPException(409) returns {"status": "ready", "players": []}.
```

- [ ] **Step 2: Run the new tests and verify RED**

Run: `rtk pytest -q tests/test_social_api.py -k "recent_steam_players_marks"`

Expected: FAIL because routes still serialize a list and do not include `status`.

- [ ] **Step 3: Implement the minimal backend contract**

```python
class RecentGamePlayersRead(BaseModel):
    players: list[RecentGamePlayerRead] = Field(default_factory=list)
    status: Literal["ready", "partial", "unavailable"]
```

Track live Steam `HTTPException`s where `status_code != 409`. Build the existing ranked player list unchanged. Return `"partial"` when a non-private provider error occurred and a ranking remains; return `"unavailable"` when every attempted eligible lookup failed and no stored-ranked player exists; otherwise return `"ready"`. Set both route `response_model`s to the new schema.

- [ ] **Step 4: Run backend tests and verify GREEN**

Run: `rtk pytest -q tests/test_social_api.py -k recent`

Expected: PASS, including existing ranking, direct-Steam, live-library, and privacy tests after their assertions are updated to use `payload["players"]` and `payload["status"]`.

- [ ] **Step 5: Commit the backend change**

```bash
rtk git add app/main.py app/schemas.py tests/test_social_api.py
rtk git commit -m "fix: report recent player Steam availability"
```

### Task 2: Render availability status in the game page

**Files:**
- Modify: `web/src/lib/api.ts:927-944`
- Modify: `web/src/routes/games.$gameId.tsx:285-295,827-831`
- Modify: `web/src/components/GameRecentPlayers.tsx:6-66`
- Test: `web/src/components/GameRecentPlayers.test.tsx:11-64`
- Test: `web/src/routes/-games.detail.test.tsx:269-302`

**Interfaces:**
- Consumes `RecentGamePlayers { players: RecentGamePlayer[]; status: "ready" | "partial" | "unavailable" }`.
- `GameRecentPlayers` accepts `status` in addition to its current props.

- [ ] **Step 1: Write failing component tests**

```tsx
it("warns when the ranking is only partially available", () => {
  render(<GameRecentPlayers players={[]} status="partial" isPending={false} isError={false} onRetry={vi.fn()} />);
  expect(screen.getByText("Some Steam activity is temporarily unavailable.")).toBeInTheDocument();
});

it("offers retry when Steam activity is unavailable", () => {
  render(<GameRecentPlayers players={[]} status="unavailable" isPending={false} isError={false} onRetry={vi.fn()} />);
  expect(screen.getByText("Recent player activity is unavailable.")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the component tests and verify RED**

Run: `cd web; rtk npm.cmd test -- GameRecentPlayers.test.tsx`

Expected: FAIL because `status` is not a component prop and no partial warning exists.

- [ ] **Step 3: Implement the minimal client adaptation**

```ts
export type RecentGamePlayers = {
  players: RecentGamePlayer[];
  status: "ready" | "partial" | "unavailable";
};
```

Change both API functions to return `RecentGamePlayers`. Pass `activePlayersQuery.data?.players ?? []` and `activePlayersQuery.data?.status ?? "ready"` to the component. Treat query errors or `status === "unavailable"` as the retryable unavailable view. Render `Some Steam activity is temporarily unavailable.` above the normal ranking/empty content for `partial`.

- [ ] **Step 4: Run frontend tests and verify GREEN**

Run: `cd web; rtk npm.cmd test -- GameRecentPlayers.test.tsx -t "recently active"`

Expected: PASS, with rank order retained and status views covered.

- [ ] **Step 5: Commit the frontend change**

```bash
rtk git add web/src/lib/api.ts web/src/routes/games.$gameId.tsx web/src/components/GameRecentPlayers.tsx web/src/components/GameRecentPlayers.test.tsx web/src/routes/-games.detail.test.tsx
rtk git commit -m "fix: show recent player availability"
```

### Task 3: Verify the integrated contract

**Files:**
- Verify only.

- [ ] **Step 1: Run focused backend and frontend suites**

Run: `rtk pytest -q tests/test_social_api.py -k recent`

Run: `cd web; rtk npm.cmd test -- GameRecentPlayers.test.tsx -t "recently active"`

Expected: both commands PASS.

- [ ] **Step 2: Check the final change set**

Run: `rtk git diff origin/main...HEAD --check; rtk git status --short`

Expected: no whitespace errors; status contains no uncommitted implementation files.
