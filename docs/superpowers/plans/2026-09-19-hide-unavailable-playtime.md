# Hide Unavailable Playtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Profile library cards show only whole-hour playtime when known and omit the playtime row when unavailable.

**Architecture:** Keep the behavior in the existing presentation layer. `ProfileView` decides whether a playtime label exists, while `formatPlaytime` retains responsibility for converting known minute totals into display text.

**Tech Stack:** React 19, TypeScript, Vitest, React Testing Library.

## Global Constraints

- Do not alter profile-library API contracts, storage, or platform import behavior.
- Treat all game sources uniformly: a numeric playtime renders; `null` or `undefined` does not.
- Render complete hours only; do not render minutes.

---

### Task 1: Profile-library playtime presentation

**Files:**
- Modify: `web/src/components/ProfileView.tsx:696`
- Modify: `web/src/components/ProfileView.test.tsx:289-294`
- Modify: `web/src/lib/profileLibrary.ts:4-12`

**Interfaces:**
- Consumes: `ProfileView` game entries with `playtime?: number | null`.
- Produces: `formatPlaytime(minutes: number): string`, which returns a whole-hour label, and a library card that has no playtime element for unavailable data.

- [ ] **Step 1: Write the failing test**

Add two focused assertions to `web/src/components/ProfileView.test.tsx`:

```tsx
it("shows known game playtime as whole hours", () => {
  profile.games[0].playtime = 125;
  renderProfile(false);
  expect(screen.getByText("2h")).toBeInTheDocument();
  expect(screen.queryByText("2h 5m")).not.toBeInTheDocument();
});

it("omits playtime when a game has no playtime data", () => {
  profile.games[0].playtime = null;
  renderProfile(false);
  expect(screen.queryByText("Playtime unavailable")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm.cmd test -- src/components/ProfileView.test.tsx`

Expected: FAIL because the component renders `2h 5m` for 125 minutes and renders `Playtime unavailable` for `null`.

- [ ] **Step 3: Write minimal implementation**

In `web/src/lib/profileLibrary.ts`, return only complete hours:

```ts
export function formatPlaytime(minutes: number) {
  return `${Math.floor(Math.max(0, minutes) / 60)}h`;
}
```

In the profile-library card in `web/src/components/ProfileView.tsx`, render the existing label only when the value is present:

```tsx
{g.playtime != null && (
  <p className="label-mono mt-1.5 text-muted-foreground">
    {formatPlaytime(g.playtime)}
  </p>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm.cmd test -- src/components/ProfileView.test.tsx`

Expected: PASS with all `ProfileView` tests green.

- [ ] **Step 5: Run the affected frontend suite**

Run: `rtk npm.cmd test`

Expected: PASS with no test failures.

- [ ] **Step 6: Commit**

```bash
rtk git add web/src/components/ProfileView.tsx web/src/components/ProfileView.test.tsx web/src/lib/profileLibrary.ts
rtk git commit -m "fix: hide unavailable profile playtime"
```
