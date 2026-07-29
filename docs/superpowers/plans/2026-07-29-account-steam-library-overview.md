# Account Steam Library Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/account` display Steam games and playtime from the unified library overview.

**Architecture:** The account route will replace its legacy `getLibrary()` query with `getLibraryOverview()` and map `overview.games` into the existing `ProfileView` data shape. A route-level test will mock the overview response and observe the data passed to `ProfileView`, proving that Steam entries and minutes are included.

**Tech Stack:** TypeScript, React, TanStack Query, Vitest, React Testing Library.

## Global Constraints

- Change only the self-account route and its focused test.
- Do not alter Steam transport, OpenID, database persistence, friend profiles, or the Library page.
- Derive counts and hours from `LibraryOverview.games` and its `playtime_forever` values.
- Preserve the route's existing empty-data fallback while the query is unresolved.

## File Structure

- `web/src/routes/account.tsx`: Requests the unified overview and transforms overview games into `ProfileView` props.
- `web/src/routes/account.test.tsx`: Mocks the account dependencies and asserts that Steam overview data reaches the profile display.

---

### Task 1: Use the unified overview in the account profile

**Files:**
- Modify: `web/src/routes/account.tsx:1-70`
- Create: `web/src/routes/account.test.tsx`

**Interfaces:**
- Consumes: `getLibraryOverview(): Promise<LibraryOverview>`, where `LibraryOverview.games` is `LibraryOverviewGame[]` and each game has `source: "manual" | "psn" | "steam"` and optional `playtime_forever: number | null`.
- Produces: `ProfileView` props whose `games`, Steam store count, and `hours` include every item in `overview.games`.

- [ ] **Step 1: Write the failing account-route test**

Create `web/src/routes/account.test.tsx` with mocks that isolate the data transformation:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const { getProfile, getLibraryOverview, profileView } = vi.hoisted(() => ({
  getProfile: vi.fn().mockResolvedValue({ display_name: "test1" }),
  getLibraryOverview: vi.fn().mockResolvedValue({
    steam_available: true,
    games: [
      { id: "steam:620", source: "steam", title: "Portal 2", playtime_forever: 180 },
      { id: "manual:1", source: "manual", title: "Hades", playtime_forever: 60 },
    ],
  }),
  profileView: vi.fn(() => null),
}));

vi.mock("@/lib/api", () => ({ getProfile, getLibraryOverview }));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/ProfileView", () => ({ ProfileView: (props: unknown) => profileView(props) }));

import { AccountPage } from "./account";

describe("AccountPage", () => {
  it("uses the unified overview for Steam counts and playtime", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><AccountPage /></QueryClientProvider>);

    await waitFor(() => expect(getLibraryOverview).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(profileView).toHaveBeenLastCalledWith(expect.objectContaining({
      isSelf: true,
      profile: expect.objectContaining({
        hours: 4,
        games: expect.arrayContaining([
          expect.objectContaining({ id: "steam:620", source: "steam", playtime: 3 }),
        ]),
        stores: expect.arrayContaining([expect.objectContaining({ name: "Steam", count: 1 })]),
      }),
    })));
  });
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `rtk npm test -- src/routes/account.test.tsx`

Expected: FAIL because `AccountPage` is not exported and the route still imports `getLibrary` instead of `getLibraryOverview`.

- [ ] **Step 3: Make the minimal account-route change**

In `web/src/routes/account.tsx`, replace the API import and query with:

```tsx
import { getLibraryOverview, getProfile } from "@/lib/api";

export function AccountPage() {
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const libraryQuery = useQuery({ queryKey: ["library-overview"], queryFn: getLibraryOverview });
  const profile = profileQuery.data;
  const owned = libraryQuery.data?.games ?? [];
```

Keep the existing `ProfileView` mapper unchanged below `const owned`, including its source-count and playtime calculations.

- [ ] **Step 4: Run the focused test and production build**

Run: `rtk npm test -- src/routes/account.test.tsx`

Expected: PASS.

Run: `rtk npm run build`

Expected: exit code 0.

- [ ] **Step 5: Commit the route and regression test**

```powershell
rtk git add web/src/routes/account.tsx web/src/routes/account.test.tsx
rtk git commit -m "fix: show Steam overview on account"
```

### Task 2: Submit and audit the released account counters

**Files:**
- Modify: none

**Interfaces:**
- Consumes: passing Task 1 verification and the normal Lightsail release of the merged SHA.
- Produces: a pull request and production evidence that `/account` and `/library` report matching Steam totals.

- [ ] **Step 1: Run the complete frontend test suite**

Run: `rtk npm test`

Expected: exit code 0.

- [ ] **Step 2: Push the branch and open a pull request**

Push `codex/account-steam-overview` and open a pull request describing the stale legacy library source, the new overview source, and the exact test/build commands that passed.

- [ ] **Step 3: Verify after the merged SHA is deployed through Lightsail**

Use `.github/workflows/deploy-lightsail-ssh.yml` to confirm that the merged SHA completed the normal Lightsail deployment. At `/account` while signed in to the affected user, compare Games, Steam, and Hours with `/library`; all Steam game counts and total playtime must agree.
