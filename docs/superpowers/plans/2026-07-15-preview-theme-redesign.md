# Preview-inspired theme redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the completed Game Finder dashboard around the supplied dark Lovable preview and let users choose a light/dark/system appearance with emerald or monochrome accents.

**Architecture:** Continue from the `codex/dashboard-ui-redesign` worktree, which already owns the shared AppShell, navigation, dashboard, and route feature modules. Add a client-side theme preference boundary that resolves semantic CSS tokens on `<html>`; all existing CSS Modules consume those tokens. Recompose the dashboard using only current API data and honest empty states—no new social backend features.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules, Vitest/Testing Library, FastAPI backend (unchanged).

## Global Constraints

- Work in `C:\Users\zagir\PycharmProjects\game_finder\.worktrees\dashboard-ui-redesign` on branch `codex/dashboard-ui-redesign`; do not reset, clean, or overwrite unrelated worktrees.
- Preserve every current route, API contract, authentication flow, game save action, price alert action, Steam action, and Friends comparison flow.
- Do not add backend endpoints, schema migrations, fake LFG sessions, synthetic online statuses, or a fabricated activity feed.
- Default appearance is dark with an emerald accent. Available settings are `system`, `dark`, `light` and accents `emerald`, `mono`; do not add a free-form color picker.
- Desktop navigation is user-collapsible: expanded sidebar by default at >=1200 px, collapsed icon rail by default from 1024–1199 px, drawer/top bar from 768–1023 px, and labelled bottom navigation below 768 px.
- Keep the current accessibility guarantees: semantic landmarks, visible focus, keyboard-safe drawer, touch targets >=44 px, reduced motion, no horizontal page overflow.

---

## Current context for the next chat

- The supplied preview is a black gaming dashboard with a left navigation panel, green primary accent, large hero/search area, image-led game cards, dense side information, and subdued borders/gradients.
- The root checkout is `phase-6` at `292c8e7`; it contains an untracked `DASHBOARD_UI_REDESIGN_HANDOFF.md`. Do not discard it.
- The redesign worktree is currently `codex/dashboard-ui-redesign` at `55cd216`. Its shared shell lives in `web/src/components/layout/AppShell.tsx`, navigation in `web/src/components/navigation/Navigation.client.tsx`, and dashboard in `web/src/features/dashboard/DashboardScreen.client.tsx`.
- Before implementation, inspect the worktree status and read its current handoff/progress artifacts. The prior redesign already split page-specific CSS into feature CSS Modules and added UI primitives; build on that work rather than returning to the old root implementation.

### Task 1: Establish the theme preference boundary

**Files:**
- Create: `web/src/components/theme/ThemeProvider.client.tsx`
- Create: `web/src/components/theme/theme-preferences.ts`
- Create: `web/src/components/theme/ThemeProvider.test.tsx`
- Modify: `web/src/app/layout.tsx`
- Modify: `web/src/app/globals.css`

**Interfaces:**
- Produces `ThemeMode = "system" | "dark" | "light"`, `Accent = "emerald" | "mono"`, `ThemePreferences`, and `useTheme()`.
- `useTheme()` returns `{ mode, accent, resolvedMode, setMode, setAccent }`.
- The document root receives `data-theme="dark|light"` and `data-accent="emerald|mono"`.

- [ ] Write tests that verify the default `dark`/`emerald` preference, restoration from `localStorage`, System mode resolution through `matchMedia`, system-theme change handling, and invalid stored values falling back to the default.
- [ ] Run the focused theme test and verify it fails because the provider does not exist.
- [ ] Implement a narrow client provider that validates and stores preferences under one versioned localStorage key, applies root attributes, and removes its media listener on unmount.
- [ ] Add a small pre-hydration script in the root layout that reads only the theme key and sets the root attributes before React paints; it must use the same defaults as the provider.
- [ ] Replace global hard-coded palette values with semantic tokens for canvas, surface levels, border, foreground, muted text, focus ring, action, danger, and card overlays. Define all four combinations of theme and accent.
- [ ] Run the focused tests, then `npm test`, `npm run lint`, `npx tsc --noEmit --incremental false`, and `npm run build` in `web`.
- [ ] Commit with `feat: add persistent appearance preferences`.

### Task 2: Add appearance controls and the collapsible desktop sidebar

**Files:**
- Create: `web/src/components/theme/AppearanceControls.tsx`
- Create: `web/src/components/theme/AppearanceControls.test.tsx`
- Modify: `web/src/components/navigation/Navigation.client.tsx`
- Modify: `web/src/components/navigation/Navigation.module.css`
- Modify: `web/src/features/profile/ProfileScreen.client.tsx`
- Modify: `web/src/features/profile/ProfileScreen.test.tsx`

**Interfaces:**
- `AppearanceControls` consumes `useTheme()` and exposes labelled native controls for mode and accent.
- Navigation owns a persisted `sidebar-collapsed` local preference; the control has an accessible label that announces the next action.

- [ ] Write failing tests for changing mode/accent from Profile, changing them from the navigation quick control, and preserving the selected values after remount.
- [ ] Add an Appearance section to Profile that uses the shared controls rather than duplicating local theme state.
- [ ] Add an icon control to collapse/expand the persistent desktop sidebar. At large desktop widths it starts expanded unless the user has saved a choice; at 1024–1199 px it defaults collapsed. The choice persists locally.
- [ ] Restyle desktop navigation into the preview-inspired sidebar: clear active background, GF mark, route labels in expanded state, tooltips in collapsed state, Steam/account context in the lower area. Keep tablet drawer and mobile bottom navigation behavior unchanged.
- [ ] Run focused navigation/profile/theme tests; test keyboard focus and `aria-current` in both sidebar states.
- [ ] Run the full frontend verification set and commit with `feat: add appearance controls and collapsible sidebar`.

### Task 3: Recompose the dashboard around actual data

**Files:**
- Modify: `web/src/features/dashboard/DashboardScreen.client.tsx`
- Modify: `web/src/features/dashboard/DashboardScreen.module.css`
- Modify: `web/src/features/dashboard/DashboardScreen.test.tsx`
- Modify: `web/src/components/ui/Panel.module.css`

**Interfaces:**
- Reuse existing API types and functions; do not introduce new network contracts.
- Each dashboard region retains independent `loading`, `error`, `empty`, and `content` states.

- [ ] Write failing tests for unauthenticated discovery content, authenticated library/Steam summaries, independent region failures, and an explicit action before requesting Steam social comparison.
- [ ] Replace the generic top section with a preview-inspired hero: contextual title, immediate search entry point, primary next action, and responsive layout that degrades to one column.
- [ ] Use existing Trending, Upcoming, deal, saved-game, Steam-account, and Friends data to create image-led recommendation, deal-drop, and account-summary cards. Use deterministic image/initial fallbacks.
- [ ] Keep the preview’s social energy without invented data: when Friends data has not been requested, show a clear `Load friends`/`Open Friends` entry point; when Steam is unlinked, show the real connection action; when data is empty, show the relevant next step.
- [ ] Apply restrained gradients, image scrims, metadata chips, compact list rows, and semantic emphasis via theme tokens. Do not make action discovery depend on hover.
- [ ] Run focused dashboard tests, full frontend checks, and commit with `feat: restyle dashboard around game activity`.

### Task 4: Apply the design system to every route

**Files:**
- Modify: route feature CSS Modules under `web/src/features/` and `web/src/app/`
- Modify: relevant existing component tests for Search, Deals, Library, Steam, Friends, Profile, game detail, and Auth

**Interfaces:**
- Public API and route interfaces remain unchanged.
- Shared `Button`, `Panel`, `DataRow`, `PageHeader`, `Toolbar`, and states continue to be the common visual API.

- [ ] Update Search and game detail first: dark/light semantic surfaces, image-card overlays, reliable empty/loading/error states, and preview-style hierarchy without changing result/save behavior.
- [ ] Update Deals and Library next: deal rows emphasize current price and discount using semantic action colors; saved-game rows preserve existing mutation and image-enrichment race protections.
- [ ] Update Steam and Friends: keep Steam linking, sync, recommendation, privacy, and detail workflows intact while presenting library/friend summaries as dense dashboard panels rather than plain forms.
- [ ] Update Profile and authentication: Profile is a calm settings surface with Appearance alongside account/connections/imports; login/register/callback use the same tokens and preserve OAuth behavior.
- [ ] Add or update focused regression tests for every revised interaction; no test may assert cosmetic class names instead of user-visible behavior or accessibility.
- [ ] Run full frontend checks and backend `pytest -q`; commit with `feat: apply preview visual system across routes`.

### Task 5: Responsive, accessibility, and visual verification

**Files:**
- Modify only the modules proven by verification to need corrections.
- Add focused regression tests for each defect found.

- [ ] Inspect the running application at 1440×900, 1024×768, 768×1024, 390×844, and 320×568 in dark/emerald, dark/mono, light/emerald, and light/mono.
- [ ] Verify sidebar expansion persistence, tablet drawer focus trapping/restoration, mobile bottom-nav safe area, keyboard-only traversal, visible focus rings, 200% zoom, and reduced motion.
- [ ] Confirm readable text, border, disabled, selected, error, and success contrast in every theme combination; state must never depend on colour alone.
- [ ] Confirm no horizontal document scroll, content hidden under fixed navigation, image distortion, or hard-coded colour that fails a theme swap.
- [ ] Run final `npm test`, `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run build`, `pytest -q`, and `git status --short` from fresh output.
- [ ] Commit only verified fixes with `fix: polish responsive themed dashboard`.

## Acceptance criteria

- The default experience visibly matches the preview’s dark, green-accented gaming-dashboard character without copying fake content.
- Users can choose Dark, Light, or System mode and Emerald or Mono accent; choices persist and do not cause a light-theme flash.
- The desktop sidebar can be collapsed by the user; tablet and mobile retain accessible compact navigation.
- Every existing workflow remains functional and uses the same backend contract.
- Automated checks pass, and all listed breakpoints/theme combinations pass visual and accessibility QA.
