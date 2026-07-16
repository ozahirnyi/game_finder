# Lovable Design Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port every screen and the design system from the supplied Lovable prototype into the existing Next.js frontend while retaining the FastAPI-backed behavior.

**Architecture:** Build a small reusable presentation layer inside the existing App Router application, then migrate routes in independent groups. `web/src/lib/api.ts` remains the only backend adapter; prototype mock data is never copied. Routes without an equivalent endpoint render explicit product-state panels instead of invented content.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules-free global CSS, existing FastAPI API client, lucide-react, Vitest + Testing Library.

## Global Constraints

- Work in a fresh `codex/` worktree created from commit `d1bff27`; do not modify the dirty `phase-6` checkout or existing redesign worktrees.
- Preserve public FastAPI contracts and use only functions exported by `web/src/lib/api.ts`.
- Do not run the Lovable Vite/TanStack app in production or copy its mock-data, generated route tree, startup, or error-reporting files.
- Every remote or protected region exposes loading, error, empty, success, and unauthenticated behavior where applicable.
- Use API artwork first, then a CSS-gradient fallback. All interactive controls are keyboard reachable with a visible focus state.
- Use `rtk` before every shell command and `apply_patch` for edits.

## Target File Structure

- `web/src/components/AppShell.tsx` — shared responsive application frame and route navigation.
- `web/src/components/GameCover.tsx` — artwork image with a deterministic gradient fallback.
- `web/src/components/ui.tsx` — focused Button, Panel, StatePanel, Badge, and Section primitives.
- `web/src/components/app-shell.module.css`, `game-cover.module.css`, `ui.module.css` — presentation styles for those components.
- `web/src/hooks/useAuthState.ts` — reactive wrapper around `subscribeToAuthChanges`.
- `web/src/features/*` — route-specific client screens, each using `api.ts` rather than mock data.
- `web/src/app/*/page.tsx` — thin Next route entries that render the matching screen.
- `web/src/app/globals.css` and `web/src/app/layout.tsx` — imported typography/tokens and root shell integration.
- `web/src/test/*` — Vitest setup and API-mocked component/route tests.

---

### Task 1: Isolated frontend test harness and design primitives

**Files:**
- Modify: `web/package.json`, `web/package-lock.json`, `web/src/app/globals.css`, `web/src/app/layout.tsx`
- Create: `web/vitest.config.ts`, `web/src/test/setup.ts`, `web/src/components/ui.tsx`, `web/src/components/ui.module.css`, `web/src/components/GameCover.tsx`, `web/src/components/game-cover.module.css`, `web/src/components/ui.test.tsx`

**Interfaces:**
- Produces: `Button`, `Panel`, `StatePanel`, `Badge`, `Section`, and `GameCover` for every later screen.
- Produces: `renderWithProviders(ui)` and API mocks in `web/src/test/setup.ts` for later tests.

- [ ] **Step 1: Add the failing primitive tests**

```tsx
it('uses an image when artwork is available and a labelled fallback otherwise', () => {
  const { rerender } = render(<GameCover title="Hades II" src="https://cdn.example/hades.jpg" />);
  expect(screen.getByRole('img', { name: 'Hades II' })).toHaveAttribute('src', 'https://cdn.example/hades.jpg');
  rerender(<GameCover title="Hades II" src={null} />);
  expect(screen.getByLabelText('Hades II cover unavailable')).toBeInTheDocument();
});

it('renders error state with an enabled retry action', () => {
  const retry = vi.fn();
  render(<StatePanel kind="error" title="Could not load" action={{ label: 'Retry', onClick: retry }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(retry).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the focused test and confirm red**

Run: `rtk npm test -- ui.test.tsx`

Expected: FAIL because the Vitest script and component modules do not yet exist.

- [ ] **Step 3: Add test tooling and minimal primitive interfaces**

```tsx
export type StatePanelProps = {
  kind: 'loading' | 'error' | 'empty' | 'unauthenticated';
  title: string;
  detail?: string;
  action?: { label: string; onClick: () => void };
};

export function StatePanel({ kind, title, detail, action }: StatePanelProps) {
  return <section data-state={kind}><h2>{title}</h2>{detail && <p>{detail}</p>}{action && <Button onClick={action.onClick}>{action.label}</Button>}</section>;
}

export function GameCover({ title, src }: { title: string; src: string | null }) {
  return src ? <img src={src} alt={title} /> : <div aria-label={`${title} cover unavailable`} role="img" />;
}
```

Add `lucide-react`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, and `jsdom`; wire `npm test` to `vitest run`.

- [ ] **Step 4: Port design tokens and primitive styles**

Copy only the color variables, typography, spacing, focus-visible, card, button, badge, and fallback-gradient rules needed by the new components from the archive’s `src/styles.css`. Ensure `Button` keeps native `button` semantics and no component depends on Tailwind.

- [ ] **Step 5: Run focused tests and frontend static checks**

Run: `rtk npm test -- ui.test.tsx; rtk npm run lint; rtk npx tsc --noEmit --incremental false`

Expected: PASS with zero lint and TypeScript errors.

- [ ] **Step 6: Commit the test harness and primitives**

Run: `rtk git add web/package.json web/package-lock.json web/vitest.config.ts web/src/test web/src/components web/src/app/globals.css web/src/app/layout.tsx; rtk git commit -m "feat: add lovable design primitives"`

### Task 2: Responsive app shell and authentic navigation

**Files:**
- Modify: `web/src/app/layout.tsx`, `web/src/components/Nav.tsx`
- Create: `web/src/components/AppShell.tsx`, `web/src/components/app-shell.module.css`, `web/src/hooks/useAuthState.ts`, `web/src/components/AppShell.test.tsx`

**Interfaces:**
- Consumes: Task 1 `Button`, `Badge`, `Section` and `StatePanel`.
- Produces: `<AppShell>{children}</AppShell>` around every route, and `useAuthState(): boolean`.

- [ ] **Step 1: Write shell behavior tests**

```tsx
it('shows all product destinations and marks the current route', () => {
  renderWithPath('/deals', <AppShell><main>Deals</main></AppShell>);
  expect(screen.getByRole('link', { name: 'Deals' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Friends' })).toHaveAttribute('href', '/friends');
});

it('opens protected destinations only after authentication', () => {
  mockAuth(false);
  renderWithPath('/', <AppShell><main>Home</main></AppShell>);
  expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the shell test and confirm red**

Run: `rtk npm test -- AppShell.test.tsx`

Expected: FAIL because `AppShell` and `useAuthState` are missing.

- [ ] **Step 3: Implement reactive auth and Next navigation shell**

```tsx
export function useAuthState() {
  return useSyncExternalStore(subscribeToAuthChanges, getAuthSnapshot, () => false);
}

const destinations = [
  ['Home', '/'], ['Search', '/search'], ['Library', '/favorites'], ['Wishlist', '/wishlist'],
  ['Deals', '/deals'], ['Friends', '/friends'], ['Steam', '/steam'], ['PSN', '/psn'], ['Profile', '/profile'],
] as const;
```

Use `usePathname` and `next/link`; retain accessible desktop rail, collapsible mobile menu, `aria-current`, focus-visible behavior, and a labelled mobile navigation.

- [ ] **Step 4: Run focused checks and commit**

Run: `rtk npm test -- AppShell.test.tsx; rtk npm run lint; rtk git add web/src/app/layout.tsx web/src/components/Nav.tsx web/src/components/AppShell.tsx web/src/components/app-shell.module.css web/src/hooks/useAuthState.ts web/src/components/AppShell.test.tsx; rtk git commit -m "feat: add responsive lovable app shell"`

### Task 3: Discovery, search, deals, and game-detail screens

**Files:**
- Modify: `web/src/app/page.tsx`, `web/src/app/deals/page.tsx`, `web/src/app/games/[id]/page.tsx`
- Create: `web/src/app/search/page.tsx`, `web/src/features/discovery/DiscoveryScreen.tsx`, `web/src/features/discovery/SearchScreen.tsx`, `web/src/features/discovery/DealsScreen.tsx`, `web/src/features/discovery/GameDetailScreen.tsx`, `web/src/features/discovery/discovery.test.tsx`

**Interfaces:**
- Consumes: `searchGames`, `getUpcomingGames`, `getTrendingGames`, `getHomepageDeals`, `getCatalogGame`, `getGamePriceHistory` from `api.ts` and Task 1 primitives.
- Produces: API-backed discovery routes with `onRetry` callbacks that repeat the failed request.

- [ ] **Step 1: Write failing state tests for every API-backed region**

```tsx
it('renders search results from api.ts and retries a failed request', async () => {
  vi.mocked(searchGames).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ results: [{ id: 1, name: 'Hades II', released: null, background_image: null }] });
  render(<SearchScreen initialQuery="hades" />);
  await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Hades II')).toBeVisible();
});

it('shows the fallback cover when a result has no background image', async () => {
  vi.mocked(getHomepageDeals).mockResolvedValue({ results: [{ id: 1, name: 'Hades II', released: null, background_image: null, url: null, current: null, history_low_all: null }] });
  render(<DealsScreen />);
  expect(await screen.findByLabelText('Hades II cover unavailable')).toBeVisible();
});
```

- [ ] **Step 2: Run the discovery test and confirm red**

Run: `rtk npm test -- discovery.test.tsx`

Expected: FAIL because the new feature modules do not exist.

- [ ] **Step 3: Implement the four screens against the existing client**

Use a local `type RemoteState<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'success'; data: T };` in the feature directory. Fetch in `useEffect`, cancel stale updates, render `StatePanel` for non-success states, and map data to `GameCover`. Preserve existing query-string search behavior and game IDs.

- [ ] **Step 4: Run focused checks and commit**

Run: `rtk npm test -- discovery.test.tsx; rtk npm run lint; rtk npx tsc --noEmit --incremental false; rtk git add web/src/app web/src/features/discovery; rtk git commit -m "feat: port discovery and deals design"`

### Task 4: Library and wishlist workspace

**Files:**
- Modify: `web/src/app/favorites/page.tsx`, `web/src/app/favorites/[id]/page.tsx`
- Create: `web/src/app/wishlist/page.tsx`, `web/src/features/library/LibraryScreen.tsx`, `web/src/features/library/WishlistScreen.tsx`, `web/src/features/library/SavedGameDetailScreen.tsx`, `web/src/features/library/library.test.tsx`

**Interfaces:**
- Consumes: `listSavedGames`, `getSavedGame`, `createSavedGame`, `updateSavedGame`, `deleteSavedGame` and `isAuthenticated` from `api.ts`.
- Produces: `/favorites`, `/favorites/[id]`, and `/wishlist`; wishlist is a saved-game filtered view until a server-side wishlist contract exists.

- [ ] **Step 1: Write failing auth, mutation, and empty-state tests**

```tsx
it('does not call listSavedGames before login', () => {
  mockAuth(false);
  render(<LibraryScreen />);
  expect(listSavedGames).not.toHaveBeenCalled();
  expect(screen.getByText('Sign in to view your library')).toBeVisible();
});

it('removes the deleted game after the API confirms deletion', async () => {
  vi.mocked(listSavedGames).mockResolvedValue([{ id: 'g1', title: 'Hades II', notes: null, info: null, source: 'manual', external_id: null, playtime_forever: null, playtime_2weeks: null, img_icon_url: null, synced_at: null, created_at: '2026-01-01' }]);
  vi.mocked(deleteSavedGame).mockResolvedValue(undefined);
  render(<LibraryScreen />);
  await userEvent.click(await screen.findByRole('button', { name: 'Remove Hades II' }));
  await waitFor(() => expect(screen.queryByText('Hades II')).not.toBeInTheDocument());
});
```

- [ ] **Step 2: Run the library test and confirm red**

Run: `rtk npm test -- library.test.tsx`

Expected: FAIL because the feature screens do not exist.

- [ ] **Step 3: Implement saved-game screens and honest wishlist semantics**

Use `StatePanel` before fetches succeed. `/wishlist` must state that it displays saved games marked with a `wishlist` keyword in notes until a dedicated API exists; it must not copy the prototype’s fake prices, statuses, or games. Keep delete/update failures inline and leave the current item visible after a failed mutation.

- [ ] **Step 4: Run focused checks and commit**

Run: `rtk npm test -- library.test.tsx; rtk npm run lint; rtk git add web/src/app/favorites web/src/app/wishlist web/src/features/library; rtk git commit -m "feat: port library and wishlist design"`

### Task 5: Steam, PSN, profile, and integrations

**Files:**
- Modify: `web/src/app/steam/page.tsx`, `web/src/app/profile/page.tsx`
- Create: `web/src/app/psn/page.tsx`, `web/src/features/integrations/SteamScreen.tsx`, `web/src/features/integrations/PsnScreen.tsx`, `web/src/features/integrations/ProfileScreen.tsx`, `web/src/features/integrations/integrations.test.tsx`

**Interfaces:**
- Consumes: Steam, PSN, Google, and Telegram functions/types exported from `api.ts`.
- Produces: API-backed integration screens; account linking opens only API-returned URLs.

- [ ] **Step 1: Write failing protected-data and action tests**

```tsx
it('shows a sign-in state without requesting Steam data', () => {
  mockAuth(false);
  render(<SteamScreen />);
  expect(getSteamLibrary).not.toHaveBeenCalled();
  expect(screen.getByText('Sign in to connect Steam')).toBeVisible();
});

it('uses the API-provided Telegram link URL', async () => {
  vi.mocked(getTelegramLinkUrl).mockResolvedValue({ configured: true, url: 'https://t.me/example', message: null });
  render(<ProfileScreen />);
  await userEvent.click(screen.getByRole('button', { name: 'Connect Telegram' }));
  expect(window.open).toHaveBeenCalledWith('https://t.me/example', '_blank', 'noopener,noreferrer');
});
```

- [ ] **Step 2: Run the integrations test and confirm red**

Run: `rtk npm test -- integrations.test.tsx`

Expected: FAIL because the feature modules do not exist.

- [ ] **Step 3: Implement screens with endpoint-specific states**

Render real Steam library/social/recommendation data where returned. Keep the Friends navigation route separate (Task 6) because `getSteamSocial` is the only available social source. For PSN, implement preview/confirm import using `previewPsnImport` and `confirmPsnImport`; reset the selected file and preview after a successful import. Profile uses `getCurrentUser`, `getGoogleStatus`, `getTelegramAccount`, plus safe link/unlink/test-alert actions.

- [ ] **Step 4: Run focused checks and commit**

Run: `rtk npm test -- integrations.test.tsx; rtk npm run lint; rtk npx tsc --noEmit --incremental false; rtk git add web/src/app/steam web/src/app/profile web/src/app/psn web/src/features/integrations; rtk git commit -m "feat: port integration screens"`

### Task 6: Friends route and unsupported-product states

**Files:**
- Create: `web/src/app/friends/page.tsx`, `web/src/features/friends/FriendsScreen.tsx`, `web/src/features/friends/friends.test.tsx`

**Interfaces:**
- Consumes: `getSteamSocial` and `SteamSocial` from `api.ts`, plus Task 1 primitives.
- Produces: `/friends` that uses Steam data when linked and transparent empty states for unavailable social features.

- [ ] **Step 1: Write failing social-source tests**

```tsx
it('renders Steam friend results from the social endpoint', async () => {
  vi.mocked(getSteamSocial).mockResolvedValue({ steam: linkedSteam, friends: [friend], top_friend_games: [], public_libraries: 1, private_libraries: 0 });
  render(<FriendsScreen />);
  expect(await screen.findByText(friend.persona_name!)).toBeVisible();
});

it('does not invent prototype friends when Steam is not linked', async () => {
  vi.mocked(getSteamSocial).mockRejectedValue(new ApiError('Steam account is not linked', 400));
  render(<FriendsScreen />);
  expect(await screen.findByText('Connect Steam to see friends')).toBeVisible();
  expect(screen.queryByText('Sasha K.')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the friends test and confirm red**

Run: `rtk npm test -- friends.test.tsx`

Expected: FAIL because the route and screen do not exist.

- [ ] **Step 3: Implement Friends with data-source clarity**

Render `persona_name`, avatar, common-game count, taste match, and top shared games from `SteamSocial`. Use `StatePanel` with a `Connect Steam` link for not-linked responses and an error/retry panel for other failures. Omit prototype activity feed, friend requests, and LFG controls because no API supports them.

- [ ] **Step 4: Run focused checks and commit**

Run: `rtk npm test -- friends.test.tsx; rtk npm run lint; rtk git add web/src/app/friends web/src/features/friends; rtk git commit -m "feat: add API-backed friends screen"`

### Task 7: Authentication screens and route-wide visual convergence

**Files:**
- Modify: `web/src/app/login/page.tsx`, `web/src/app/register/page.tsx`, `web/src/app/auth/callback/page.tsx`, `web/src/app/globals.css`
- Create: `web/src/features/auth/AuthPanel.tsx`, `web/src/features/auth/auth.test.tsx`

**Interfaces:**
- Consumes: `loginUser`, `registerUser`, `getGoogleLoginUrl`, `exchangeGoogleCode`, `setToken` from `api.ts` and Task 1 primitives.
- Produces: visually consistent auth controls without changing token or redirect behavior.

- [ ] **Step 1: Write failing auth UI behavior tests**

```tsx
it('submits credentials and stores the returned token', async () => {
  vi.mocked(loginUser).mockResolvedValue({ access_token: 'token', token_type: 'bearer' });
  render(<AuthPanel mode="login" />);
  await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
  await userEvent.type(screen.getByLabelText('Password'), 'password123');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(setToken).toHaveBeenCalledWith('token');
});
```

- [ ] **Step 2: Run the auth test and confirm red**

Run: `rtk npm test -- auth.test.tsx`

Expected: FAIL because `AuthPanel` does not exist.

- [ ] **Step 3: Implement `AuthPanel` and migrate page entries**

Use a native `<form>` and labelled inputs. On authentication failure, render a `role="alert"` message and retain values. Keep the existing Google-code exchange guards and redirect target; only replace presentation and shared layout.

- [ ] **Step 4: Run focused checks and commit**

Run: `rtk npm test -- auth.test.tsx; rtk npm run lint; rtk git add web/src/app/login web/src/app/register web/src/app/auth web/src/app/globals.css web/src/features/auth; rtk git commit -m "feat: align authentication with lovable design"`

### Task 8: Integration verification and visual QA

**Files:**
- Modify: only files required to fix a verified integration regression.
- Test: all `web/src/**/*.test.tsx`, `tests/`

**Interfaces:**
- Consumes: tasks 1–7 integrated on the same branch.
- Produces: verified design-integration branch ready for user review.

- [ ] **Step 1: Run the full automated suite**

Run: `rtk npm test; rtk npm run lint; rtk npx tsc --noEmit --incremental false; rtk npm run build; rtk pytest -q`

Expected: every command exits 0.

- [ ] **Step 2: Perform visual route QA**

Run the frontend locally and inspect `/`, `/search`, `/favorites`, `/wishlist`, `/deals`, `/friends`, `/steam`, `/psn`, `/profile`, `/games/1`, `/login`, and `/register` at 375 px, 768 px, 1280 px, and 1600 px widths. Confirm navigation, keyboard focus, responsive layout, image fallback, loading/error/empty panels, and no mock names or mock prices appear.

- [ ] **Step 3: Correct only reproducible defects and rerun all checks**

For each defect, first add a failing test in the owning task’s test file, then make the smallest implementation change. Repeat Step 1 until all commands exit 0.

- [ ] **Step 4: Commit verification fixes**

Run: `rtk git add web tests; rtk git commit -m "fix: complete lovable design integration"`

## Parallel Execution Map

- Sequential foundation: Task 1, then Task 2.
- After Task 2, run Tasks 3, 4, and 5 in separate worktrees.
- After Task 5, run Task 6 and Task 7 in separate worktrees; Task 6 may begin after Task 2 if API-client conflicts are avoided.
- Cherry-pick reviewed task commits into the integration branch in order 3, 4, 5, 6, 7.
- Run Task 8 only after all reviewed changes are integrated.

