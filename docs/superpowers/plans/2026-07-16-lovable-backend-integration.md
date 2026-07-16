# Lovable Backend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Lovable UI mock data with the existing FastAPI data and actions while preserving the published design.

**Architecture:** `web/src/lib/api.ts` remains the sole HTTP client and is made Vite-compatible. TanStack Query hooks and small DTO-to-card adapters isolate API data from the current Lovable markup. Routes own their loading, empty, sign-in, connect-account, error and retry regions; mutations invalidate precise query keys.

**Tech Stack:** React 19, TanStack Start/Router/Query, TypeScript, Vitest/Testing Library, FastAPI, Railway.

## Global Constraints

- Keep the exact Lovable visual layout; replace data and actions only.
- Use `VITE_API_URL` with fallback `https://game-finder.up.railway.app`.
- Send Bearer authentication only when a token exists.
- Do not show invented friends, activity, LFG, recommendations, library titles or prices.
- Use explicit signed-out, Steam-unlinked, empty, error and retry states.
- Configure backend Railway `FRONTEND_ORIGINS` and `FRONTEND_PUBLIC_URL` to `https://web-production-1d5b1.up.railway.app`.

---

## File Structure

- Modify `web/src/lib/api.ts`: Vite environment access, API errors, typed existing endpoint calls.
- Create `web/src/lib/lovable-data.ts`: query keys, DTO-to-card adapters and reusable error-state classification.
- Create `web/src/lib/lovable-data.test.ts`: adapters and error-state tests.
- Modify `web/src/components/lovable/AppShell.tsx`: authenticated identity and sign-in/connect-safe navigation.
- Modify `web/src/routes/index.tsx`, `search.tsx`, `deals.tsx`, `games.$gameId.tsx`: public catalogue, prices and recommendation data.
- Modify `web/src/routes/library.tsx`, `wishlist.tsx`: saved-game API queries and mutations.
- Modify `web/src/routes/steam.tsx`, `friends.tsx`, `profile.tsx`, `psn.tsx`: account integrations, Steam social, Telegram and PSN import.
- Modify `app/main.py` only if its existing origin configuration needs the documented Railway environment parsing; test it in `tests/test_config.py`.
- Create focused route tests beside each modified route or in `web/src/routes/lovable-data.test.tsx` using mocked `api.ts` calls.

### Task 1: Make the API boundary Vite-safe and testable

**Files:**
- Modify: `web/src/lib/api.ts:189-313`
- Create: `web/src/lib/api.test.ts`

**Interfaces:**
- Produces `ApiError`, `getToken`, `setToken`, `clearToken`, and all existing typed endpoint functions.
- Consumed by every route task below.

- [ ] **Step 1: Write failing API client tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { ApiError, searchGames } from "./api";

describe("api client", () => {
  it("uses the configured Vite API base and preserves API status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("missing", { status: 404 })));
    await expect(searchGames("Hades")).rejects.toEqual(expect.objectContaining<ApiError>({ status: 404 }));
  });
});
```

- [ ] **Step 2: Run the test and confirm the environment access is not browser-safe**

Run: `npm test -- web/src/lib/api.test.ts`

Expected: FAIL until the client reads Vite environment values safely.

- [ ] **Step 3: Implement the Vite-safe base URL and normalized request helper**

```ts
const API_URL = import.meta.env.VITE_API_URL ?? "https://game-finder.up.railway.app";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!response.ok) throw new ApiError((await response.text()) || response.statusText, response.status);
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}
```

- [ ] **Step 4: Run API tests and typecheck**

Run: `npm test -- web/src/lib/api.test.ts && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/api.ts web/src/lib/api.test.ts
git commit -m "feat: make frontend API client Vite-compatible"
```

### Task 2: Add data adapters and state classification

**Files:**
- Create: `web/src/lib/lovable-data.ts`
- Create: `web/src/lib/lovable-data.test.ts`

**Interfaces:**
- Consumes `ApiError`, `CatalogGame`, `SavedGame`, `SteamSocialResponse` from `api.ts`.
- Produces `toGameCard`, `toSavedGameCard`, `getProtectedState`, and `lovableQueryKeys`.

- [ ] **Step 1: Write failing adapter tests**

```ts
import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { getProtectedState, toGameCard } from "./lovable-data";

describe("lovable data adapters", () => {
  it("keeps missing catalogue art explicit", () => expect(toGameCard({ id: 1, name: "Hades", released: null, background_image: null })).toMatchObject({ title: "Hades", imageUrl: null }));
  it("maps unlinked Steam response to connect state", () => expect(getProtectedState(new ApiError("Connect Steam first", 409))).toBe("connect-steam"));
});
```

- [ ] **Step 2: Implement adapters and keys**

```ts
export const lovableQueryKeys = {
  me: ["auth", "me"] as const,
  savedGames: ["games"] as const,
  deals: (country: string) => ["deals", country] as const,
  steam: ["steam"] as const,
};

export function getProtectedState(error: unknown) {
  if (error instanceof ApiError && error.status === 401) return "sign-in";
  if (error instanceof ApiError && error.status === 409) return "connect-steam";
  return "error";
}
```

- [ ] **Step 3: Run focused tests**

Run: `npm test -- web/src/lib/lovable-data.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/lovable-data.ts web/src/lib/lovable-data.test.ts
git commit -m "feat: add lovable API data adapters"
```

### Task 3: Connect public discovery routes

**Files:**
- Modify: `web/src/routes/index.tsx`, `web/src/routes/search.tsx`, `web/src/routes/deals.tsx`, `web/src/routes/games.$gameId.tsx`
- Create: `web/src/routes/discovery-api.test.tsx`

**Interfaces:**
- Consumes `searchGames`, `getTrendingGames`, `getUpcomingGames`, `getHomepageDeals`, `getCatalogGame`, `getGamePriceHistory`, `getRecommendations`.
- Produces public pages backed only by catalogue/price/recommendation responses.

- [ ] **Step 1: Write failing route tests**

```tsx
it("renders search API results and retries an API failure", async () => {
  vi.mocked(searchGames).mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ results: [{ id: 1, name: "Hades", released: null, background_image: null }] });
  render(<SearchRouteComponent />);
  await userEvent.click(await screen.findByRole("button", { name: /try again/i }));
  expect(await screen.findByText("Hades")).toBeInTheDocument();
});
```

- [ ] **Step 2: Replace route mock imports with React Query calls**

```tsx
const gamesQuery = useQuery({ queryKey: ["search", query], queryFn: () => searchGames(query), enabled: query.length > 0 });
if (gamesQuery.isError) return <StatePanel title="Search is unavailable" actionLabel="Try again" onAction={() => gamesQuery.refetch()} />;
const cards = gamesQuery.data?.results.map(toGameCard) ?? [];
```

- [ ] **Step 3: Preserve layout and add empty states**

Replace each existing mock array mapping with its adapter-mapped query result. Render `StatePanel` inside the existing section for loading, no results, or failures; retain every existing card class name and route link.

- [ ] **Step 4: Run focused route tests**

Run: `npm test -- web/src/routes/discovery-api.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/routes/index.tsx web/src/routes/search.tsx web/src/routes/deals.tsx web/src/routes/games.$gameId.tsx web/src/routes/discovery-api.test.tsx
git commit -m "feat: connect lovable discovery routes"
```

### Task 4: Connect saved library and wishlist actions

**Files:**
- Modify: `web/src/routes/library.tsx`, `web/src/routes/wishlist.tsx`
- Create: `web/src/routes/library-api.test.tsx`

**Interfaces:**
- Consumes `listSavedGames`, `createSavedGame`, `deleteSavedGame` and `lovableQueryKeys.savedGames`.
- Produces data-backed library/wishlist cards and mutation-driven refresh.

- [ ] **Step 1: Write failing mutation test**

```tsx
it("removes a saved game and refreshes the library", async () => {
  vi.mocked(listSavedGames).mockResolvedValue([{ id: "g1", title: "Hades", source: "manual" }]);
  vi.mocked(deleteSavedGame).mockResolvedValue(undefined);
  render(<LibraryRouteComponent />);
  await userEvent.click(await screen.findByRole("button", { name: /remove hades/i }));
  await waitFor(() => expect(deleteSavedGame).toHaveBeenCalledWith("g1"));
});
```

- [ ] **Step 2: Implement protected query and mutation**

```tsx
const gamesQuery = useQuery({ queryKey: lovableQueryKeys.savedGames, queryFn: listSavedGames, enabled: isAuthenticated() });
const removeGame = useMutation({ mutationFn: deleteSavedGame, onSuccess: () => queryClient.invalidateQueries({ queryKey: lovableQueryKeys.savedGames }) });
```

- [ ] **Step 3: Render sign-in, empty and local mutation error states**

Use the existing section/card containers. Do not derive a wishlist from mock `games`; only show saved records that carry a wishlist note/tag under the backend’s persisted `notes`/`info` contract.

- [ ] **Step 4: Run tests**

Run: `npm test -- web/src/routes/library-api.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/routes/library.tsx web/src/routes/wishlist.tsx web/src/routes/library-api.test.tsx
git commit -m "feat: connect lovable library data"
```

### Task 5: Connect account, Steam, friends, PSN and Telegram regions

**Files:**
- Modify: `web/src/components/lovable/AppShell.tsx`, `web/src/routes/steam.tsx`, `web/src/routes/friends.tsx`, `web/src/routes/profile.tsx`, `web/src/routes/psn.tsx`
- Create: `web/src/routes/integrations-api.test.tsx`

**Interfaces:**
- Consumes `getCurrentUser`, `getSteamMe`, `getSteamLibrary`, `syncSteamLibrary`, `getSteamSocial`, `getTelegramAccount`, `getTelegramLinkUrl`, `unlinkTelegram`, `previewPsnImport`, `confirmPsnImport`.
- Produces live identity/integration regions and explicit protected states.

- [ ] **Step 1: Write failing protected-state tests**

```tsx
it("does not request social data when signed out", () => {
  vi.mocked(isAuthenticated).mockReturnValue(false);
  render(<FriendsRouteComponent />);
  expect(getSteamSocial).not.toHaveBeenCalled();
  expect(screen.getByText(/sign in/i)).toBeInTheDocument();
});

it("renders a Steam connect action for 409", async () => {
  vi.mocked(getSteamSocial).mockRejectedValue(new ApiError("Connect Steam first", 409));
  render(<FriendsRouteComponent />);
  expect(await screen.findByRole("link", { name: /connect steam/i })).toHaveAttribute("href", "/steam");
});
```

- [ ] **Step 2: Implement account queries and mutations in existing regions**

```tsx
const socialQuery = useQuery({ queryKey: ["steam", "social"], queryFn: getSteamSocial, enabled: isAuthenticated() });
const syncMutation = useMutation({ mutationFn: syncSteamLibrary, onSuccess: () => queryClient.invalidateQueries({ queryKey: lovableQueryKeys.steam }) });
```

- [ ] **Step 3: Map only returned Steam social records and account states**

Remove mock `friends` and `activity` imports. Render `socialQuery.data?.friends ?? []`; render the existing section’s empty/connection panel when this array is empty or the request is `409`. Keep Telegram errors scoped to Telegram controls and clear PSN preview after a successful confirm.

- [ ] **Step 4: Run integration tests**

Run: `npm test -- web/src/routes/integrations-api.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/lovable/AppShell.tsx web/src/routes/steam.tsx web/src/routes/friends.tsx web/src/routes/profile.tsx web/src/routes/psn.tsx web/src/routes/integrations-api.test.tsx
git commit -m "feat: connect lovable account integrations"
```

### Task 6: Configure backend origin handling and verify production

**Files:**
- Modify: `app/main.py:65-120` only if required after test inspection
- Modify: `tests/test_config.py`
- Configure Railway variables for services `devoted-balance` and `web`.

**Interfaces:**
- Backend accepts `FRONTEND_ORIGINS` as comma-separated origins and `FRONTEND_PUBLIC_URL` as OAuth callback origin.
- Frontend build receives `VITE_API_URL`.

- [ ] **Step 1: Write/extend origin test**

```py
def test_get_allowed_origins_includes_public_railway_frontend(monkeypatch):
    monkeypatch.setenv("FRONTEND_ORIGINS", "https://web-production-1d5b1.up.railway.app")
    assert get_allowed_origins() == ["https://web-production-1d5b1.up.railway.app"]
```

- [ ] **Step 2: Implement only configuration parsing required by the test**

```py
def get_allowed_origins() -> list[str]:
    raw = os.getenv("FRONTEND_ORIGINS", "")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]
```

- [ ] **Step 3: Run backend tests**

Run: `pytest tests/test_config.py tests/test_api_contracts.py -q`

Expected: PASS.

- [ ] **Step 4: Configure and deploy Railway**

Set backend `FRONTEND_ORIGINS=https://web-production-1d5b1.up.railway.app` and `FRONTEND_PUBLIC_URL=https://web-production-1d5b1.up.railway.app`; set frontend `VITE_API_URL=https://game-finder.up.railway.app`. Deploy both services after all tests pass.

- [ ] **Step 5: Verify public behavior and commit**

Run: `npm test && npm run lint && npx tsc --noEmit && npm run build` from `web`, then `curl -I https://web-production-1d5b1.up.railway.app/`.

Expected: frontend test/build commands pass and the public URL returns `200`.

```bash
git add app/main.py tests/test_config.py
git commit -m "fix: allow public frontend origin"
```

## Plan Review

- Scope coverage: Tasks 1–2 establish the client boundary and state model; Tasks 3–5 cover every current Lovable data route; Task 6 covers CORS, OAuth callback configuration and production verification.
- Placeholder scan: no incomplete work markers are present.
- Type consistency: all route tasks consume existing `api.ts` functions and the shared `lovableQueryKeys`/`getProtectedState` interfaces introduced in Task 2.
