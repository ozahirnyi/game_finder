# Playfinder — Backend Handoff Spec

> Give this file to Codex (or any coding agent) as the task brief.
> The **frontend is done**. The job is to replace mock data with a real backend,
> without redesigning the UI.

---

## 0. Ground rules for the implementing agent

1. **Do not redesign the UI.** Keep all existing markup, Tailwind classes,
   animations and layout in `src/routes/*` and `src/components/*`.
   Only swap the data source and add loading / empty / error states where marked.
2. **Do not install another router or framework.** This is TanStack Start v1
   (React 19 + Vite 7 + Tailwind v4). Routes are file-based in `src/routes`.
   Never edit `src/routeTree.gen.ts`.
3. **Server code goes in `createServerFn`** (`@tanstack/react-start`), or in
   server routes under `src/routes/api/*` for webhooks/cron/public HTTP.
   Read `process.env.*` **inside** handlers, never at module scope.
4. **Any file declaring `createServerFn` must be a thin wrapper**: only imports,
   types and exported server-function declarations at module scope. Helpers live
   in a separate `*.server.ts` file that the wrapper imports. (Server-fn code
   splitting deletes sibling runtime declarations → `ReferenceError` in prod.)
5. Ship in the phase order below. Each phase must build, typecheck and be
   clickable before starting the next.

---

## 1. Current state

### Stack

- TanStack Start v1, React 19, Vite 7, Tailwind v4 (`src/styles.css`, no tailwind.config.js)
- Deployed to a Cloudflare Worker–style edge runtime (no `child_process`, no `sharp`, no native modules)
- Theme: "Charcoal & Ember", Space Grotesk + DM Sans, dark-first with light mode
  and accent switching (`src/lib/theme.tsx`, `src/components/ThemeSelector.tsx`)

### Routes (all currently rendering mock data)

| Route                  | File                                       | What it shows                                                                                 |
| ---------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `/`                    | `routes/index.tsx`                         | Hero search + typeahead, region selector, price-drop grid, friends-online teaser, account CTA |
| `/search`              | `routes/search.tsx`                        | Search field, genre/platform filters, result grid                                             |
| `/library`             | `routes/library.tsx`                       | Tabs: All games / Steam / PlayStation + playtime stats                                        |
| `/wishlist`            | `routes/wishlist.tsx`                      | Wishlisted games, discount badges, price sparkline                                            |
| `/deals`               | `routes/deals.tsx`                         | Deal of the day hero + discount grid                                                          |
| `/friends`             | `routes/friends.tsx`                       | Friend list, compatibility %, LFG tags, shared games                                          |
| `/games/$gameId`       | `routes/games.$gameId.tsx`                 | Game detail: hero, price history, friends who own it, AI blurb                                |
| `/account`             | `routes/account.tsx`                       | Profile stats, connected stores, notifications, theme (desktop)                               |
| `/sign-in`, `/sign-up` | `routes/sign-in.tsx`, `routes/sign-up.tsx` | Static forms, no submit logic                                                                 |

### The single source of mock data

`src/lib/mockData.ts` exports: `games`, `friends`, `activity`, `aiRecommendations`,
`priceHistory`, `account`, `regions`, `deals`, and the types `Game`, `Friend`, `Deal`.
**Every route imports from here.** Treat these exported types as the **API contract**:
the backend must return objects with the same shape, so route components need
minimal edits.

---

## 2. Target architecture

```
src/
  integrations/supabase/   # generated client, types, auth-middleware (Lovable Cloud)
  lib/
    games.functions.ts     # createServerFn wrappers  (thin!)
    games.server.ts        # query helpers, mappers
    deals.functions.ts / deals.server.ts
    social.functions.ts / social.server.ts
    library.functions.ts / library.server.ts
  routes/api/public/
    steam-sync.ts          # cron/webhook endpoints (verify caller!)
```

Data flow: route `loader` → `context.queryClient.ensureQueryData(queryOptions)` →
component `useSuspenseQuery`. Do **not** convert pages to `useEffect` fetching.

Protected server fns use `.middleware([requireSupabaseAuth])` and must **never**
be called from a public route loader (SSR/prerender has no session) — call them
from the component via `useServerFn` + `useQuery`, or move the route under
`src/routes/_authenticated/`.

---

## 3. Phase 1 — Enable Lovable Cloud + auth

1. Enable Lovable Cloud (Supabase under the hood) for the project.
2. Decide: **profiles are needed** (display name, handle, avatar, region,
   theme prefs), so create a `profiles` table with a trigger that inserts a row
   on signup.
3. Wire `/sign-in` and `/sign-up` to real email+password auth:
   - `supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })`
   - `supabase.auth.signInWithPassword(...)`
   - register `onAuthStateChange` early; use `getUser()` for trusted checks
   - add `/reset-password` route + `resetPasswordForEmail(email, { redirectTo: origin + '/reset-password' })`
   - inline field errors, disabled/spinner submit state, success toast
4. Replace the hardcoded `account` object in `mockData.ts` with a real
   `useAuth()`-style hook. `AppShell` already branches on signed-in vs guest —
   just feed it the real value. Add a working **Sign out**.
5. Guest experience must keep working: `/`, `/search`, `/deals`, `/games/$gameId`
   stay public. `/library`, `/wishlist`, `/friends`, `/account` require auth
   (redirect to `/sign-in` with a return-to param).

### Migration rules (non-negotiable)

Every `CREATE TABLE public.x` migration must, in this exact order:
`CREATE TABLE` → `GRANT` → `ENABLE ROW LEVEL SECURITY` → `CREATE POLICY`.
Roles go in a **separate `user_roles` table** with a `has_role()` security-definer
function — never a `role` column on `profiles`.

---

## 4. Phase 2 — Schema

Minimum tables (adjust names, keep the shapes in `mockData.ts`):

- `profiles` — `id uuid pk references auth.users on delete cascade`, `handle unique`,
  `display_name`, `avatar_from/avatar_to`, `region`, `created_at`
- `games` — `id text pk` (slug), `title`, `genres text[]`, `platforms text[]`,
  `rating int`, `cover_from`, `cover_to`, `coop bool`, `steam_appid int`
- `game_prices` — `game_id`, `store`, `region`, `price numeric`, `original_price numeric`,
  `discount int`, `currency`, `store_url`, `captured_at` (this powers `/deals`,
  the region selector, and the price-history sparkline)
- `library_entries` — `user_id`, `game_id`, `source` (`Steam` | `PlayStation` | `Manual`),
  `status`, `playtime_minutes`, unique `(user_id, game_id, source)`
- `wishlist_entries` — `user_id`, `game_id`, `target_price numeric null`, `notify bool`
- `friendships` — `requester_id`, `addressee_id`, `status` (`pending`/`accepted`/`blocked`),
  unique pair; plus a view or fn for compatibility % and shared-game count
- `activity_events` — `user_id`, `verb`, `game_id`, `meta jsonb`, `created_at`
- `price_alerts` — `user_id`, `game_id`, `threshold`, `last_notified_at`

RLS: users read/write only their own `library_entries`, `wishlist_entries`,
`price_alerts`, `profiles` row. `games` and `game_prices` are public-read
(`GRANT SELECT ... TO anon` + a narrow `TO anon` SELECT policy). Friends' data is
readable only through accepted friendships.

**Seed demo rows with literal `INSERT` statements inside the migration** — port the
current contents of `mockData.ts` so the first screen is never empty. Do not seed
on page load or from a server function.

---

## 5. Phase 3 — Replace mock data route by route

For each route, in this order: `/deals` → `/` → `/search` → `/games/$gameId` →
`/library` → `/wishlist` → `/friends` → `/account`.

Per route:

1. Add a `queryOptions` + `createServerFn` pair returning **exactly** the existing
   TypeScript shape (`Game`, `Deal`, `Friend`).
2. Swap the `mockData` import for the query.
3. Add the three states the UI currently lacks:
   - **loading** — skeleton panels reusing the `panel` utility, not a spinner page
   - **empty** — friendly copy + a primary action (e.g. "Add your first game")
   - **error** — inline retry, never a blank screen
4. Make the interactive bits real: wishlist add/remove, library status changes,
   friend request send/accept, region selector persisting to the profile.

Delete `src/lib/mockData.ts` only when the last route stops importing it; keep the
exported **types** by moving them to `src/lib/types.ts`.

---

## 6. Phase 4 — Store integrations & price data

- Steam: import an owned-games list via Steam Web API (`GetOwnedGames`,
  `GetPlayerSummaries`) using a `STEAM_API_KEY` secret + OpenID sign-in flow.
  Run the sync inside a server fn; write into `library_entries` with `source='Steam'`.
- PlayStation: no official public API — implement behind a feature flag or a
  manual CSV/JSON import; do not block Phase 3 on it.
- Price refresh: a cron-callable endpoint at
  `src/routes/api/public/refresh-prices.ts` guarded by a shared-secret header
  (timing-safe compare), writing new `game_prices` rows. Public URL:
  `project--{project-id}.lovable.app/api/public/refresh-prices`.
- Price alerts: after a refresh, compare against `price_alerts.threshold` and send
  an email (Resend) once per drop; record `last_notified_at`.

All secrets go through the secrets tool as env vars — never hardcode keys.
Publishable/anon keys in client code are fine.

---

## 7. Phase 5 — Polish & verification

- Every content route keeps a unique `head()` with title / description /
  `og:title` / `og:description` / `og:type` / `twitter:card`.
- Run the security scan; fix RLS gaps and any public endpoint that leaks PII.
- Verify with a real browser pass: guest home, sign-up → confirm → library empty
  state → add game → wishlist → price alert, then sign out.
- Check light mode and mobile (573px) on every changed screen — the theme
  selector lives in the mobile header on `/` and in `/account` on desktop.

---

## 8. Definition of done

- No file imports `src/lib/mockData.ts`.
- Guest can browse `/`, `/search`, `/deals`, `/games/$gameId` with real data.
- A new user can sign up, sync/add games, wishlist, add a friend and get a price
  alert, all persisted.
- Loading / empty / error states exist on every data-backed surface.
- Typecheck and production build both pass; no console errors on any route.
