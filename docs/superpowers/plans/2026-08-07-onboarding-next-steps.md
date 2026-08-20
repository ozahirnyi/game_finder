# Post-Auth Onboarding and Next-Step Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give signed-in users compact, server-derived onboarding guidance on Home and Account that leads only to existing useful flows.

**Architecture:** Add one authenticated `GET /onboarding/summary` FastAPI endpoint that derives five owner-only facts with database counts. Add one typed client request and a presentational `OnboardingGuidance` component; Home and Account each own a TanStack Query for the same `['onboarding-summary']` data and place the component in their appropriate location.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, pytest, React, TypeScript, TanStack Query/Router, Vitest, Testing Library, lucide-react.

## Global Constraints

- Source of truth is `origin/main`; do not use the obsolete mock-data PRs #142–145.
- `GET /onboarding/summary` is authenticated and owner-scoped and returns exactly `steam_linked`, `psn_library_games`, `wishlist_games`, `price_alerts`, and `friends`.
- A library is complete only when `steam_linked || psn_library_games > 0`; PlayStation completion is persisted PSN games, not a client flag.
- Count only confirmed `Friendship` rows and only `PriceAlert` rows joined to a `WishlistItem` owned by the current user.
- Do not add migrations, browser storage, a dismissal state, new routes, external calls, payload data, Party Finder, Groups, Discord, presence, profile redesign, favorites/privacy work, or recommendations.
- Guidance order and real targets are: library (`/account`, `/psn-import`), wishlist (`/search`), alert (`/wishlist`), friends (`/friends`). Render nothing when all four conditions are complete.
- Loading is small and non-blocking; failure says `Setup guidance is unavailable` and retries only this query. Signed-out Home must neither query nor render it.
- Preserve Phase 4 Home truthful-state behavior. Do not stage generated `web/src/routeTree.gen.ts` or build output.
- Every production edit follows RED → minimal implementation → GREEN; tests stub external integrations and require no live credentials.

---

## File Structure

- `app/schemas.py` — the exact five-field response model.
- `app/main.py` — import the model and expose the owner-derived summary endpoint without changing existing profile-summary behavior.
- `tests/integration/backend/test_profile_dashboard_psn_api.py` — API contract, owner scoping, PSN/Steam completion facts, price-alert ownership, and auth coverage.
- `web/src/lib/api.ts` — frontend `OnboardingSummary` type and authenticated request function.
- `web/src/components/OnboardingGuidance.tsx` — deterministic cards, compact/full presentation, loading/error/complete states, and existing-route links.
- `web/src/components/OnboardingGuidance.test.tsx` — component-level decision table, compact state, errors/retry, completion, and action destinations.
- `web/src/routes/index.tsx` — signed-in Home query and full block immediately after the hero.
- `web/src/routes/account.tsx` — Account query and compact companion immediately before the owner profile.
- `web/src/routes/-index.startup.test.tsx` and `web/src/routes/-account.test.tsx` — route query wiring, signed-out suppression, placement, and Phase 4 state preservation.

### Task 1: Owner-scoped backend summary contract

**Files:**
- Modify: `app/schemas.py`
- Modify: `app/main.py`
- Modify: `tests/integration/backend/test_profile_dashboard_psn_api.py`

**Interfaces:**
- Produces: `OnboardingSummaryRead` with `steam_linked: bool`, `psn_library_games: int`, `wishlist_games: int`, `price_alerts: int`, and `friends: int`.
- Produces: `GET /onboarding/summary -> OnboardingSummaryRead`, authenticated by `get_current_user`.
- Consumes: `Game.owner_id/source`, `WishlistItem.user_id/id`, `PriceAlert.user_id/wishlist_item_id`, and canonical-pair `Friendship` rows.

- [ ] **Step 1: Write the failing API contract tests**

```python
def test_onboarding_summary_is_owner_scoped_and_counts_only_owned_alerts(
    api_client, db_session, user_factory, auth_as
):
    owner = auth_as(user_factory(email="onboarding-owner@example.com", steam_id="steam-owner"))
    other = user_factory(email="onboarding-other@example.com")
    owned_item = WishlistItem(user_id=owner.id, catalog_game_id=1, title="Owned")
    other_item = WishlistItem(user_id=other.id, catalog_game_id=2, title="Other")
    db_session.add_all([
        Game(owner_id=owner.id, title="PSN", source="psn", external_id="psn:1"),
        Game(owner_id=other.id, title="Other PSN", source="psn", external_id="psn:2"),
        owned_item, other_item,
    ])
    db_session.flush()
    db_session.add_all([
        PriceAlert(user_id=owner.id, wishlist_item_id=owned_item.id, target_price=10),
        PriceAlert(user_id=owner.id, wishlist_item_id=other_item.id, target_price=10),
        Friendship(user_low_id=owner.id, user_high_id=other.id),
    ])
    db_session.commit()

    response = api_client.get("/onboarding/summary")

    assert response.status_code == 200
    assert response.json() == {
        "steam_linked": True, "psn_library_games": 1, "wishlist_games": 1,
        "price_alerts": 1, "friends": 1,
    }


def test_onboarding_summary_requires_authentication(api_client):
    assert api_client.get("/onboarding/summary").status_code == 401
```

Add a parametrized test for no Steam/no PSN (`False`, `0`) and a linked-Steam/no-PSN case (`True`, `0`), proving that no live Steam request is made and the endpoint's library inputs are persisted owner data only.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `rtk pytest tests/integration/backend/test_profile_dashboard_psn_api.py -k onboarding_summary -v`

Expected: FAIL because `/onboarding/summary` and `OnboardingSummaryRead` do not yet exist.

- [ ] **Step 3: Add the schema and minimal endpoint**

```python
# app/schemas.py
class OnboardingSummaryRead(BaseModel):
    steam_linked: bool
    psn_library_games: int
    wishlist_games: int
    price_alerts: int
    friends: int

# app/main.py (add to the existing schema import and near other authenticated summaries)
@app.get("/onboarding/summary", response_model=OnboardingSummaryRead)
def onboarding_summary(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return OnboardingSummaryRead(
        steam_linked=bool(current_user.steam_id),
        psn_library_games=db.query(func.count(Game.id)).filter(
            Game.owner_id == current_user.id, Game.source == "psn"
        ).scalar() or 0,
        wishlist_games=db.query(func.count(WishlistItem.id)).filter(
            WishlistItem.user_id == current_user.id
        ).scalar() or 0,
        price_alerts=db.query(func.count(PriceAlert.id)).join(
            WishlistItem, PriceAlert.wishlist_item_id == WishlistItem.id
        ).filter(
            PriceAlert.user_id == current_user.id,
            WishlistItem.user_id == current_user.id,
        ).scalar() or 0,
        friends=db.query(func.count(Friendship.id)).filter(
            (Friendship.user_low_id == current_user.id)
            | (Friendship.user_high_id == current_user.id)
        ).scalar() or 0,
    )
```

Do not extend `ProfileSummaryRead`, fetch Steam, add tables/columns, or add an Alembic migration.

- [ ] **Step 4: Run the focused API tests and verify GREEN**

Run: `rtk pytest tests/integration/backend/test_profile_dashboard_psn_api.py -k onboarding_summary -v`

Expected: PASS; authenticated output is exactly the five fields and unauthenticated access is 401.

- [ ] **Step 5: Commit the backend vertical slice**

```powershell
rtk git add app/schemas.py app/main.py tests/integration/backend/test_profile_dashboard_psn_api.py
rtk git commit -m "feat: add onboarding summary endpoint"
```

### Task 2: Typed API client and deterministic guidance component

**Files:**
- Modify: `web/src/lib/api.ts`
- Create: `web/src/components/OnboardingGuidance.tsx`
- Create: `web/src/components/OnboardingGuidance.test.tsx`

**Interfaces:**
- Consumes: `OnboardingSummary` and optional `compact: boolean`.
- Produces: `getOnboardingSummary(): Promise<OnboardingSummary>` using `apiRequest(..., { auth: true })`.
- Produces: `<OnboardingGuidance summary? isPending isError onRetry compact? />`; no query logic belongs in it.

- [ ] **Step 1: Write the failing component and API tests**

```tsx
it("offers only the unresolved steps in product order and uses active destinations", () => {
  render(<OnboardingGuidance summary={{
    steam_linked: false, psn_library_games: 0, wishlist_games: 1, price_alerts: 0, friends: 0,
  }} isPending={false} isError={false} onRetry={vi.fn()} />);

  expect(screen.getByText("Connect a library")).toBeInTheDocument();
  expect(screen.queryByText("Add a wishlist game")).not.toBeInTheDocument();
  expect(screen.getByText("Create your first price alert")).toBeInTheDocument();
  expect(screen.getByText("Find friends")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Connect Steam" })).toHaveAttribute("href", "/account");
  expect(screen.getByRole("link", { name: "Import PlayStation" })).toHaveAttribute("href", "/psn-import");
  expect(screen.getByRole("link", { name: /price alert/i })).toHaveAttribute("href", "/wishlist");
  expect(screen.getByRole("link", { name: /find friends/i })).toHaveAttribute("href", "/friends");
});

it("renders preparation, retryable error, compact content, and no completed placeholder", () => {
  const retry = vi.fn();
  const { rerender } = render(<OnboardingGuidance isPending isError={false} onRetry={retry} />);
  expect(screen.getByText(/Preparing your setup/i)).toBeInTheDocument();
  rerender(<OnboardingGuidance isPending={false} isError onRetry={retry} compact />);
  fireEvent.click(screen.getByRole("button", { name: /retry/i }));
  expect(retry).toHaveBeenCalledOnce();
  rerender(<OnboardingGuidance summary={{ steam_linked: true, psn_library_games: 0, wishlist_games: 1, price_alerts: 1, friends: 1 }} isPending={false} isError={false} onRetry={retry} />);
  expect(screen.queryByText("Setup guidance is unavailable")).not.toBeInTheDocument();
  expect(screen.queryByText("Connect a library")).not.toBeInTheDocument();
});
```

Cover new-user (all zero), Steam-linked and PSN-imported library completion, wishlist-without-alert, no-friends, and the `/search` wishlist link. In `api.ts`, mock `fetch` and assert `getOnboardingSummary` calls `/onboarding/summary` with the normal auth flow.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `rtk proxy npm.cmd --prefix web test -- --run src/components/OnboardingGuidance.test.tsx`

Expected: FAIL because the component and typed API client are absent.

- [ ] **Step 3: Implement the typed client and presentation-only component**

```tsx
// web/src/lib/api.ts
export type OnboardingSummary = {
  steam_linked: boolean;
  psn_library_games: number;
  wishlist_games: number;
  price_alerts: number;
  friends: number;
};

export function getOnboardingSummary() {
  return apiRequest<OnboardingSummary>("/onboarding/summary", { auth: true });
}

// web/src/components/OnboardingGuidance.tsx (derive cards; use TanStack <Link>)
const libraryComplete = summary.steam_linked || summary.psn_library_games > 0;
const cards = [
  !libraryComplete && { title: "Connect a library", links: [["Connect Steam", "/account"], ["Import PlayStation", "/psn-import"]] },
  summary.wishlist_games === 0 && { title: "Add a wishlist game", links: [["Add a wishlist game", "/search"]] },
  summary.wishlist_games > 0 && summary.price_alerts === 0 && { title: "Create your first price alert", links: [["Create your first price alert", "/wishlist"]] },
  summary.friends === 0 && { title: "Find friends", links: [["Find friends", "/friends"]] },
].filter(Boolean);
```

Use the project `Panel` and `Link` styles. The full block may show explanatory copy; `compact` reduces copy and spacing, but not actions or card order. Return `null` only after a successful response with zero cards. Do not use localStorage or emit a local dismissal control.

- [ ] **Step 4: Run the focused frontend tests and verify GREEN**

Run: `rtk proxy npm.cmd --prefix web test -- --run src/components/OnboardingGuidance.test.tsx`

Expected: PASS; component state matrix and real-route navigation all pass.

- [ ] **Step 5: Commit the client and component slice**

```powershell
rtk git add web/src/lib/api.ts web/src/components/OnboardingGuidance.tsx web/src/components/OnboardingGuidance.test.tsx
rtk git commit -m "feat: add onboarding guidance component"
```

### Task 3: Wire the shared summary into Home and Account

**Files:**
- Modify: `web/src/routes/index.tsx`
- Modify: `web/src/routes/account.tsx`
- Modify: `web/src/routes/-index.startup.test.tsx`
- Modify: `web/src/routes/-account.test.tsx`

**Interfaces:**
- Consumes: `getOnboardingSummary` and `<OnboardingGuidance>` from Task 2.
- Produces: signed-in Home guidance after its hero and Account compact guidance directly before `<ProfileView isSelf />`.

- [ ] **Step 1: Write the failing route wiring tests**

```tsx
it("does not request or render onboarding guidance when Home is signed out", async () => {
  api.getAuthSnapshot.mockReturnValue(false);
  renderHome();
  expect(api.getOnboardingSummary).not.toHaveBeenCalled();
  expect(screen.queryByText("Connect a library")).not.toBeInTheDocument();
});

it("places the full Home checklist after the signed-in hero and keeps truthful summary loading", async () => {
  api.getOnboardingSummary.mockResolvedValue({ steam_linked: false, psn_library_games: 0, wishlist_games: 0, price_alerts: 0, friends: 0 });
  renderHome();
  expect(await screen.findByText("Connect a library")).toBeInTheDocument();
  expect(screen.getByText("Your dashboard · library and friends are loading")).toBeInTheDocument();
});

it("renders compact owner guidance before ProfileView and retries only onboarding", async () => {
  render(<AccountPage />);
  await waitFor(() => expect(getOnboardingSummary).toHaveBeenCalledTimes(1));
  expect(screen.getByTestId("onboarding-guidance-compact")).toBeInTheDocument();
});
```

Extend the existing hoisted API mocks with `getOnboardingSummary`. For Account, replace the `ProfileView` mock only as needed so the test can compare DOM order or pass the compact guidance through a visible wrapper. Keep the existing account overview assertions intact.

- [ ] **Step 2: Run the focused route tests and verify RED**

Run: `rtk proxy npm.cmd --prefix web test -- --run src/routes/-index.startup.test.tsx src/routes/-account.test.tsx`

Expected: FAIL because neither route imports, queries, nor places onboarding guidance.

- [ ] **Step 3: Add minimal route query wiring and placement**

```tsx
// index.tsx
const onboardingQuery = useQuery({
  queryKey: ["onboarding-summary"],
  queryFn: getOnboardingSummary,
  enabled: signedIn,
});
// immediately after the hero section
{signedIn && <OnboardingGuidance {...onboardingQuery} />}

// account.tsx
const onboardingQuery = useQuery({ queryKey: ["onboarding-summary"], queryFn: getOnboardingSummary });
return <AppShell>
  <OnboardingGuidance compact {...onboardingQuery} />
  <ProfileView isSelf profile={...} />
</AppShell>;
```

Pass only `data`, `isPending`, `isError`, and `refetch` (as `onRetry`) if the component prop contract requires explicit names; do not pass profile, game, friend, or notification payloads. Keep all existing Home queries and their enabled rules unchanged. No route-tree generation should be needed because no route is added.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `rtk proxy npm.cmd --prefix web test -- --run src/routes/-index.startup.test.tsx src/routes/-account.test.tsx src/components/OnboardingGuidance.test.tsx`

Expected: PASS; signed-out Home has no request, both owner surfaces render the appropriate variant, and retry remains scoped to onboarding.

- [ ] **Step 5: Run required final verification**

Run: `rtk pytest`

Expected: PASS.

Run: `rtk proxy npm.cmd --prefix web test -- --run`

Expected: PASS.

Run: `rtk proxy npm.cmd --prefix web run lint`

Expected: PASS.

Run: `rtk proxy npm.cmd --prefix web run build`

Expected: PASS. Inspect `rtk git status --short` afterwards and leave generated `web/src/routeTree.gen.ts` and build output unstaged. No migration exists, so do not run an Alembic upgrade.

- [ ] **Step 6: Commit only Phase 5 implementation files and publish a draft PR**

```powershell
rtk git add app/main.py app/schemas.py tests/integration/backend/test_profile_dashboard_psn_api.py web/src/lib/api.ts web/src/components/OnboardingGuidance.tsx web/src/components/OnboardingGuidance.test.tsx web/src/routes/index.tsx web/src/routes/account.tsx web/src/routes/-index.startup.test.tsx web/src/routes/-account.test.tsx
rtk git commit -m "feat: guide users through onboarding"
rtk git push -u origin codex/onboarding-next-steps-implementation
rtk gh pr create --draft --base main --head codex/onboarding-next-steps-implementation --title "feat: add post-auth onboarding guidance" --body "## Summary\n- add owner-scoped onboarding summary\n- show compact next steps on Home and Account\n\n## Verification\n- pytest\n- web tests\n- web lint\n- web production build"
```

Record the exact commands and successful output in the PR body; do not stage specs, plans, generated files, or unrelated work.

## Plan Self-Review

- **Spec coverage:** Task 1 covers the exact minimal owner-only contract, PSN/Steam condition facts, price-alert ownership, friendships, and 401. Task 2 covers ordered cards, all real routes, complete/loading/error/retry behavior, compact styling, and no local state. Task 3 covers both required locations, signed-out suppression, action navigation, and preservation of Phase 4 Home behavior.
- **Placeholder scan:** No unfinished markers, vague test instructions, undefined public interfaces, external API calls, migrations, or new routes remain.
- **Type consistency:** Backend uses `OnboardingSummaryRead`; frontend mirrors it as `OnboardingSummary`; both route queries use `['onboarding-summary']`; `OnboardingGuidance` receives a summary plus explicit query state.
