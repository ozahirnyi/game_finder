# Profile Sign-out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the signed-in sidebar link read `Profile` and let users sign out from their profile page.

**Architecture:** Keep sidebar navigation as a normal TanStack `Link` to `/profile`. Add a local-only profile action that calls the existing token-clearing API, clears React Query's user cache, and navigates to `/login`.

**Tech Stack:** React, TanStack Router, TanStack Query, Vitest, Testing Library.

## Global Constraints

- Do not add a sidebar dropdown or an API logout request.
- The authenticated sidebar label is exactly `Profile`.
- The profile-page exit label is exactly `Sign out`.
- Sign-out must clear locally cached user data before navigation.

---

### Task 1: Cover the authenticated navigation and profile sign-out behavior

**Files:**
- Modify: `web/src/components/AppShell.test.tsx:24-108`
- Modify: `web/src/test/live-data.routes.test.tsx:9-218`

**Interfaces:**
- Consumes: `clearToken(): void` from `@/lib/api` and TanStack Router's `useNavigate()`.
- Produces: tests that expect `/profile` navigation from a `Profile` link and local logout navigation to `/login`.

- [ ] **Step 1: Write the failing sidebar assertion**

Replace the authenticated link assertion with:

```tsx
expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
  "href",
  "/profile",
);
expect(screen.queryByText("Signed in")).not.toBeInTheDocument();
```

- [ ] **Step 2: Write the failing profile sign-out test**

Extend the API mock with `clearToken: vi.fn()` and mock `useNavigate` to return a `navigate` spy. Add:

```tsx
it("clears local session data and returns to login on sign out", async () => {
  renderPage(<ProfilePage />);
  await screen.findByRole("heading", { name: "player@example.com" });

  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

  expect(api.clearToken).toHaveBeenCalledOnce();
  expect(navigate).toHaveBeenCalledWith({ to: "/login" });
});
```

- [ ] **Step 3: Run the focused tests to verify they fail**

Run: `rtk npm --prefix web test -- AppShell.test.tsx live-data.routes.test.tsx`

Expected: FAIL because the sidebar is labelled `Signed in` and the profile has no `Sign out` action.

- [ ] **Step 4: Commit the failing tests only after review of the red result**

```bash
git add web/src/components/AppShell.test.tsx web/src/test/live-data.routes.test.tsx
git commit -m "test: cover profile sign-out"
```

### Task 2: Implement local profile sign-out

**Files:**
- Modify: `web/src/components/AppShell.tsx:183-190`
- Modify: `web/src/routes/profile.tsx:1-18, 38-105`
- Modify: `web/src/test/live-data.routes.test.tsx:9-218`

**Interfaces:**
- Consumes: `clearToken(): void`, `useNavigate(): (options: { to: "/login" }) => void`, and `QueryClient.clear(): void`.
- Produces: a `Profile` sidebar link and `Sign out` button that clears the token/cache and routes to `/login`.

- [ ] **Step 1: Change the sidebar copy**

In the existing authenticated `Link` in `AppShell`, replace only its label:

```tsx
<span className="truncate text-sm font-semibold">Profile</span>
```

- [ ] **Step 2: Add a profile-local sign-out handler**

Import `useNavigate` and `clearToken`. Inside `ProfilePage`, create:

```tsx
const navigate = useNavigate();
const signOut = () => {
  clearToken();
  client.clear();
  navigate({ to: "/login" });
};
```

Add a secondary button beside `Edit profile`:

```tsx
<button
  type="button"
  onClick={signOut}
  className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground"
>
  Sign out
</button>
```

- [ ] **Step 3: Run focused tests to verify they pass**

Run: `rtk npm --prefix web test -- AppShell.test.tsx live-data.routes.test.tsx`

Expected: both test files pass, including the new sign-out assertions.

- [ ] **Step 4: Run the frontend suite and production build**

Run: `rtk npm --prefix web test && rtk npm --prefix web run build`

Expected: all frontend tests pass and Vite completes the production build with exit code 0.

- [ ] **Step 5: Commit the implementation**

```bash
git add web/src/components/AppShell.tsx web/src/routes/profile.tsx web/src/components/AppShell.test.tsx web/src/test/live-data.routes.test.tsx web/src/routeTree.gen.ts
git commit -m "feat: add profile sign-out"
```
