# Auth, Mobile Navigation, and Friends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore provider OAuth, expose every mobile destination through a corner menu drawer, and let users incrementally load every Steam friend.

**Architecture:** The active application is the TanStack/Vite tree under `web/src/routes`; the legacy Next tree is reference-only. OAuth routes reuse the existing API client and token event contract. Steam social pagination is carried from the backend schema through the client type into a stateful Friends screen. Mobile navigation remains owned by the shared TanStack `AppShell`.

**Tech Stack:** FastAPI, Pydantic, httpx, React 19, TanStack Router, TypeScript, Tailwind CSS, Vitest, Testing Library, pytest.

## Global Constraints

- Keep existing backend OAuth URLs and exchange contracts unchanged.
- The phone UI has a menu button in the upper screen corner; it opens a labelled side drawer containing every destination.
- The mobile drawer closes on destination selection, scrim click, Escape, and its close control.
- Friends are loaded in bounded pages; the count represents the full Steam-friend total and `Показать ещё` appends later pages.
- Preserve explicit loading, error, empty, and unlinked-Steam states.
- Preserve unrelated dirty worktree changes and edit files only with `apply_patch`.

---

### Task 1: Restore OAuth in TanStack routes

**Files:**
- Create: `web/src/routes/login.tsx`
- Create: `web/src/routes/register.tsx`
- Create: `web/src/routes/auth/callback.tsx`
- Create: `web/src/routes/auth.test.tsx`
- Modify: `web/src/routes/profile.tsx`
- Modify: `web/src/routeTree.gen.ts`

**Interfaces:**
- Consumes: `getGoogleStatus(): Promise<{ configured: boolean }>`, `getGoogleLoginUrl(): Promise<{ url: string }>`, `getSteamSignInUrl(): Promise<{ url: string }>`, `exchangeGoogleCode(code)`, `exchangeSteamCode(code)`, `getGoogleLinkUrl()`, and `setToken(token)` from `web/src/lib/api.ts`.
- Produces: `/login`, `/register`, and `/auth/callback` file routes; Google and Steam provider controls that navigate to the server supplied URL; callback token persistence followed by `/profile` navigation.

- [ ] **Step 1: Write failing route tests**

```tsx
it("starts configured Google and Steam sign-in from /login", async () => {
  mockedApi.getGoogleStatus.mockResolvedValue({ configured: true });
  mockedApi.getGoogleLoginUrl.mockResolvedValue({ url: "https://google.example" });
  mockedApi.getSteamSignInUrl.mockResolvedValue({ url: "https://steam.example" });
  renderRoute("/login");
  await userEvent.click(await screen.findByRole("button", { name: /google/i }));
  expect(window.location.assign).toHaveBeenCalledWith("https://google.example");
});

it("exchanges a Steam callback once, stores the token, and redirects", async () => {
  mockedApi.exchangeSteamCode.mockResolvedValue({ access_token: "token", token_type: "bearer" });
  renderRoute("/auth/callback?provider=steam&exchange_code=code");
  await waitFor(() => expect(mockedApi.setToken).toHaveBeenCalledWith("token"));
  expect(router.navigate).toHaveBeenCalledWith({ to: "/profile", replace: true });
});
```

- [ ] **Step 2: Run the OAuth test file to verify it fails**

Run: `rtk npx vitest run src/routes/auth.test.tsx`

Expected: FAIL because the TanStack route components do not exist.

- [ ] **Step 3: Implement minimal TanStack route components and profile linking**

```tsx
const navigate = useNavigate();
const search = Route.useSearch();
const provider = search.provider;
const code = search.exchange_code;

useEffect(() => {
  if (!code || (provider !== "google" && provider !== "steam")) return;
  const exchange = provider === "steam" ? exchangeSteamCode : exchangeGoogleCode;
  exchange(code)
    .then(({ access_token }) => {
      setToken(access_token);
      navigate({ to: "/profile", replace: true });
    })
    .catch(() => setMessage("Sign-in expired. Please try again."));
}, [code, navigate, provider]);
```

Use the same controlled email/password form behavior as `web/src/features/auth/AuthPanel.tsx`, but import TanStack `Link` and `useNavigate`. Use `window.location.assign((await getGoogleLoginUrl()).url)` and the analogous Steam helper. Disable Google only when its status says `configured: false`; display a readable provider error on request failures. Replace only the Google integration's decorative Profile connect action with `window.location.assign((await getGoogleLinkUrl()).url)`.

- [ ] **Step 4: Regenerate the route tree and verify the focused tests pass**

Run: `rtk npm run build`

Expected: exit 0 and `web/src/routeTree.gen.ts` contains the three new routes.

Run: `rtk npx vitest run src/routes/auth.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the isolated OAuth task**

Run: `rtk git add web/src/routes/login.tsx web/src/routes/register.tsx web/src/routes/auth/callback.tsx web/src/routes/auth.test.tsx web/src/routes/profile.tsx web/src/routeTree.gen.ts`

Run: `rtk git commit -m "feat: restore OAuth routes"`

Expected: a commit containing only Task 1 files.

### Task 2: Replace phone bottom navigation with a corner-menu drawer

**Files:**
- Modify: `web/src/components/AppShell.tsx`
- Modify: `web/src/components/AppShell.test.tsx`

**Interfaces:**
- Consumes: existing `nav` destinations and TanStack `Link`/`useRouterState`.
- Produces: an accessible mobile menu button and a labelled drawer with all `nav` destinations, with no fixed mobile bottom navigation.

- [ ] **Step 1: Write the failing mobile-drawer test**

```tsx
it("opens every destination from the phone corner menu and closes after navigation", async () => {
  render(<AppShell><p>Dashboard</p></AppShell>);
  await userEvent.click(screen.getByRole("button", { name: /open menu/i }));
  const drawer = screen.getByRole("navigation", { name: /mobile navigation/i });
  expect(within(drawer).getByRole("link", { name: "Friends" })).toHaveAttribute("href", "/friends");
  expect(within(drawer).getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile");
  await userEvent.click(within(drawer).getByRole("link", { name: "Profile" }));
  expect(screen.queryByRole("navigation", { name: /mobile navigation/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the AppShell test to verify it fails**

Run: `rtk npx vitest run src/components/AppShell.test.tsx`

Expected: FAIL because the existing shell has no labelled corner-menu drawer.

- [ ] **Step 3: Implement the mobile drawer state and close behavior**

```tsx
const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

<button aria-label="Open menu" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)}>
  <Menu aria-hidden="true" />
</button>
{mobileMenuOpen && (
  <div className="fixed inset-0 z-50 lg:hidden">
    <button aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
    <nav aria-label="Mobile navigation" className="relative h-full w-72 bg-surface p-6">
      {nav.map((item) => <Link key={item.to} to={item.to} onClick={() => setMobileMenuOpen(false)}>{item.label}</Link>)}
    </nav>
  </div>
)}
```

Replace the mobile Bell-only action with the corner menu trigger. Remove the fixed bottom `<nav>` and the mobile-only `pb-28` compensation. Add an Escape keyboard listener while the drawer is open and return focus to the opener after all close paths. The desktop sidebar remains unchanged.

- [ ] **Step 4: Run the focused test and the frontend build**

Run: `rtk npx vitest run src/components/AppShell.test.tsx`

Expected: PASS.

Run: `rtk npm run build`

Expected: exit 0.

- [ ] **Step 5: Commit the isolated navigation task**

Run: `rtk git add web/src/components/AppShell.tsx web/src/components/AppShell.test.tsx`

Run: `rtk git commit -m "fix: open mobile navigation from corner menu"`

Expected: a commit containing only Task 2 files.

### Task 3: Paginate real Steam friends in the redesigned screen

**Files:**
- Modify: `app/steam.py`
- Modify: `app/main.py`
- Modify: `app/schemas.py`
- Modify: `tests/test_api_contracts.py`
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/routes/friends.tsx`
- Create: `web/src/routes/friends.test.tsx`

**Interfaces:**
- Produces backend `GET /steam/social?friends_limit=<1..24>&friends_offset=<>=0>` response fields `friends_total: int` and `friends_has_more: bool`.
- Produces client `getSteamSocial(friendsLimit: number, friendsOffset: number): Promise<SteamSocial>` where `SteamSocial` contains `friends_total` and `friends_has_more`.
- Consumes the response in `FriendsPage` with append-only page state keyed by the current Steam account.

- [ ] **Step 1: Write failing backend and UI pagination tests**

```python
def test_steam_social_reports_total_and_next_page(monkeypatch):
    monkeypatch.setattr(main, "fetch_steam_friends", AsyncMock(return_value=(3, [{"steam_id": "friend-2"}])))
    response = client.get("/steam/social?friends_limit=1&friends_offset=1")
    assert response.status_code == 200
    assert response.json()["friends_total"] == 3
    assert response.json()["friends_has_more"] is True
```

```tsx
it("shows the full friend count and appends a later page", async () => {
  mockedApi.getSteamSocial
    .mockResolvedValueOnce({ ...firstPage, friends_total: 3, friends_has_more: true })
    .mockResolvedValueOnce({ ...secondPage, friends_total: 3, friends_has_more: false });
  renderRoute("/friends");
  expect(await screen.findByText(/3 friends/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /показать ещё/i }));
  expect(await screen.findByText("Third friend")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run both new tests to verify they fail**

Run: `rtk pytest -q tests/test_api_contracts.py -k steam_social`

Expected: FAIL because the API has no offset, total, or has-more contract.

Run: `rtk npx vitest run src/routes/friends.test.tsx`

Expected: FAIL because Friends renders mock data only.

- [ ] **Step 3: Implement bounded offset pagination and real Friends data**

```python
async def fetch_steam_friends(steam_id: str, limit: int = 24, offset: int = 0) -> tuple[int, list[dict[str, Any]]]:
    sorted_friends = sorted(friends, key=lambda item: item.get("friend_since") or 0, reverse=True)
    selected = sorted_friends[offset:offset + limit]
    return len(sorted_friends), normalized_selected

return SteamSocialRead(
    **build_steam_social_response(...).model_dump(),
    friends_total=friends_total,
    friends_has_more=friends_offset + len(friends) < friends_total,
)
```

Validate `friends_limit` from 1 through 24 and `friends_offset >= 0`. Continue enriching only the selected page's libraries. Extend `SteamSocialRead` and the TypeScript `SteamSocial` type with `friends_total` and `friends_has_more`; encode both query values in `getSteamSocial`.

In the route, request the first page on mount, render total count from `friends_total`, and append later `friends` on `Показать ещё`. Disable the button while that request is active. For HTTP 409, show `Connect Steam first`; show a retry action for other request errors; show an empty state only after a successful response with `friends_total === 0`. Do not derive friend rows, count, or loading state from `mockData`.

- [ ] **Step 4: Run focused and regression checks**

Run: `rtk pytest -q tests/test_api_contracts.py -k steam_social`

Expected: PASS.

Run: `rtk npx vitest run src/routes/friends.test.tsx`

Expected: PASS.

Run: `rtk npm run build`

Expected: exit 0.

- [ ] **Step 5: Commit the isolated Steam friends task**

Run: `rtk git add app/steam.py app/main.py app/schemas.py tests/test_api_contracts.py web/src/lib/api.ts web/src/routes/friends.tsx web/src/routes/friends.test.tsx`

Run: `rtk git commit -m "feat: paginate Steam friends"`

Expected: a commit containing only Task 3 files.

## Final verification

- [ ] Run `rtk pytest -q` from the repository root; expect exit 0.
- [ ] Run `rtk npx vitest run` from `web`; expect exit 0.
- [ ] Run `rtk npm run lint` from `web`; expect exit 0.
- [ ] Run `rtk npm run build` from `web`; expect exit 0.
- [ ] Inspect the integrated diff to confirm it excludes generated `web/.output` files and unrelated user changes.
