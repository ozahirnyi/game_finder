# Lovable Literal Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing Next.js presentation layer with the supplied Lovable interface without visual adaptation.

**Architecture:** The archive is the single source of truth for markup, CSS, component boundaries and mock data. Next.js App Router is only a route/runtime adapter: each Next page renders the corresponding copied Lovable route component, while Vite/TanStack bootstrap files remain outside the application.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Radix UI, lucide-react, Recharts, Vitest.

## Global Constraints

- Preserve the source archive’s JSX structure, CSS classes, copy, mock data, and visual tokens; do not redesign or substitute the former monochrome UI.
- Do not import Vite/TanStack startup code, generated route tree, or Lovable error-reporting infrastructure.
- `web/src/lib/api.ts` remains in the repository but is not used by the literal-port screens.
- The target route map is `/`, `/search`, `/library`, `/wishlist`, `/deals`, `/friends`, `/steam`, `/psn`, `/profile`, and `/games/[id]`.
- `/favorites` redirects to `/library`; `/favorites/[id]` redirects to `/games/[id]`.
- Use `rtk` before every shell command and `apply_patch` for edits.

---

### Task 1: Bring the Lovable design runtime into Next.js

**Files:**
- Modify: `web/package.json`, `web/package-lock.json`, `web/src/app/globals.css`, `web/src/app/layout.tsx`
- Create: `web/src/lib/mockData.ts`, `web/src/lib/theme.tsx`, `web/src/components/lovable/AppShell.tsx`, `web/src/components/lovable/GameCover.tsx`, `web/src/components/lovable/ThemeSelector.tsx`, `web/src/components/lovable/ui-bits.tsx`, `web/src/components/lovable/ui/*`
- Test: `web/src/components/lovable/AppShell.test.tsx`

**Interfaces:**
- Produces: `AppShell({ children }: { children: ReactNode })`, `GameCover`, `Avatar`, and `ThemeProvider` copied from the archive for all route tasks.

- [ ] **Step 1: Write the failing shell parity test**

```tsx
it('renders the archive navigation labels and compact mobile navigation', () => {
  render(<AppShell><p>Content</p></AppShell>);
  expect(screen.getByText('GameFinder')).toBeVisible();
  expect(screen.getAllByText('Wishlist').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Friends').length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run the parity test and confirm red**

Run: `rtk npm test -- AppShell.test.tsx`

Expected: FAIL because the literal Lovable shell module does not exist.

- [ ] **Step 3: Copy the visual runtime without redesigning it**

Copy the archive files listed above exactly, retaining Tailwind classes, theme variables, nav order, labels, gradient artwork, and `mockData` exports. Add archive dependencies to `web/package.json`, configure Tailwind CSS 4 through `globals.css`, and replace the existing root layout with `ThemeProvider` and `AppShell`.

```tsx
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="dark"><body><ThemeProvider><AppShell>{children}</AppShell></ThemeProvider></body></html>;
}
```

- [ ] **Step 4: Run the focused test and static checks**

Run: `rtk npm test -- AppShell.test.tsx; rtk npm run lint; rtk npx tsc --noEmit --incremental false`

Expected: the test passes and static commands exit 0.

- [ ] **Step 5: Commit**

Run: `rtk git add web/package.json web/package-lock.json web/src/app/globals.css web/src/app/layout.tsx web/src/lib/mockData.ts web/src/lib/theme.tsx web/src/components/lovable; rtk git commit -m "feat: port lovable design runtime"`

### Task 2: Copy every Lovable screen into App Router routes

**Files:**
- Create: `web/src/features/lovable/{Home,Search,Library,Wishlist,Deals,Friends,Steam,Psn,Profile,GameDetail}Screen.tsx`
- Modify: `web/src/app/page.tsx`, `web/src/app/search/page.tsx`, `web/src/app/deals/page.tsx`, `web/src/app/friends/page.tsx`, `web/src/app/steam/page.tsx`, `web/src/app/psn/page.tsx`, `web/src/app/profile/page.tsx`, `web/src/app/wishlist/page.tsx`, `web/src/app/games/[id]/page.tsx`, `web/src/app/favorites/page.tsx`, `web/src/app/favorites/[id]/page.tsx`
- Test: `web/src/features/lovable/routes.test.tsx`

**Interfaces:**
- Consumes: Task 1 components and exact `games`, `friends`, `activity`, `aiRecommendations`, `priceHistory`, and `currentUser` mock exports.
- Produces: an App Router route entry for each archive route.

- [ ] **Step 1: Write failing literal route tests**

```tsx
it.each([
  ['/', 'Discover your next game'], ['/friends', 'Friends'], ['/wishlist', 'Wishlist'],
  ['/steam', 'Steam library'], ['/psn', 'PlayStation'], ['/profile', 'Profile'],
])('renders the archive screen %s', async (path, text) => {
  renderRoute(path);
  expect(await screen.findByText(text)).toBeVisible();
});
```

- [ ] **Step 2: Run the route test and confirm red**

Run: `rtk npm test -- routes.test.tsx`

Expected: FAIL because the copied route screens are absent.

- [ ] **Step 3: Copy route JSX with only routing substitutions**

For each archive `src/routes/*.tsx`, copy its JSX and local interaction state into its matching `features/lovable/*Screen.tsx`. Replace only `Link` with `next/link`, `useNavigate` with `useRouter`, `useRouterState` with `usePathname`, and `$gameId` with `params.id`. Do not replace mock values with API requests or reword labels.

```tsx
export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GameDetailScreen gameId={id} />;
}
```

Use `redirect('/library')` for `/favorites` and `redirect(`/games/${id}`)` for `/favorites/[id]`.

- [ ] **Step 4: Run the full frontend suite and production build**

Run: `rtk npm test; rtk npm run lint; rtk npx tsc --noEmit --incremental false; rtk npm run build`

Expected: all commands exit 0 and the build lists every copied route.

- [ ] **Step 5: Commit**

Run: `rtk git add web/src/app web/src/features/lovable; rtk git commit -m "feat: copy lovable screens into next routes"`

### Task 3: Literal visual comparison and Railway deployment

**Files:**
- Modify: only files required by a failing visual-parity test.
- Test: `web/src/features/lovable/routes.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–2 on the integrated branch.
- Produces: a public Railway site using the literal archive interface.

- [ ] **Step 1: Compare source structure**

Run: `rtk rg -n "createFileRoute|mockData|AppShell|ThemeSelector" C:\Users\zagir\AppData\Local\Temp\lovable-project-cf1fe460-inspect\src; rtk rg -n "mockData|AppShell|ThemeSelector" web\src`

Expected: every archive route has a matching Next screen and copied components use the archive mock data.

- [ ] **Step 2: Add a failing parity regression only if comparison finds a missing label, screen, or mock-data section**

```tsx
it('keeps the archive user profile copy', () => {
  renderRoute('/profile');
  expect(screen.getByText('Co-op maxi. Roguelikes, tactical shooters, immersive sims.')).toBeVisible();
});
```

- [ ] **Step 3: Make the smallest literal-copy correction and run verification**

Run: `rtk npm test; rtk npm run lint; rtk npx tsc --noEmit --incremental false; rtk npm run build; rtk pytest -q`

Expected: every command exits 0.

- [ ] **Step 4: Deploy the `web/` directory to Railway production**

Run: `rtk railway up web --path-as-root --service web --environment production --ci --message "Deploy literal Lovable frontend"`

Expected: Railway emits `Deploy complete`.

- [ ] **Step 5: Verify the public endpoint and commit any parity correction**

Run: `rtk curl.exe -sS -o NUL -w "%{http_code}" https://web-production-1d5b1.up.railway.app/`

Expected: `200`.

## Execution Order

Tasks 1–3 are sequential because visual runtime, routes, and deployment share the same source tree.

