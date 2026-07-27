# Public Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give guests a useful searchable, region-aware deals homepage while keeping an authenticated user’s personal dashboard, and apply accessible shared motion throughout the app.

**Architecture:** Keep the root route as a thin auth-state switch. Extract guest discovery, authenticated dashboard, Steam onboarding, regional-deals state, and motion styles into focused components. Public deals use the existing unauthenticated `GET /prices/deals` endpoint; only the authenticated path calls `/steam/me` to decide whether to show the dashboard or onboarding.

**Tech Stack:** React 19, TypeScript, TanStack Router/Start, Tailwind CSS 4, Vitest, Testing Library, FastAPI public deals endpoint.

## Global Constraints

- Work from a dedicated `codex/<task-name>` branch; preserve the pre-existing untracked `docs/superpowers/plans/2026-07-22-production-web-release.md`.
- Every shell command must start with `rtk`; use `rtk rg` for constrained searches and `rtk read` for file inspection.
- Do not add dependencies. Use the installed React, TanStack Router, Tailwind, and Lucide packages.
- Keep `/prices/deals` public; never send an Authorization header on the guest path.
- Region is automatic from `navigator.language`, manually selectable, and falls back to `US`/USD when the detected region request fails.
- Respect `prefers-reduced-motion: reduce`; it disables transform, shimmer, pulse, and route-entry animation.
- Do not leave active route files importing `@/lib/mockData`.

---

## Target file structure

- Create `web/src/features/home/region.ts`: pure region normalization, browser-language detection, and fallback decision helpers.
- Create `web/src/features/home/PublicDeals.tsx`: public deal fetch lifecycle, selector, skeleton, fallback notice, retry, and cards.
- Create `web/src/features/home/GuestHome.tsx`: search-first hero and public discovery composition.
- Create `web/src/features/home/SteamConnectPrompt.tsx`: authenticated no-Steam state.
- Create `web/src/features/home/PersonalDashboard.tsx`: authenticated Steam-linked dashboard, initially moving the current root dashboard markup out of the route.
- Create `web/src/features/home/HomeScreen.tsx`: root view selector driven by `useAuthState()` and `getSteamAccount()`.
- Create `web/src/features/home/home.test.tsx`: behavioral tests for guest/public deals, fallback, authenticated loading, onboarding, and dashboard selection.
- Modify `web/src/routes/index.tsx`: metadata and `AppShell` wrapper only.
- Modify `web/src/components/AppShell.tsx`: use auth state instead of prototype identity; expose public navigation and sign-in/profile affordance without mock data.
- Modify `web/src/styles.css`: shared entry, card, skeleton, and reduced-motion rules.
- Modify `web/src/test/routes.integration.test.ts`: keep the active-route mock-data guard passing for the root route.

## Interfaces

```ts
// web/src/features/home/region.ts
export const FALLBACK_REGION = "US" as const;
export function countryFromLanguage(language: string | undefined): string;
export function initialCountry(): string;
export function shouldFallbackToUsd(country: string): boolean;

// web/src/features/home/PublicDeals.tsx
export function PublicDeals({ initialCountry, limit }: {
  initialCountry: string;
  limit: number;
}): React.ReactElement;

// web/src/features/home/HomeScreen.tsx
export function HomeScreen(): React.ReactElement;
```

### Task 1: Add pure region selection and its tests

**Files:**
- Create: `web/src/features/home/region.ts`
- Create: `web/src/features/home/region.test.ts`

**Consumes:** Browser locale strings such as `uk-UA`, `en-US`, and invalid values.

**Produces:** A validated two-letter country code used by `PublicDeals`; `US` is the one deterministic fallback.

- [ ] **Step 1: Write failing region tests**

```ts
import { describe, expect, it } from "vitest";
import { FALLBACK_REGION, countryFromLanguage, shouldFallbackToUsd } from "./region";

describe("homepage region", () => {
  it("uses the locale country portion when it is a two-letter code", () => {
    expect(countryFromLanguage("uk-UA")).toBe("UA");
  });

  it("falls back to US for language-only or malformed locale values", () => {
    expect(countryFromLanguage("uk")).toBe(FALLBACK_REGION);
    expect(countryFromLanguage("not_a_locale")).toBe(FALLBACK_REGION);
  });

  it("does not repeat the USD fallback request", () => {
    expect(shouldFallbackToUsd("UA")).toBe(true);
    expect(shouldFallbackToUsd("US")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk npm --prefix web test -- region.test.ts`

Expected: FAIL because `./region` does not exist.

- [ ] **Step 3: Implement the pure helper**

```ts
export const FALLBACK_REGION = "US" as const;

export function countryFromLanguage(language: string | undefined): string {
  const match = language?.match(/[-_]([a-z]{2})$/i);
  return match ? match[1].toUpperCase() : FALLBACK_REGION;
}

export function initialCountry(): string {
  return typeof navigator === "undefined"
    ? FALLBACK_REGION
    : countryFromLanguage(navigator.language);
}

export function shouldFallbackToUsd(country: string): boolean {
  return country.toUpperCase() !== FALLBACK_REGION;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `rtk npm --prefix web test -- region.test.ts`

Expected: PASS with three tests.

- [ ] **Step 5: Commit**

Run:

```text
rtk git add web/src/features/home/region.ts web/src/features/home/region.test.ts
rtk git commit -m "feat: resolve homepage deal region"
```

### Task 2: Build and test the public deals module

**Files:**
- Create: `web/src/features/home/PublicDeals.tsx`
- Create: `web/src/features/home/PublicDeals.test.tsx`

**Consumes:** `getHomepageDeals(country, pageSize)` from `web/src/lib/api.ts` and region helpers from Task 1.

**Produces:** A public `Price drops` section with four states: skeleton, populated, empty, and retryable error; a failed non-US request transparently retries with `US` once.

- [ ] **Step 1: Write failing public-deals tests**

```tsx
vi.mock("@/lib/api", () => ({ getHomepageDeals: vi.fn() }));

it("loads public deals without authentication and renders a deal", async () => {
  vi.mocked(getHomepageDeals).mockResolvedValue({ results: [deal] });
  render(<PublicDeals initialCountry="UA" limit={3} />);
  expect(screen.getByLabelText("Loading price drops")).toBeVisible();
  expect(await screen.findByText("Hades II")).toBeVisible();
  expect(getHomepageDeals).toHaveBeenCalledWith("UA", 3);
});

it("retries the detected region once in US after an error", async () => {
  vi.mocked(getHomepageDeals).mockRejectedValueOnce(new Error("UA unavailable"))
    .mockResolvedValueOnce({ results: [deal] });
  render(<PublicDeals initialCountry="UA" limit={3} />);
  expect(await screen.findByText("Showing USD prices because local offers are unavailable.")).toBeVisible();
  expect(getHomepageDeals).toHaveBeenNthCalledWith(2, "US", 3);
});

it("shows retry after the US fallback also fails", async () => {
  vi.mocked(getHomepageDeals).mockRejectedValue(new Error("offline"));
  render(<PublicDeals initialCountry="UA" limit={3} />);
  fireEvent.click(await screen.findByRole("button", { name: "Retry price drops" }));
  await waitFor(() => expect(getHomepageDeals).toHaveBeenCalledTimes(4));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk npm --prefix web test -- PublicDeals.test.tsx`

Expected: FAIL because `PublicDeals` does not exist.

- [ ] **Step 3: Implement the state machine and accessible cards**

Use this state shape and effect contract; retain the `active` cleanup guard so a late response cannot update an unmounted view.

```tsx
type DealsState =
  | { status: "loading"; country: string; fallback: boolean }
  | { status: "success"; country: string; fallback: boolean; deals: HomeDeal[] }
  | { status: "error"; country: string };

useEffect(() => {
  let active = true;
  const load = async () => {
    setState({ status: "loading", country, fallback: false });
    try {
      const response = await getHomepageDeals(country, limit);
      if (active) setState({ status: "success", country, fallback: false, deals: response.results });
    } catch {
      if (!shouldFallbackToUsd(country)) {
        if (active) setState({ status: "error", country });
        return;
      }
      try {
        const response = await getHomepageDeals(FALLBACK_REGION, limit);
        if (active) setState({ status: "success", country: FALLBACK_REGION, fallback: true, deals: response.results });
      } catch {
        if (active) setState({ status: "error", country: FALLBACK_REGION });
      }
    }
  };
  void load();
  return () => { active = false; };
}, [country, limit, retry]);
```

Render 3–6 `<article>` deal cards with cover fallback, game name, store, regular price when present, current price, discount when present, and a safe external store anchor (`target="_blank" rel="noreferrer"`). Use `aria-label="Loading price drops"` on the skeleton container. The country selector must use explicit supported values `UA`, `US`, `GB`, `DE`, and `PL`; selecting it resets the request flow and clears the fallback notice.

- [ ] **Step 4: Run focused tests**

Run: `rtk npm --prefix web test -- PublicDeals.test.tsx`

Expected: PASS; the test confirms the second call is `US` only after a non-US failure.

- [ ] **Step 5: Commit**

Run:

```text
rtk git add web/src/features/home/PublicDeals.tsx web/src/features/home/PublicDeals.test.tsx
rtk git commit -m "feat: add public homepage price drops"
```

### Task 3: Create guest home and root auth/Steam selector

**Files:**
- Create: `web/src/features/home/GuestHome.tsx`
- Create: `web/src/features/home/SteamConnectPrompt.tsx`
- Create: `web/src/features/home/HomeScreen.tsx`
- Create: `web/src/features/home/home.test.tsx`
- Modify: `web/src/routes/index.tsx`

**Consumes:** `useAuthState`, `getSteamAccount`, `getSteamLoginUrl`, `searchGames`, Task 2 `PublicDeals`.

**Produces:** Guest landing view; authenticated-but-unlinked Steam prompt; authenticated Steam-linked branch that accepts the extracted personal dashboard in Task 4.

- [ ] **Step 1: Write failing branch and navigation tests**

```tsx
vi.mock("@/hooks/useAuthState", () => ({ useAuthState: vi.fn() }));
vi.mock("@/lib/api", () => ({ getSteamAccount: vi.fn(), getSteamLoginUrl: vi.fn(), searchGames: vi.fn() }));

it("shows public search and public deals without calling Steam when signed out", () => {
  vi.mocked(useAuthState).mockReturnValue(false);
  render(<HomeScreen />);
  expect(screen.getByRole("heading", { name: /find your next game/i })).toBeVisible();
  expect(getSteamAccount).not.toHaveBeenCalled();
});

it("shows connect Steam after a signed-in account is confirmed unlinked", async () => {
  vi.mocked(useAuthState).mockReturnValue(true);
  vi.mocked(getSteamAccount).mockResolvedValue({ linked: false, steam_id: null, persona_name: null, avatar: null, country_code: null, linked_at: null });
  render(<HomeScreen />);
  expect(await screen.findByRole("heading", { name: "Connect Steam to personalize GameFinder" })).toBeVisible();
});

it("sends the guest hero search to the existing search route", async () => {
  render(<GuestHome />);
  await userEvent.type(screen.getByRole("searchbox"), "hades");
  await userEvent.click(screen.getByRole("button", { name: "Search games" }));
  expect(mockNavigate).toHaveBeenCalledWith({ to: "/search", search: { q: "hades" } });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk npm --prefix web test -- home.test.tsx`

Expected: FAIL because the home components and route selector do not exist.

- [ ] **Step 3: Implement guest search, onboarding, and selector**

`GuestHome` uses a controlled `<input type="search" role="searchbox">`, calls TanStack Router `useNavigate()`, and routes a non-empty trimmed query as:

```tsx
navigate({ to: "/search", search: { q: query.trim() } });
```

Render `<PublicDeals initialCountry={initialCountry()} limit={6} />` directly after the hero. Do not use mock games for public cards.

`SteamConnectPrompt` starts Steam OAuth only after its button click:

```tsx
const { url } = await getSteamLoginUrl();
window.location.assign(url);
```

`HomeScreen` must call `getSteamAccount()` only when `useAuthState()` is true. While it is pending, show a small authenticated skeleton. A 401/session failure returns the user to the guest branch through the existing auth-store notification; any other Steam lookup failure renders the onboarding prompt plus a retry button rather than a blank page.

- [ ] **Step 4: Replace the root route with the thin wrapper**

```tsx
function HomePage() {
  return <AppShell><HomeScreen /></AppShell>;
}
```

Preserve the existing `head` metadata, changing its title to `GameFinder — Find games and deals` and description to the public discovery copy. Remove all `mockData` imports from `index.tsx`.

- [ ] **Step 5: Run focused tests and route guard**

Run: `rtk npm --prefix web test -- home.test.tsx routes.integration.test.ts`

Expected: PASS; root route no longer contains `mockData`.

- [ ] **Step 6: Commit**

Run:

```text
rtk git add web/src/features/home/GuestHome.tsx web/src/features/home/SteamConnectPrompt.tsx web/src/features/home/HomeScreen.tsx web/src/features/home/home.test.tsx web/src/routes/index.tsx
rtk git commit -m "feat: add guest homepage and Steam onboarding"
```

### Task 4: Preserve the personal dashboard without prototype identity

**Files:**
- Create: `web/src/features/home/PersonalDashboard.tsx`
- Modify: `web/src/features/home/HomeScreen.tsx`
- Modify: `web/src/components/AppShell.tsx`
- Modify: `web/src/components/AppShell.test.tsx`
- Modify: `web/src/test/routes.integration.test.ts`

**Consumes:** `SteamAccount` from `getSteamAccount`, personal API functions already in `web/src/lib/api.ts`, and Task 3 selector.

**Produces:** The authenticated branch keeps the familiar dashboard layout but identifies the real Steam account and does not render mock user identity in navigation.

- [ ] **Step 1: Write failing identity tests**

```tsx
it("shows the linked Steam persona in the personal dashboard", async () => {
  render(<PersonalDashboard steamAccount={linkedSteam} />);
  expect(screen.getByText("Real Steam Name")).toBeVisible();
  expect(screen.queryByText("Marcus Chen")).not.toBeInTheDocument();
});

it("keeps unauthenticated navigation public", () => {
  mockAuth(false);
  render(<AppShell><main>Guest home</main></AppShell>);
  expect(screen.getByRole("link", { name: "Sign in" })).toBeVisible();
  expect(screen.queryByRole("link", { name: "Friends" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk npm --prefix web test -- AppShell.test.tsx`

Expected: FAIL because `AppShell` has no `steamAccount` prop and still imports prototype `currentUser`.

- [ ] **Step 3: Extract and adapt personal content**

Move the current root dashboard presentational layout into `PersonalDashboard`. Its top-level identity uses `SteamAccount.persona_name ?? "Steam player"`; its Steam count comes from `getSteamLibrary()` where already available. Each personal subsection must retain an explicit loading/error/empty state rather than falling back to mock arrays. Leave social/recommendation subsections in a compact onboarding state if their live source is not yet implemented; do not invent counts, friends, games, prices, or activity.

Keep the `AppShell({ children }: { children: ReactNode })` signature. Use `useAuthState()` internally. Signed-out navigation shows `Home`, `Search`, `Deals`, and `Sign in`; signed-in navigation shows the existing protected destinations. Remove the prototype `currentUser` import and the hard-coded Steam-synced/identity panels. Replace that sidebar space with a generic `Manage profile` link for signed-in visitors and a `Sign in to personalize` link for guests.

`PersonalDashboard` receives the real Steam account as:

```ts
export function PersonalDashboard({ steamAccount }: {
  steamAccount: SteamAccount;
}): React.ReactElement
```

It renders `steamAccount.persona_name ?? "Steam player"` in the personal dashboard header. If `steamAccount.avatar` is present, render it with `alt={`${name} avatar`}`; otherwise use the existing `Avatar` initials helper.

- [ ] **Step 4: Integrate the dashboard branch and run tests**

Ensure `HomeScreen` renders `<PersonalDashboard steamAccount={account} />` when `account.linked` is true. The root route remains the Task 3 wrapper: `<AppShell><HomeScreen /></AppShell>`.

Run: `rtk npm --prefix web test -- AppShell.test.tsx home.test.tsx routes.integration.test.ts`

Expected: PASS; no active route imports `mockData`.

- [ ] **Step 5: Commit**

Run:

```text
rtk git add web/src/features/home/PersonalDashboard.tsx web/src/features/home/HomeScreen.tsx web/src/components/AppShell.tsx web/src/components/AppShell.test.tsx web/src/test/routes.integration.test.ts
rtk git commit -m "feat: personalize authenticated homepage"
```

### Task 5: Add shared, accessible motion and validate the app

**Files:**
- Modify: `web/src/styles.css`
- Modify: `web/src/features/home/GuestHome.tsx`
- Modify: `web/src/features/home/PublicDeals.tsx`
- Modify: `web/src/features/home/PersonalDashboard.tsx`
- Modify: `web/src/features/home/home.test.tsx`

**Consumes:** Homepage component semantic boundaries from Tasks 2–4.

**Produces:** A shared page-entry, stagger, card-hover, and loading-skeleton vocabulary that honors reduced motion.

- [ ] **Step 1: Write failing class-contract tests**

```tsx
it("marks homepage regions for shared entry and card motion", () => {
  render(<GuestHome />);
  expect(screen.getByTestId("guest-home")).toHaveClass("page-enter");
  expect(screen.getByTestId("public-deals")).toHaveClass("stagger-enter");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk npm --prefix web test -- home.test.tsx`

Expected: FAIL because the motion classes and test IDs are absent.

- [ ] **Step 3: Add the shared styles**

Add these exact semantic classes to `web/src/styles.css`, then apply `page-enter` to page roots, `stagger-enter` to sequential sections, `card-interactive` to cards, and `skeleton-shimmer` to skeletons:

```css
@keyframes page-enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes skeleton-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
.page-enter { animation: page-enter 360ms var(--ease-studio) both; }
.stagger-enter { animation: page-enter 360ms var(--ease-studio) both; animation-delay: var(--stagger-delay, 70ms); }
.card-interactive { transition: transform 180ms var(--ease-studio), border-color 180ms var(--ease-studio); }
.card-interactive:hover { transform: translateY(-3px); }
.skeleton-shimmer { background: linear-gradient(100deg, var(--surface) 35%, var(--surface-2) 50%, var(--surface) 65%); background-size: 200% 100%; animation: skeleton-shimmer 1.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: 1ms !important; } }
```

- [ ] **Step 4: Run focused tests, lint, build, and backend contracts**

Run:

```text
rtk npm --prefix web test -- home.test.tsx PublicDeals.test.tsx AppShell.test.tsx routes.integration.test.ts
rtk npm --prefix web lint
rtk npm --prefix web build
rtk pytest -q tests/test_api_contracts.py
```

Expected: all commands exit 0. The Python contract test confirms the existing public `/prices/deals` API remains valid.

- [ ] **Step 5: Inspect the final diff and commit**

Run:

```text
rtk diff -- web/src/styles.css web/src/features/home/GuestHome.tsx web/src/features/home/PublicDeals.tsx web/src/features/home/PersonalDashboard.tsx
rtk git add web/src/styles.css web/src/features/home/GuestHome.tsx web/src/features/home/PublicDeals.tsx web/src/features/home/PersonalDashboard.tsx web/src/features/home/home.test.tsx
rtk git commit -m "feat: animate homepage states accessibly"
```

### Task 6: Final verification, push, and draft PR

**Files:**
- Verify: all files changed by Tasks 1–5

- [ ] **Step 1: Run complete verification from the repository root**

Run:

```text
rtk git status --short
rtk npm --prefix web test
rtk npm --prefix web lint
rtk npm --prefix web build
rtk pytest -q
```

Expected: tests, lint, build, and Python suite exit 0; the only working-tree changes are intentional task files.

- [ ] **Step 2: Request review of the implementation diff**

Use the `requesting-code-review` skill. Resolve any real findings, then repeat the focused and complete verification that covers the changed file.

- [ ] **Step 3: Publish the branch and open a draft PR**

Use the `github:yeet` skill. Confirm the commits are limited to this task, push the `codex/<task-name>` branch, and open a draft pull request with a summary of guest discovery, USD fallback, authenticated dashboard selection, and motion accessibility.

## Plan self-review

- Spec coverage: guest discovery (Task 3), live public deals and USD fallback (Tasks 1–2), authenticated dashboard and no-Steam state (Tasks 3–4), shared motion/reduced-motion behavior (Task 5), verification and review (Task 6).
- No placeholders: all steps name concrete files, interfaces, commands, expected results, and requested UI states.
- Type consistency: `countryFromLanguage`, `initialCountry`, `shouldFallbackToUsd`, `PublicDeals`, `HomeScreen`, `SteamAccount`, and `getHomepageDeals` use the names and shapes defined in this plan or existing `api.ts`.
