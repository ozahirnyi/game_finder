# Foundation and Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the active Vite/TanStack auth, search, AI recommendation, and game-detail flows use FastAPI data and complete user actions instead of prototype data.

**Architecture:** Keep `web/src/routes` as the runtime application. The API client reads `VITE_API_URL`, owns token expiry and auth notifications, and exposes typed API calls. Feature modules use TanStack Query for request lifecycle; routes own URL state and compose presentational cards. AI titles are resolved through the existing catalog search before they can link to game detail.

**Tech Stack:** Vite, React 19, TanStack Router, TanStack Query, TypeScript, Vitest, FastAPI, pytest.

## Global Constraints

- Do not implement Party Finder, Groups, Discord, notifications, price-alert changes, favorites, public profiles, privacy controls, or onboarding in this delivery.
- Use `VITE_API_URL`; do not place backend URLs or secrets in browser code.
- Every changed query has explicit pending, empty, error, and retry behavior.
- Never render mock data, a fake presence state, or a game link with a missing or placeholder identity in the shared shell or auth/discovery flow.
- Preserve FastAPI auth methods and response schemas; clear the token on an authenticated 401.
- `currentUserQueryOptions()` exclusively owns `/auth/me` with query key `["auth", "me"]`, `enabled: Boolean(getToken())`, and authenticated-query metadata. `AppShell` must not call `getCurrentUser` directly.
- `RecommendationItem` carries optional `rawg_id`, `steam_appid`, and `steam_url`. Resolve only valid supplied identities: rawg first for an internal link, then a Steam app ID plus URL for an external link, then an exact normalized catalog-title match; otherwise render title search. Never fuzzy-match an identity.
- Keep user-owned changes in `web/src/features/discovery/discovery.test.tsx` and `docs/superpowers/plans/2026-07-22-production-web-release.md` out of commits.

## File Structure

- `web/src/lib/api.ts` — API origin, request helper, token lifecycle, and typed FastAPI calls.
- `web/src/lib/api-url.test.ts`, `web/src/lib/api.test.ts` — API-origin and authenticated-401 regression tests.
- `web/src/lib/auth-session.ts` — query-cache-safe login/logout actions and reactive auth snapshot hook.
- `web/src/lib/auth-session.test.ts` — auth subscriber/cache invalidation tests.
- `web/src/features/auth/AuthScreen.tsx` — Vite/TanStack-compatible login and registration form.
- `web/src/features/auth/AuthScreen.test.tsx` — form pending, success, and failure tests.
- `web/src/routes/login.tsx`, `web/src/routes/register.tsx` — active authentication routes.
- `web/src/features/discovery/catalog-queries.ts` — query options and stable catalog keys.
- `web/src/features/discovery/SearchScreen.tsx` — URL-backed catalog search and query-suggestion UX.
- `web/src/features/discovery/SearchScreen.test.tsx` — search, suggestion, empty, and retry tests.
- `web/src/features/discovery/recommendation-resolver.ts` — exact title normalization and safe AI result resolution.
- `web/src/features/discovery/recommendation-resolver.test.ts` — resolver matching tests.
- `web/src/features/discovery/RecommendationResults.tsx` — matched and unmatched recommendation cards.
- `web/src/features/discovery/RecommendationResults.test.tsx` — link and fallback-action tests.
- `web/src/features/discovery/GameDetailScreen.tsx` — real game and price queries with controlled states.
- `web/src/features/discovery/GameDetailScreen.test.tsx` — game-detail state tests.
- `web/src/routes/search.tsx`, `web/src/routes/games.$gameId.tsx` — route-level URL parameters and feature composition.
- `web/src/components/AppShell.tsx` — real signed-in/signed-out shell state; no mock user or fake sync status.
- `web/src/test/routes.integration.test.ts` — static regression coverage for the routes and shell in this delivery.

---

### Task 1: Make the API client Vite-compatible and preserve auth correctness

**Files:**
- Modify: `web/src/lib/api.ts:1-410`
- Modify: `web/src/lib/api-url.test.ts:1-30`
- Modify: `web/src/lib/api.test.ts:1-80`
- Create: `web/src/lib/auth-session.ts`
- Create: `web/src/lib/auth-session.test.ts`

**Interfaces:**
- Consumes: FastAPI `/auth/register`, `/auth/login`, `/auth/me`, `/search/games`, `/catalog/games/{id}`, `/prices/games/{id}`, and `/recommendations`.
- Produces: `getToken()`, `setToken(token)`, `clearToken()`, `useAuthenticated()`, `currentUserQueryOptions()`, `completeLogin(token, queryClient)`, and `signOut(queryClient)`.

- [ ] **Step 1: Write the failing API-origin and logout tests**

```ts
it("uses VITE_API_URL", async () => {
  vi.stubEnv("VITE_API_URL", "https://api.example.test")
  global.fetch = vi.fn().mockResolvedValue(new Response('{"results":[]}', { status: 200, headers: { "content-type": "application/json" } }))
  await searchGames("Hades")
  expect(fetch).toHaveBeenCalledWith("https://api.example.test/search/games?q=Hades", expect.any(Object))
})

it("clears the token and authenticated cache on logout", () => {
  const queryClient = new QueryClient()
  setToken("header.payload.signature")
  signOut(queryClient)
  expect(getToken()).toBeNull()
  expect(queryClient.getQueryCache().find({ queryKey: ["auth", "me"] })).toBeUndefined()
})

it("enables the current-user query only with a token", () => {
  clearToken()
  expect(currentUserQueryOptions().enabled).toBe(false)
  setToken("header.payload.signature")
  expect(currentUserQueryOptions().enabled).toBe(true)
  expect(currentUserQueryOptions().queryKey).toEqual(["auth", "me"])
  expect(currentUserQueryOptions().meta).toMatchObject({ auth: true })
})
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `rtk npm.cmd --prefix web test -- --run src/lib/api-url.test.ts src/lib/auth-session.test.ts`  
Expected: FAIL because the Vite environment lookup and auth-session module do not exist.

- [ ] **Step 3: Implement the API-origin and session contract**

```ts
const API_URL = import.meta.env.VITE_API_URL || "https://playfinder.cc/api"

export function completeLogin(token: string, queryClient: QueryClient) {
  setToken(token)
  void queryClient.invalidateQueries({ queryKey: ["auth", "me"] })
}

export function signOut(queryClient: QueryClient) {
  clearToken()
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] === "auth" || query.meta?.auth === true })
}
```

Implement `useAuthenticated` with `useSyncExternalStore(subscribeToAuthChanges, getAuthSnapshot, () => false)` so shell rendering reacts to token changes. Implement `currentUserQueryOptions()` with `queryKey: ["auth", "me"]`, `queryFn: getCurrentUser`, `enabled: Boolean(getToken())`, and `meta: { auth: true }`.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `rtk npm.cmd --prefix web test -- --run src/lib/api-url.test.ts src/lib/api.test.ts src/lib/auth-session.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit the isolated API foundation**

Run: `rtk git add web/src/lib/api.ts web/src/lib/api-url.test.ts web/src/lib/api.test.ts web/src/lib/auth-session.ts web/src/lib/auth-session.test.ts; rtk git commit -m "feat: align Vite API client and auth session"`

### Task 2: Move email authentication onto active TanStack routes

**Files:**
- Create: `web/src/features/auth/AuthScreen.tsx`
- Create: `web/src/features/auth/AuthScreen.test.tsx`
- Create: `web/src/routes/login.tsx`
- Create: `web/src/routes/register.tsx`
- Delete: `web/src/features/auth/AuthPanel.tsx`
- Delete: `web/src/features/auth/auth.test.tsx`
- Delete: `web/src/app/login/page.tsx`
- Delete: `web/src/app/register/page.tsx`

**Interfaces:**
- Consumes: `loginUser(email, password)`, `registerUser(email, password)`, `completeLogin(token, queryClient)`, and `Route.useRouteContext().queryClient`.
- Produces: `/login` and `/register`. Task 6 exclusively owns `AppShell` account-query rendering and sign-out UI.

- [ ] **Step 1: Write failing route-form tests**

```tsx
it("logs in and navigates home", async () => {
  vi.mocked(loginUser).mockResolvedValue({ access_token: "token", token_type: "bearer" })
  render(<AuthScreen mode="login" queryClient={queryClient} onSuccess={onSuccess} />)
  await user.type(screen.getByLabelText(/email/i), "user@example.test")
  await user.type(screen.getByLabelText(/^password/i), "secret")
  await user.click(screen.getByRole("button", { name: /sign in/i }))
  await waitFor(() => expect(onSuccess).toHaveBeenCalled())
})
```

Add tests for backend error text, disabled pending submit, registration followed by login, and shell sign-out calling `signOut`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `rtk npm.cmd --prefix web test -- --run src/features/auth/AuthScreen.test.tsx`  
Expected: FAIL because `AuthScreen` and the active routes are absent.

- [ ] **Step 3: Implement Vite/TanStack form and routes**

```tsx
async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()
  setError("")
  setPending(true)
  try {
    if (mode === "register") await registerUser(email, password)
    const token = await loginUser(email, password)
    completeLogin(token.access_token, queryClient)
    onSuccess()
  } catch (error) {
    setError(error instanceof ApiError ? error.message : "Unable to sign in. Please try again.")
  } finally {
    setPending(false)
  }
}
```

Each route renders `AuthScreen`, takes `queryClient` from route context, and calls `navigate({ to: "/" })` after success. `AppShell` changes are deferred to Task 6, where it reads account state solely through `currentUserQueryOptions()`.

- [ ] **Step 4: Delete duplicate Next-only auth entrypoints after active-route tests pass**

Run: `rtk git rm web/src/features/auth/AuthPanel.tsx web/src/features/auth/auth.test.tsx web/src/app/login/page.tsx web/src/app/register/page.tsx`  
Expected: only unused Next authentication entrypoints are removed; no active Vite route is deleted.

- [ ] **Step 5: Verify and commit**

Run: `rtk npm.cmd --prefix web test -- --run src/features/auth/AuthScreen.test.tsx; rtk npm.cmd --prefix web run lint; rtk npm.cmd --prefix web run build`  
Expected: PASS.

Run: `rtk git add web/src/features/auth/AuthScreen.tsx web/src/features/auth/AuthScreen.test.tsx web/src/routes/login.tsx web/src/routes/register.tsx web/src/app web/src/features/auth; rtk git commit -m "feat: add TanStack email auth flow"`

### Task 3: Connect URL-backed catalog search and query suggestions

**Files:**
- Create: `web/src/features/discovery/catalog-queries.ts`
- Modify: `web/src/features/discovery/SearchScreen.tsx:1-80`
- Modify: `web/src/features/discovery/SearchScreen.test.tsx:1-120`
- Modify: `web/src/routes/search.tsx:1-180`

**Interfaces:**
- Consumes: `searchGames(query): Promise<SearchResponse>`.
- Produces: `catalogSearchQuery(query)`, `<SearchScreen initialQuery onQueryChange />`, and URL search state `{ q?: string }`.

- [ ] **Step 1: Write failing URL and suggestion tests**

```tsx
it("submits a suggestion as the new URL query", async () => {
  render(<SearchScreen initialQuery="" onQueryChange={onQueryChange} />)
  await user.click(screen.getByRole("button", { name: "Roguelike" }))
  expect(onQueryChange).toHaveBeenCalledWith("Roguelike")
})

it("labels an empty result with the submitted query", async () => {
  vi.mocked(searchGames).mockResolvedValue({ results: [] })
  render(<SearchScreen initialQuery="co-op" onQueryChange={vi.fn()} />)
  expect(await screen.findByText(/No games match “co-op”/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `rtk npm.cmd --prefix web test -- --run src/features/discovery/SearchScreen.test.tsx`  
Expected: FAIL because suggestions do not update router state and empty copy lacks query context.

- [ ] **Step 3: Implement a stable search query and suggestions**

```ts
export const catalogSearchQuery = (query: string) => queryOptions({
  queryKey: ["catalog", "search", query],
  queryFn: () => searchGames(query),
  enabled: query.trim().length > 0,
  staleTime: 60_000,
})
```

Use `Route.validateSearch` to parse `{ q: z.string().optional() }`. The submit handler and each suggestion call `navigate({ search: { q: nextQuery } })`; `SearchScreen` receives that value and uses `useQuery(catalogSearchQuery(query))`. Keep one suggestion active only when it equals the submitted query.

- [ ] **Step 4: Verify and commit**

Run: `rtk npm.cmd --prefix web test -- --run src/features/discovery/SearchScreen.test.tsx; rtk npm.cmd --prefix web run lint`  
Expected: PASS.

Run: `rtk git add web/src/features/discovery/catalog-queries.ts web/src/features/discovery/SearchScreen.tsx web/src/features/discovery/SearchScreen.test.tsx web/src/routes/search.tsx; rtk git commit -m "feat: connect catalog search suggestions"`

### Task 4: Resolve AI recommendation identities before navigation

**Files:**
- Modify: `app/schemas.py:68-75`
- Modify: `app/openai_client.py:57-205`
- Modify: `app/main.py:776-980`
- Modify: `tests/test_api_contracts.py:515-589`
- Create: `web/src/features/discovery/recommendation-resolver.ts`
- Create: `web/src/features/discovery/recommendation-resolver.test.ts`
- Create: `web/src/features/discovery/RecommendationResults.tsx`
- Create: `web/src/features/discovery/RecommendationResults.test.tsx`
- Modify: `web/src/routes/search.tsx`

**Interfaces:**
- Consumes: `RecommendationItem { title, reason, tags, rawg_id?, steam_appid?, steam_url? }` and `searchGames(title)`.
- Produces: `ResolvedRecommendation = { item: RecommendationItem; game: SearchGame | null; href?: string; external?: boolean }` and `resolveRecommendations(items)`.

- [ ] **Step 1: Write failing resolution tests**

Add pytest response-contract cases that verify `/recommendations` and `/steam/recommendations` preserve supplied `rawg_id`, `steam_appid`, and `steam_url` fields (including `null` values). Add Vitest cases that prove the resolver/card precedence: a positive `rawg_id` produces only `/games/$id`; otherwise a positive `steam_appid` plus nonempty `steam_url` produces only an external Steam link; otherwise an exact normalized title match produces a catalog link; an unmatched item exposes only title search.

```ts
it("uses the exact normalized catalog-title match", async () => {
  vi.mocked(searchGames).mockResolvedValue({ results: [
    { id: 3, name: "Hades II Deluxe", released: null, background_image: null },
    { id: 2, name: "Hades II", released: null, background_image: null },
  ] })
  await expect(resolveRecommendation({ title: "hades ii", reason: "", tags: [] })).resolves.toMatchObject({ game: { id: 2 } })
})

it("leaves a recommendation unmatched when no exact identity exists", async () => {
  vi.mocked(searchGames).mockResolvedValue({ results: [{ id: 2, name: "Hades II Deluxe", released: null, background_image: null }] })
  await expect(resolveRecommendation({ title: "Hades II", reason: "", tags: [] })).resolves.toMatchObject({ game: null })
})
```

- [ ] **Step 2: Run the resolver and card tests and verify RED**

Run: `rtk npm.cmd --prefix web test -- --run src/features/discovery/recommendation-resolver.test.ts src/features/discovery/RecommendationResults.test.tsx`  
Expected: FAIL because neither resolver nor safe card component exists.

- [ ] **Step 3: Implement normalized exact matching and safe cards**

```ts
export const normalizeTitle = (value: string) => value.normalize("NFKD").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

export async function resolveRecommendation(item: RecommendationItem): Promise<ResolvedRecommendation> {
  const { results } = await searchGames(item.title)
  const game = results.find((candidate) => candidate.id != null && candidate.name != null && normalizeTitle(candidate.name) === normalizeTitle(item.title)) ?? null
  return { item, game }
}
```

Extend the Pydantic and TypeScript `RecommendationItem` contracts with nullable `rawg_id`, `steam_appid`, and `steam_url`, and ensure recommendation-generation paths preserve supplied values rather than fabricating them. `RecommendationResults` first uses a positive rawg ID for an internal game link, then a positive Steam app ID only with a nonempty Steam URL for an external link, then `game?.id != null` for an exact catalog link; otherwise it renders the reason and tags plus a button that calls `onSearchTitle(item.title)`. Use `useQueries` or a single `Promise.all` query function keyed by prompt to resolve only title-only recommendations once per recommendation request.

- [ ] **Step 4: Verify and commit**

Run: `rtk npm.cmd --prefix web test -- --run src/features/discovery/recommendation-resolver.test.ts src/features/discovery/RecommendationResults.test.tsx; rtk npm.cmd --prefix web run lint; rtk pytest -q tests/test_api_contracts.py`  
Expected: PASS.

Run: `rtk git add app/schemas.py app/openai_client.py app/main.py tests/test_api_contracts.py web/src/lib/api.ts web/src/features/discovery/recommendation-resolver.ts web/src/features/discovery/recommendation-resolver.test.ts web/src/features/discovery/RecommendationResults.tsx web/src/features/discovery/RecommendationResults.test.tsx web/src/routes/search.tsx; rtk git commit -m "feat: make AI recommendations actionable"`

### Task 5: Replace prototype game detail with real catalog and price states

**Files:**
- Modify: `web/src/features/discovery/GameDetailScreen.tsx:1-120`
- Create: `web/src/features/discovery/GameDetailScreen.test.tsx`
- Modify: `web/src/routes/games.$gameId.tsx:1-330`

**Interfaces:**
- Consumes: `getCatalogGame(id)`, `getGamePriceHistory(id)`, and `catalogGameQuery(id)`.
- Produces: a detail route for a valid catalog ID with independent game and price states.

- [ ] **Step 1: Write failing detail-state tests**

```tsx
it("renders catalog detail and a real price state", async () => {
  vi.mocked(getCatalogGame).mockResolvedValue(catalogGame)
  vi.mocked(getGamePriceHistory).mockResolvedValue(priceHistory)
  render(<GameDetailScreen gameId="3498" />)
  expect(await screen.findByRole("heading", { name: catalogGame.name })).toBeInTheDocument()
  expect(screen.getByText("19.99 USD")).toBeInTheDocument()
})

it("renders a retryable unavailable state for a missing game", async () => {
  vi.mocked(getCatalogGame).mockRejectedValue(new ApiError("Game not found", 404))
  render(<GameDetailScreen gameId="0" />)
  expect(await screen.findByText(/Game details are unavailable/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `rtk npm.cmd --prefix web test -- --run src/features/discovery/GameDetailScreen.test.tsx`  
Expected: FAIL because the active detail route still imports `mockData` and does not compose the real screen.

- [ ] **Step 3: Implement real route composition**

Replace the mock route loader with a route component that validates a nonempty `gameId` and renders `<GameDetailScreen gameId={gameId} />`. In `GameDetailScreen`, use TanStack Query keys `["catalog", "game", gameId]` and `["prices", "game", gameId, "US"]`; retain independent retry controls. Render only catalog description, genres/platforms, store URL, current/low prices, and genuine share navigation. Remove fake friends, squad rationale, recommendations, heart, alert, and invite controls because their contracts belong to later OpenSpecs.

- [ ] **Step 4: Verify and commit**

Run: `rtk npm.cmd --prefix web test -- --run src/features/discovery/GameDetailScreen.test.tsx src/features/discovery/discovery.test.tsx; rtk npm.cmd --prefix web run build`  
Expected: PASS.

Run: `rtk git add web/src/features/discovery/GameDetailScreen.tsx web/src/features/discovery/GameDetailScreen.test.tsx web/src/routes/games.$gameId.tsx; rtk git commit -m "feat: connect real game detail states"`

### Task 6: Make the shared shell truthful and lock the regression boundary

**Files:**
- Modify: `web/src/components/AppShell.tsx:1-180`
- Modify: `web/src/test/routes.integration.test.ts:1-25`
- Modify: `web/src/routes/index.tsx` only if it imports `AppShell` props changed by Task 2

**Interfaces:**
- Consumes: `useAuthenticated`, `currentUserQueryOptions()`, and `/login` route.
- Produces: a shell with no `mockData` import or fake Steam-sync/user status.

- [ ] **Step 1: Expand the static regression test**

```ts
const checkedFiles = [
  "components/AppShell.tsx",
  "routes/search.tsx",
  "routes/games.$gameId.tsx",
  "routes/login.tsx",
  "routes/register.tsx",
]

it("keeps the foundation and discovery flow free of prototype data", () => {
  for (const file of checkedFiles) {
    expect(readFileSync(path.join(process.cwd(), "src", file), "utf8")).not.toContain("mockData")
  }
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `rtk npm.cmd --prefix web test -- --run src/test/routes.integration.test.ts`  
Expected: FAIL because `AppShell` imports `currentUser` from `mockData`.

- [ ] **Step 3: Replace mock shell state with auth state**

Render a signed-out `/login` call to action. For signed-in users, call `useQuery(currentUserQueryOptions())`, display the returned email as the account label, and offer an explicit sign-out button. The query is enabled only when a token exists and has authenticated-query metadata so `signOut` removes it. `AppShell` must not call `getCurrentUser` directly. Remove the hard-coded synced Steam card and fake notification button; neither has a real action in this delivery.

- [ ] **Step 4: Verify complete frontend and backend contracts**

Run: `rtk npm.cmd --prefix web test -- --run src/lib src/features/auth src/features/discovery src/test/routes.integration.test.ts; rtk npm.cmd --prefix web run lint; rtk npm.cmd --prefix web run build; rtk pytest -q`  
Expected: all selected frontend tests, lint, production build, and backend tests PASS.

- [ ] **Step 5: Commit the verified delivery boundary**

Run: `rtk git add web/src/components/AppShell.tsx web/src/test/routes.integration.test.ts web/src/routes/index.tsx; rtk git commit -m "test: lock truthful discovery route boundary"`

### Task 7: Final review, documentation, and PR handoff

**Files:**
- Modify: `docs/superpowers/specs/2026-08-06-foundation-discovery-design.md` only if verification exposes a contract change.
- Create: no new product files.

**Interfaces:**
- Consumes: all preceding commits and verification commands.
- Produces: a reviewable branch and PR whose scope is only foundation and discovery.

- [ ] **Step 1: Check scope and accidental changes**

Run: `rtk git status --short; rtk diff origin/main -- web app docs/superpowers/specs/2026-08-06-foundation-discovery-design.md`  
Expected: changes are limited to the files in this plan; user-owned files remain unstaged.

- [ ] **Step 2: Run the final verification suite**

Run: `rtk npm.cmd --prefix web test; rtk npm.cmd --prefix web run lint; rtk npm.cmd --prefix web run build; rtk pytest -q`  
Expected: PASS.

- [ ] **Step 3: Commit only necessary verification/documentation adjustments**

Run: `rtk git add docs/superpowers/specs/2026-08-06-foundation-discovery-design.md; rtk git commit -m "docs: verify foundation discovery delivery"`  
Expected: create this commit only if Task 7 changed the design specification; otherwise do not create an empty commit.

- [ ] **Step 4: Push and open a review PR**

Run: `rtk git push -u origin codex/foundation-discovery-design-66e9`  
Expected: branch is published. Create a draft PR summarizing auth, search, AI matching, game detail, the tests run, and the explicitly deferred OpenSpecs.

## Plan Self-Review

- Spec coverage: Tasks 1–2 cover auth/sign-out; Task 3 covers truthful suggestions; Task 4 covers actionable AI cards; Task 5 covers truthful game detail; Task 6 enforces the no-prototype boundary.
- Type consistency: `RecommendationItem`, `SearchGame`, `CatalogGame`, `GamePriceHistory`, `QueryClient`, and the API calls are defined in `web/src/lib/api.ts`; new interfaces are introduced in the task that creates them.
- Scope: notifications, alerts, favorites, public profile, privacy, onboarding, Party Finder, Groups, and Discord are intentionally excluded.
- Placeholder scan: no deferred implementation placeholders are used; every task has file targets, test criteria, and verification commands.
