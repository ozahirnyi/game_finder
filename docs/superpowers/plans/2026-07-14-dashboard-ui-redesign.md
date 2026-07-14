# Game Finder Dashboard UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the search-first collection of screens with a cohesive dashboard application whose Search, Deals, Library, Steam, Friends, and Profile experiences are equally discoverable and fully responsive.

**Architecture:** Keep `app/layout.tsx` and route entry files as Server Component wrappers, and place authentication-aware interaction in narrow Client Component feature screens. Introduce a shared UI layer, one navigation model consumed by desktop/tablet/mobile shells, and focused feature components that continue to call the existing functions in `src/lib/api.ts`.

**Tech Stack:** Next.js 16.2.9 App Router, React 19.2.4, TypeScript 5, CSS Modules, Vitest, Testing Library, jsdom, ESLint.

## Global Constraints

- Preserve the existing black, white, and grey theme; add no new brand colour.
- Preserve every existing backend endpoint and current authentication, Steam, Google, Telegram, PlayStation, prices, saved-game, and recommendation flow.
- Mobile is 320–767 px, tablet is 768–1023 px, and desktop is 1024 px and above.
- Desktop uses a 72 px icon rail and 320 px overlay drawer; tablet uses a 64 px top bar and the same drawer; mobile uses fixed bottom navigation.
- Mobile bottom navigation keeps visible labels, accounts for safe-area insets, and never covers page content.
- Minimum touch target is 44 by 44 CSS pixels; the fixed bottom navigation is at least 64 px high.
- Authentication remains client-side because the current token is stored in `localStorage`.
- Do not infer a durable catalogue ID from fuzzy title search or from parsing the saved record `info` field.
- Steam Friends remains a user-triggered request using the existing bounded `getSteamSocial(12)` payload.
- Every asynchronous region implements explicit loading, error, empty, and content states.
- Run all shell commands through `rtk` as required by `C:\Users\zagir\.codex\RTK.md`.

---

## File structure

```text
web/src/
  app/
    layout.tsx                         server shell wrapper and metadata
    page.tsx                           Dashboard route wrapper
    search/page.tsx                    Search route wrapper
    friends/page.tsx                   Friends route wrapper
    globals.css                        reset, tokens, typography, safe areas
  components/
    ui/Button.tsx
    ui/Button.module.css
    ui/Panel.tsx
    ui/Panel.module.css
    ui/DataRow.tsx
    ui/States.tsx
    layout/AppShell.tsx
    layout/AppShell.module.css
    layout/PageHeader.tsx
    layout/Toolbar.tsx
    navigation/Navigation.client.tsx
    navigation/Navigation.module.css
    navigation/nav-items.ts
  features/
    dashboard/DashboardScreen.client.tsx
    search/SearchScreen.client.tsx
    deals/DealsScreen.client.tsx
    library/LibraryScreen.client.tsx
    steam/SteamScreen.client.tsx
    steam/steam-media.tsx
    friends/FriendsScreen.client.tsx
    profile/ProfileScreen.client.tsx
  test/setup.ts
  test/render.tsx
web/vitest.config.ts
```

Existing dynamic detail routes remain in place and are decomposed only where required by their redesign.

---

### Task 1: Frontend test harness and UI primitives

**Files:**
- Modify: `web/package.json`
- Modify: `web/package-lock.json`
- Create: `web/vitest.config.ts`
- Create: `web/src/test/setup.ts`
- Create: `web/src/components/ui/Button.tsx`
- Create: `web/src/components/ui/Button.module.css`
- Create: `web/src/components/ui/Panel.tsx`
- Create: `web/src/components/ui/Panel.module.css`
- Create: `web/src/components/ui/DataRow.tsx`
- Create: `web/src/components/ui/States.tsx`
- Create: `web/src/components/ui/Button.test.tsx`
- Create: `web/src/components/ui/States.test.tsx`

**Interfaces:**
- Produces: `Button(props: ButtonProps)`, `ButtonLink(props: ButtonLinkProps)`, `IconButton(props: IconButtonProps)`, `Panel`, `DataRow`, `LoadingState`, `EmptyState`, `ErrorState`, and `StatusMessage`.
- Consumes: existing `Icon` names from `web/src/components/Icon.tsx`.

- [ ] **Step 1: Install the test dependencies and add the test script**

Run:

```powershell
rtk npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Add to `web/package.json`:

```json
"test": "vitest run"
```

Expected: `package.json` and `package-lock.json` include the six development dependencies.

- [ ] **Step 2: Configure Vitest**

Create `web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
});
```

Create `web/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Write failing semantic tests for buttons and states**

Create `web/src/components/ui/Button.test.tsx` with assertions that a native button defaults to `type="button"`, a disabled button is disabled, an internal action renders a link, and `IconButton` requires an accessible label. Create `States.test.tsx` with these exact assertions:

```tsx
render(<LoadingState label="Loading library" />);
expect(screen.getByRole("status")).toHaveTextContent("Loading library");

render(<ErrorState message="Could not load" onRetry={() => undefined} />);
expect(screen.getByRole("alert")).toHaveTextContent("Could not load");
expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
```

- [ ] **Step 4: Run the focused tests and confirm failure**

Run:

```powershell
rtk npm test -- src/components/ui/Button.test.tsx src/components/ui/States.test.tsx
```

Expected: FAIL because the UI components do not exist.

- [ ] **Step 5: Implement the primitives**

Use these public types in `Button.tsx`:

```ts
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "compact" | "default";
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};
export type ButtonLinkProps = React.ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};
export type IconButtonProps = Omit<ButtonProps, "children"> & {
  label: string;
  icon: IconName;
};
```

Implement `States.tsx` so loading uses `role="status"`, errors use `role="alert"`, and success feedback uses a polite live region. Keep `Panel` and `DataRow` stateless and slot-based.

- [ ] **Step 6: Verify primitives and commit**

Run:

```powershell
rtk npm test -- src/components/ui
rtk npm run lint
rtk npx tsc --noEmit --incremental false
rtk git add web/package.json web/package-lock.json web/vitest.config.ts web/src/test web/src/components/ui
rtk git commit -m "feat: add shared UI primitives"
```

Expected: tests, ESLint, and TypeScript pass; commit succeeds.

---

### Task 2: Responsive application shell and navigation

**Files:**
- Modify: `web/src/app/layout.tsx`
- Modify: `web/src/app/globals.css`
- Replace: `web/src/components/Nav.tsx`
- Create: `web/src/components/layout/AppShell.tsx`
- Create: `web/src/components/layout/AppShell.module.css`
- Create: `web/src/components/layout/PageHeader.tsx`
- Create: `web/src/components/layout/Toolbar.tsx`
- Create: `web/src/components/navigation/nav-items.ts`
- Create: `web/src/components/navigation/Navigation.client.tsx`
- Create: `web/src/components/navigation/Navigation.module.css`
- Create: `web/src/components/navigation/Navigation.test.tsx`

**Interfaces:**
- Consumes: `getAuthSnapshot`, `subscribeToAuthChanges`, `Icon`, and Task 1 button primitives.
- Produces: `NAV_ITEMS`, `Navigation`, `AppShell`, `PageHeader`, and `Toolbar` used by every later route.

- [ ] **Step 1: Write failing navigation tests**

Test the shared model and drawer behaviour:

```tsx
expect(getVisibleNavItems(false).map((item) => item.label)).toEqual(["Dashboard", "Search", "Deals"]);
expect(getVisibleNavItems(true).map((item) => item.label)).toEqual([
  "Dashboard", "Search", "Deals", "Library", "Steam", "Friends",
]);

await user.click(screen.getByRole("button", { name: "Open navigation" }));
expect(screen.getByRole("dialog", { name: "Navigation" })).toBeVisible();
expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "true");
await user.keyboard("{Escape}");
expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the test and confirm failure**

Run `rtk npm test -- src/components/navigation/Navigation.test.tsx`.

Expected: FAIL because navigation modules do not exist.

- [ ] **Step 3: Implement one navigation model and shell**

Define this model in `nav-items.ts`:

```ts
export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  protected: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "home", protected: false },
  { href: "/search", label: "Search", icon: "search", protected: false },
  { href: "/deals", label: "Deals", icon: "tag", protected: false },
  { href: "/favorites", label: "Library", icon: "bookmark", protected: true },
  { href: "/steam", label: "Steam", icon: "gamepad", protected: true },
  { href: "/friends", label: "Friends", icon: "users", protected: true },
];
```

`Navigation.client.tsx` owns `usePathname`, auth subscription, drawer state, Escape handling, focus restoration, and route-change close. Rail, drawer, and bottom bar consume the same filtered array. Do not render hidden responsive navigation into the tab order.

Extend `IconName` and the `paths` record in `Icon.tsx` with the exact names consumed by the model:

```tsx
// Append these members to the existing IconName union.
| "home"
| "bookmark"
| "users"
| "menu"

home: <path d="M3 11.5 12 4l9 7.5V21h-6v-6H9v6H3v-9.5Z" />,
bookmark: <path d="M6 3h12v18l-6-4-6 4V3Z" />,
users: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87m-2-12a4 4 0 0 1 0 7.75" />,
menu: <path d="M4 7h16M4 12h16M4 17h16" />,
```

- [ ] **Step 4: Implement responsive CSS and accessibility**

Use CSS Module media queries for `767px` and `1023px`. Desktop rail is 72 px; tablet top bar is 64 px; mobile bottom bar is fixed, at least 64 px, and adds safe-area padding. Drawer uses `100vh` followed by `100dvh`, `overscroll-behavior: contain`, a scrim, inert background content, and reduced-motion-safe transitions.

Add `<a className="skip-link" href="#main-content">Skip to main content</a>` and `id="main-content"` in `layout.tsx`.

- [ ] **Step 5: Verify responsive shell and commit**

Run:

```powershell
rtk npm test -- src/components/navigation
rtk npm run lint
rtk npx tsc --noEmit --incremental false
rtk npm run build
rtk git add web/src/app/layout.tsx web/src/app/globals.css web/src/components/Nav.tsx web/src/components/layout web/src/components/navigation
rtk git commit -m "feat: add responsive dashboard shell"
```

Expected: navigation tests, lint, typecheck, and production build pass.

---

### Task 3: Dashboard and Search route migration

**Files:**
- Replace: `web/src/app/page.tsx`
- Create: `web/src/app/search/page.tsx`
- Create: `web/src/features/dashboard/DashboardScreen.client.tsx`
- Create: `web/src/features/dashboard/DashboardScreen.module.css`
- Create: `web/src/features/dashboard/DashboardScreen.test.tsx`
- Create: `web/src/features/search/SearchScreen.client.tsx`
- Create: `web/src/features/search/SearchScreen.module.css`
- Create: `web/src/features/search/SearchScreen.test.tsx`
- Modify: `web/src/components/Icon.tsx`

**Interfaces:**
- Consumes: Task 1 primitives, Task 2 shell, and existing `getTrendingGames`, `getUpcomingGames`, `getHomepageDeals`, `listSavedGames`, `getSteamAccount`, `searchGames`, `getRecommendations`, and `createSavedGame`.
- Produces: Dashboard at `/` and query-restorable Search at `/search?mode=title&q=Hades`.

- [ ] **Step 1: Extract the current Search behaviour without visual changes**

Move the current page logic into `SearchScreen.client.tsx`, then make `/search/page.tsx` a Server Component wrapper:

```tsx
export const metadata = { title: "Search | Game Finder" };

export default function SearchPage() {
  return <SearchScreen />;
}
```

Do not change API calls, recommendation matching, save behaviour, or auth handling in this step.

- [ ] **Step 2: Write failing Dashboard and Search tests**

Mock API functions and assert independent Dashboard regions and URL-backed Search mode:

```tsx
expect(await screen.findByRole("heading", { name: "Your games at a glance" })).toBeVisible();
expect(screen.getByRole("link", { name: "Open Search" })).toHaveAttribute("href", "/search");

expect(screen.getByRole("button", { name: "AI search" })).toHaveAttribute("aria-pressed", "true");
expect(screen.getByRole("searchbox", { name: "Search games" })).toHaveValue("cozy games");
```

- [ ] **Step 3: Run focused tests and confirm failure**

Run `rtk npm test -- src/features/dashboard src/features/search`.

Expected: FAIL until the new Dashboard and URL-backed Search are implemented.

- [ ] **Step 4: Implement Dashboard and redesign Search**

Dashboard loads Trending, Upcoming, Deals, and authenticated summaries independently. It never calls AI or `getSteamSocial` automatically. Use Save or Add to watchlist copy for upcoming games.

Search reads `mode` and `q` from `useSearchParams` inside a `Suspense` boundary. A monotonically increasing request ID prevents late title/AI responses from replacing newer results. Title and AI modes share the toolbar and game-card actions.

- [ ] **Step 5: Verify routes and commit**

Run:

```powershell
rtk npm test -- src/features/dashboard src/features/search
rtk npm run lint
rtk npx tsc --noEmit --incremental false
rtk npm run build
rtk git add web/src/app/page.tsx web/src/app/search web/src/features/dashboard web/src/features/search web/src/components/Icon.tsx
rtk git commit -m "feat: add dashboard and dedicated search"
```

Expected: focused tests and all static checks pass.

---

### Task 4: Deals, game detail, and authentication surfaces

**Files:**
- Modify: `web/src/app/deals/page.tsx`
- Create: `web/src/features/deals/DealsScreen.client.tsx`
- Create: `web/src/features/deals/DealsScreen.module.css`
- Create: `web/src/features/deals/DealsScreen.test.tsx`
- Modify: `web/src/app/games/[id]/page.tsx`
- Create: `web/src/app/games/[id]/GameDetail.module.css`
- Modify: `web/src/app/login/page.tsx`
- Modify: `web/src/app/register/page.tsx`
- Modify: `web/src/app/auth/callback/page.tsx`
- Create: `web/src/features/auth/AuthShell.tsx`
- Create: `web/src/features/auth/LoginScreen.client.tsx`
- Create: `web/src/features/auth/RegisterScreen.client.tsx`
- Create: `web/src/features/auth/OAuthCallbackScreen.client.tsx`
- Create: `web/src/features/auth/AuthForm.module.css`
- Create: `web/src/features/auth/AuthScreens.test.tsx`

**Interfaces:**
- Consumes: Task 1 UI components and all current Deals, price, catalog, saved-game, OAuth, and session API functions.
- Produces: independent public/personal Deals states, shared action hierarchy on detail, and unified auth forms.

- [ ] **Step 1: Write failing Deals tests**

Assert that a public deals success remains visible when saved-game pricing fails, and that guest copy links to Login:

```tsx
expect(await screen.findByText("Popular games on sale now")).toBeVisible();
expect(screen.getByRole("alert")).toHaveTextContent("Could not load saved-game prices");
expect(screen.getByRole("link", { name: "Log in to compare saved games" })).toHaveAttribute("href", expect.stringContaining("/login"));
```

- [ ] **Step 2: Run the Deals test and confirm failure**

Run `rtk npm test -- src/features/deals/DealsScreen.test.tsx`.

Expected: FAIL because the extracted screen and independent errors do not exist.

- [ ] **Step 3: Implement Deals and detail redesign**

Extract current data flow into `DealsScreen.client.tsx`. Keep public and personalised loading/error state separate. Preserve store links, discounts, historical low, and current price.

Redesign game detail with `PageHeader`, `Panel`, shared buttons, explicit region copy, `aria-expanded`/`aria-controls` on description, and unchanged price/store calls.

- [ ] **Step 4: Write failing authentication-surface tests**

Create `AuthScreens.test.tsx` and assert credential labels, the six-character registration minimum, independent Google/Steam actions, callback progress, invalid exchange-code error, token storage, and redirects:

```tsx
expect(screen.getByRole("textbox", { name: "Email" })).toBeVisible();
expect(screen.getByLabelText("Password")).toHaveAttribute("minLength", "6");
expect(screen.getByRole("button", { name: "Continue with Google" })).toBeVisible();
expect(screen.getByRole("button", { name: "Continue with Steam" })).toBeVisible();
```

Run `rtk npm test -- src/features/auth/AuthScreens.test.tsx`.

Expected: FAIL because the shared auth screens do not exist.

- [ ] **Step 5: Unify Login, Register, and callback states**

Use one form surface and Task 1 states. Preserve email/password, Google, Steam, password length, exchange-code, token storage, and redirect behaviour. Give every route unique metadata through a Server Component wrapper where `useSearchParams` requires a nested Client Component.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
rtk npm test -- src/features/deals src/features/auth
rtk npm run lint
rtk npx tsc --noEmit --incremental false
rtk npm run build
rtk git add web/src/app/deals web/src/features/deals web/src/app/games web/src/app/login web/src/app/register web/src/app/auth web/src/features/auth
rtk git commit -m "feat: redesign commerce and auth screens"
```

Expected: tests and static checks pass, and all external links retain `target="_blank" rel="noreferrer"`.

---

### Task 5: Library workspace

**Files:**
- Modify: `web/src/app/favorites/page.tsx`
- Modify: `web/src/app/favorites/[id]/page.tsx`
- Create: `web/src/features/library/LibraryScreen.client.tsx`
- Create: `web/src/features/library/LibraryScreen.module.css`
- Create: `web/src/features/library/SavedGameRow.tsx`
- Create: `web/src/features/library/LibraryScreen.test.tsx`

**Interfaces:**
- Consumes: `listSavedGames`, `getSavedGame`, `updateSavedGame`, `deleteSavedGame`, `searchGames`, and shared `DataRow`/states.
- Produces: protected Library at the existing `/favorites` contract and preserved `/favorites/[id]` detail.

- [ ] **Step 1: Write failing Library interaction tests**

Cover auth redirect, source filtering, notes mutation, deletion, and row/action semantics:

```tsx
expect(screen.getByRole("heading", { name: "Library" })).toBeVisible();
await user.selectOptions(screen.getByLabelText("Source"), "steam");
expect(screen.getByText("Steam Game")).toBeVisible();
expect(screen.queryByText("PSN Game")).not.toBeInTheDocument();
expect(screen.getByRole("link", { name: "Open Steam Game" })).not.toContainElement(
  screen.getByRole("button", { name: "Delete Steam Game" }),
);
```

- [ ] **Step 2: Run the test and confirm failure**

Run `rtk npm test -- src/features/library/LibraryScreen.test.tsx`.

Expected: FAIL because the new toolbar and semantic row do not exist.

- [ ] **Step 3: Implement the Library screen**

Keep `/favorites` as the URL. Add query, source filter, and sort above compact rows. Make title/detail navigation and row actions separate targets. Keep image enrichment best-effort and show deterministic initials when matching fails. Preserve notes limits, delete, dates, source, and playtime.

- [ ] **Step 4: Redesign saved-game detail and verify**

Use shared panels/buttons, keep delete and back navigation, and do not treat saved IDs as catalogue IDs.

Run:

```powershell
rtk npm test -- src/features/library
rtk npm run lint
rtk npx tsc --noEmit --incremental false
rtk npm run build
rtk git add web/src/app/favorites web/src/features/library
rtk git commit -m "feat: redesign the game library"
```

Expected: tests, lint, typecheck, and build pass.

---

### Task 6: Steam tabs and Friends master-detail route

**Files:**
- Modify: `web/src/app/steam/page.tsx`
- Create: `web/src/features/steam/SteamScreen.client.tsx`
- Create: `web/src/features/steam/SteamScreen.module.css`
- Create: `web/src/features/steam/steam-media.tsx`
- Create: `web/src/features/steam/SteamScreen.test.tsx`
- Create: `web/src/app/friends/page.tsx`
- Create: `web/src/features/friends/FriendsScreen.client.tsx`
- Create: `web/src/features/friends/FriendsScreen.module.css`
- Create: `web/src/features/friends/FriendsScreen.test.tsx`

**Interfaces:**
- Consumes: every current Steam function, `getSteamSocial(12)`, Task 1 components, and shared `SteamAvatar`, `SteamGameIcon`, `formatPlaytime` exported by `steam-media.tsx`.
- Produces: Steam tabs `overview | recommendations | library` and user-triggered Friends master-detail.

- [ ] **Step 1: Extract shared Steam media without behaviour changes**

Move these exact exports into `steam-media.tsx`:

```ts
export function formatPlaytime(minutes: number): string;
export function steamIconUrl(game: SteamGameIconSource): string | null;
export function SteamAvatar(props: SteamAvatarProps): React.ReactNode;
export function SteamGameIcon(props: { game: SteamGameIconSource }): React.ReactNode;
```

Update Steam to import them and run `rtk npm run lint` before changing layout.

- [ ] **Step 2: Write failing Steam and Friends tests**

Steam tests assert tab selection, connect/disconnect, sync, AI generation, save recommendation, and sync warning copy. Friends tests assert no social call before Load friends, bounded request after click, friend selection, private state, and mobile Back:

```tsx
expect(getSteamSocial).not.toHaveBeenCalled();
await user.click(screen.getByRole("button", { name: "Load friends" }));
expect(getSteamSocial).toHaveBeenCalledWith(12);
await user.click(await screen.findByRole("button", { name: "Open Alex" }));
expect(screen.getByRole("heading", { name: "Alex" })).toBeVisible();
```

- [ ] **Step 3: Run focused tests and confirm failure**

Run `rtk npm test -- src/features/steam src/features/friends`.

Expected: FAIL because tabs, route, and master-detail do not exist.

- [ ] **Step 4: Implement Steam tabs**

Preserve auth/callback notices, account connect/unlink, sync, stats, top 20/show more, prompt, AI recommendations, image matching, and save. Replace `<details>` with controlled tabs. Remove full Friends rendering and add a summary link to `/friends`. Explain sync removal semantics next to Refresh library.

- [ ] **Step 5: Implement Friends route**

The route starts with account/connect or Load friends state. After `getSteamSocial(12)`, desktop/tablet show searchable list and selected detail. Mobile shows list first and a Back to friends control in detail. Keep public/private counts, `top_friend_games`, shared games, top games, closest available match, refresh, and disconnected states.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
rtk npm test -- src/features/steam src/features/friends
rtk npm run lint
rtk npx tsc --noEmit --incremental false
rtk npm run build
rtk git add web/src/app/steam web/src/app/friends web/src/features/steam web/src/features/friends
rtk git commit -m "feat: split Steam and Friends workspaces"
```

Expected: all focused tests and static checks pass.

---

### Task 7: Profile settings and integration flows

**Files:**
- Modify: `web/src/app/profile/page.tsx`
- Create: `web/src/features/profile/ProfileScreen.client.tsx`
- Create: `web/src/features/profile/ProfileScreen.module.css`
- Create: `web/src/features/profile/ProfileScreen.test.tsx`

**Interfaces:**
- Consumes: current user, Steam account, Telegram link/test/unlink, PSN preview/confirm, Library refresh, and Task 1/2 components.
- Produces: settings sections `account | connections | notifications | imports` with preserved flows.

- [ ] **Step 1: Write failing Profile tests**

Assert section navigation and independent service errors:

```tsx
await user.click(screen.getByRole("button", { name: "Notifications" }));
expect(screen.getByRole("heading", { name: "Telegram alerts" })).toBeVisible();
await user.click(screen.getByRole("button", { name: "Imports" }));
expect(screen.getByLabelText("Choose PlayStation Excel export")).toHaveAttribute("type", "file");
```

Also assert that a failed Telegram request is shown as an error rather than as Not connected.

- [ ] **Step 2: Run the test and confirm failure**

Run `rtk npm test -- src/features/profile/ProfileScreen.test.tsx`.

Expected: FAIL because settings navigation and semantic file input do not exist.

- [ ] **Step 3: Implement Profile settings**

Keep client auth redirect, current email, logout, Steam status, Telegram connect/test/disconnect, PSN instructions, preview, confirm, and Library refresh. Remove the duplicated Library preview. Use a visible button associated with a focusable file input; do not use `aria-disabled` on a label as disabled semantics. Service rows own separate busy/error/success state.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
rtk npm test -- src/features/profile
rtk npm run lint
rtk npx tsc --noEmit --incremental false
rtk npm run build
rtk git add web/src/app/profile web/src/features/profile
rtk git commit -m "feat: redesign profile settings"
```

Expected: tests and static checks pass.

---

### Task 8: CSS cleanup, accessibility audit, and full visual verification

**Files:**
- Modify: `web/src/app/globals.css`
- Modify: any CSS Module created in Tasks 1–7 that fails responsive verification
- Modify: `docs/superpowers/specs/2026-07-14-dashboard-ui-redesign-design.md` only if implementation exposes a genuine documented constraint

**Interfaces:**
- Consumes: every route and component from Tasks 1–7.
- Produces: a clean global token/reset layer and verified release candidate.

- [ ] **Step 1: Remove obsolete global page selectors**

Delete rules no longer referenced by `rg` results. Keep only tokens, reset, typography, focus, reduced motion, forced colours, skip link, and global page canvas rules. Do not keep duplicate `.profile-dashboard`, `.steam-*`, `.nav-*`, or late “cohesion pass” overrides after their screens move to CSS Modules.

- [ ] **Step 2: Run the complete automated gate**

Run:

```powershell
rtk npm test
rtk npm run lint
rtk npx tsc --noEmit --incremental false
rtk npm run build
rtk pytest -q
```

Expected: all frontend tests, lint, TypeScript, production build, and backend tests pass.

- [ ] **Step 3: Run production-mode route smoke checks**

Run `rtk npm run start` after the production build and verify Dashboard, Search, Deals, game detail, Library, saved-game detail, Steam, Friends, Profile, Login, Register, and callback states. Check authenticated, unauthenticated, and expired-token navigation.

- [ ] **Step 4: Verify the responsive matrix visually**

Use the in-app browser at 1440×900, 1024×768, 768×1024, 390×844, and 320×568. At each size confirm no horizontal page scroll, no content under fixed navigation, usable long labels, local scrolling inside drawers, and correct list-to-detail Friends behaviour. Spot-check landscape and 200% zoom.

- [ ] **Step 5: Verify accessibility interactions**

Keyboard-check skip link, rail tooltips, drawer trigger, focus trap, Escape, focus restoration, route-change close, visible focus, bottom-nav labels, tab semantics, file input, description expansion, async live regions, and reduced motion. Confirm only one responsive navigation is in the tab order.

- [ ] **Step 6: Review and commit the verified redesign**

Run:

```powershell
rtk git diff --check
rtk git status --short
rtk git add web docs/superpowers/specs/2026-07-14-dashboard-ui-redesign-design.md
rtk git commit -m "chore: finish dashboard UI redesign"
```

Expected: no whitespace errors, only intended files staged, and final commit succeeds.
