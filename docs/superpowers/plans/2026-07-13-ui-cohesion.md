# UI Cohesion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Game Finder screen visually consistent and mobile-safe without changing the existing colour palette or functionality.

**Architecture:** Keep styling global because the app already uses a single shared stylesheet. Introduce a lightweight reusable inline-icon component and apply semantic utility classes to existing route components; leave API and data logic untouched.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, global CSS, ESLint.

## Global Constraints

- Retain current CSS colour tokens; do not introduce a new accent palette.
- Preserve routes, API calls, form behaviour, and existing user-facing features.
- Keep primary interactions usable at 320px, with visible keyboard focus and reduced-motion support.

---

### Task 1: Establish the shared visual foundation

**Files:**
- Create: `web/src/components/Icon.tsx`
- Modify: `web/src/app/globals.css`
- Test: `web` build and lint scripts

- [ ] Add a typed inline SVG icon component supporting the icons needed by navigation and actions.
- [ ] Refine global tokens, typography, surfaces, cards, controls, badges, alerts, focus, hover, and reduced-motion rules without changing the defined palette.
- [ ] Run `npm run lint` in `web` and fix newly introduced errors.

### Task 2: Align global navigation and entry screens

**Files:**
- Modify: `web/src/components/Nav.tsx`
- Modify: `web/src/app/login/page.tsx`
- Modify: `web/src/app/register/page.tsx`
- Modify: `web/src/app/globals.css`

- [ ] Add semantic icons and active-route treatment to navigation while retaining the current links and authentication behaviour.
- [ ] Apply consistent visual labels and action grouping to login and registration without altering submission logic.
- [ ] Verify header and auth cards at desktop and 320px widths.

### Task 3: Align discovery and commerce views

**Files:**
- Modify: `web/src/app/page.tsx`
- Modify: `web/src/app/deals/page.tsx`
- Modify: `web/src/app/games/[id]/page.tsx`
- Modify: `web/src/app/globals.css`

- [ ] Add presentational classes/icons for search mode, result metadata, discount and price hierarchy, and primary actions.
- [ ] Ensure cards and price rows retain stable grids, truncation, and reachable controls on small screens.
- [ ] Run `npm run build` in `web` to compile all edited client components.

### Task 4: Align account, library, and connected-service views

**Files:**
- Modify: `web/src/app/favorites/page.tsx`
- Modify: `web/src/app/favorites/[id]/page.tsx`
- Modify: `web/src/app/profile/page.tsx`
- Modify: `web/src/app/steam/page.tsx`
- Modify: `web/src/app/globals.css`

- [ ] Group repeated account actions, add consistent visual status affordances, and make saved-game/Steam rows scan consistently.
- [ ] Preserve all existing connected-service controls and their loading/error state logic.
- [ ] Run `npm run lint` and `npm run build` in `web`.

### Task 5: Visual regression pass

**Files:**
- Modify: `web/src/app/globals.css` only if issues are found

- [ ] Start the app and inspect `/`, `/deals`, `/games/[id]`, `/favorites`, `/profile`, `/steam`, `/login`, and `/register` at desktop and mobile viewport widths.
- [ ] Correct only observed layout regressions, then re-run `npm run lint` and `npm run build`.
