# Profile and Steam Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate profile concerns into clear panels and make Steam content compact until requested.

**Architecture:** Keep all existing API calls and state in the two page components. Reorganise the existing markup around semantic sections and native `details` disclosures, then use responsive CSS grids to place the Steam library in a narrow sidebar on desktop.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS.

## Global Constraints

- Do not change API calls, authentication, data mutation, imports, or connection flows.
- Reuse the existing monochrome token system and preserve keyboard-visible focus.
- At narrow widths, Steam returns to a single-column layout.

---

### Task 1: Organise Profile panels

**Files:**
- Modify: `web/src/app/profile/page.tsx`
- Modify: `web/src/app/globals.css`
- Test: `web` lint and build scripts

**Interfaces:**
- Consumes: existing `UserRead`, `TelegramAccount`, saved-game, PSN, and Telegram state.
- Produces: a semantic profile layout where the Steam status card links to `/steam`.

- [ ] **Step 1: Update the Profile markup**

Wrap each existing content area in an explicitly headed Account, Your library, PlayStation, Steam, or Telegram panel. Move Google connection controls into Account. Add a `Link` with class `profile-steam-link` and `href="/steam"` that shows `telegram`-independent Steam connection context without a nested button.

- [ ] **Step 2: Add profile layout styles**

Add panel spacing, the focused/hovered Steam link treatment, and responsive grid rules to `web/src/app/globals.css`. Preserve existing styles for saved rows and import/Telegram controls.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/profile/page.tsx web/src/app/globals.css
git commit -m "feat: group profile integrations"
```

### Task 2: Compact Steam disclosures and sidebar library

**Files:**
- Modify: `web/src/app/steam/page.tsx`
- Modify: `web/src/app/globals.css`
- Test: `web` lint and build scripts

**Interfaces:**
- Consumes: existing Steam account, library, social, and recommendation state and handlers.
- Produces: native `details` panels for AI and friends, plus a compact `Most played games` sidebar.

- [ ] **Step 1: Update Steam markup**

Place the AI and friends panels in a new primary-column wrapper. Change each to a `details` element with a `summary` containing the existing title and status; move the existing interactive contents after the summary. Move the existing library panel to a sidebar wrapper while retaining its game list and Show more/less handlers.

- [ ] **Step 2: Add disclosure and two-column styles**

Add styles for the primary/sidebar Steam grid, compact summary rows, open disclosure spacing, a narrower game-row list, and a single-column responsive breakpoint. Keep the Friends and AI blocks full primary-column width.

- [ ] **Step 3: Run lint and production build**

Run: `npm run lint && npm run build`

Expected: both commands exit code 0.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/steam/page.tsx web/src/app/globals.css
git commit -m "feat: compact steam panels"
```
