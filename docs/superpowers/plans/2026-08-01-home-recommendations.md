# Home Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore truthful personalized recommendations on Home and real trending games for guests.

**Architecture:** Add typed dashboard transport to the frontend API client. The Home route chooses authenticated dashboard recommendations or guest trending catalog games and never substitutes one for the other.

**Tech Stack:** React, TanStack Query/Router, Vitest, FastAPI's existing dashboard and catalog endpoints.

## Global Constraints

- Do not alter backend recommendation ranking or API contracts.
- Do not display synthetic recommendations for a signed-in user.
- Link only confirmed IDs to `/games/$gameId`.

---

### Task 1: Add a typed authenticated dashboard client

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/lib/api.test.ts`

- [x] **Step 1: Add a failing API-client test**

```ts
setToken("token");
await getDashboard();
expect(fetchMock).toHaveBeenCalledWith("/api/dashboard", expect.objectContaining({
  headers: expect.objectContaining({ Authorization: "Bearer token" }),
}));
```

- [x] **Step 2: Run it (RED)**

Run: `rtk npm --prefix web test -- src/lib/api.test.ts`

- [x] **Step 3: Add types and client function**

```ts
export type Dashboard = { recommendations: DataBlock<RecommendationItem[]> };
export function getDashboard() { return apiRequest<Dashboard>("/dashboard", { auth: true }); }
```

- [x] **Step 4: Run it (GREEN)**

Run: `rtk npm --prefix web test -- src/lib/api.test.ts`

### Task 2: Render recommendation states on Home

**Files:**
- Modify: `web/src/routes/index.tsx`
- Create: `web/src/routes/-index.recommendations.test.tsx`

- [x] **Step 1: Add failing Home tests**

Cover: authenticated ready recommendation with ID link; authenticated empty message; authenticated error message; guest trending catalog card.

- [x] **Step 2: Run tests (RED)**

Run: `rtk npm --prefix web test -- src/routes/-index.recommendations.test.tsx`

- [x] **Step 3: Implement minimal sections**

```tsx
const dashboardQuery = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard, enabled: signedIn });
const trendingQuery = useQuery({ queryKey: ["trending-games"], queryFn: getTrendingGames, enabled: !signedIn });
```

Render the signed-in `DataBlock` states explicitly. Render guests through `GameCard` with `gameId: String(game.id)`. Use a direct `Link` for recommendation items only when `rawg_id != null`.

- [x] **Step 4: Run tests (GREEN)**

Run: `rtk npm --prefix web test -- src/routes/-index.recommendations.test.tsx`

### Task 3: Verify and commit

**Files:**
- Modify: files in Tasks 1–2 plus this plan's checkboxes.

- [x] **Step 1: Run focused tests and build**

Run: `rtk npm --prefix web test -- src/lib/api.test.ts src/routes/-index.recommendations.test.tsx` and `rtk npm --prefix web run build`.

- [x] **Step 2: Run targeted lint and inspect staged diff**

Run: `rtk npx --prefix web eslint src/lib/api.ts src/lib/api.test.ts src/routes/index.tsx src/routes/-index.recommendations.test.tsx` and `rtk git diff --cached --check`.

- [x] **Step 3: Commit**

Commit: `feat: restore home recommendations`.
