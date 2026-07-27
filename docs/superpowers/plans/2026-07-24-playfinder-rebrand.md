# PlayFinder rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every active user-facing `GameFinder`/`Game Finder` label with `PlayFinder` without changing production data or session identifiers.

**Architecture:** Keep the existing application structure and replace only public copy: React components and route metadata, FastAPI/Telegram messages, tests, and README. Technical identifiers remain unchanged and are deliberately excluded from source scans.

**Tech Stack:** React/TanStack Start, Vitest, FastAPI, pytest, Docker Compose.

## Global Constraints

- Work only on `codex/playfinder-rebrand` and open a PR only into `main`.
- The canonical spelling is exactly `PlayFinder`.
- Preserve `game_finder_token`, Docker/DB names, module paths, environment variable names, and historical documents.
- Do not commit secrets or modify production data.

---

### Task 1: Rebrand rendered frontend and metadata

**Files:**
- Modify: `web/src/components/AppShell.tsx`, `web/src/components/Nav.tsx`, `web/src/components/lovable/AppShell.tsx`
- Modify: `web/src/routes/__root.tsx`, `web/src/routes/games.$gameId.tsx`, `web/src/routes/friends.tsx`, `web/src/routes/deals.tsx`, `web/src/routes/wishlist.tsx`
- Test: `web/src/components/lovable/AppShell.test.tsx`, `web/src/test/friends-social.routes.test.tsx`

**Interfaces:**
- Produces: visible app branding and browser/OG metadata with `PlayFinder`.

- [ ] **Step 1: Write failing branding expectations**

Change the app-shell expectation to:

```tsx
expect(screen.getAllByText("PlayFinder").length).toBeGreaterThan(0);
```

Add a route metadata assertion that checks a representative title contains
`PlayFinder`.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm test -- --run src/components/lovable/AppShell.test.tsx src/test/friends-social.routes.test.tsx`

Expected: FAIL because visible labels and metadata still use the old brand.

- [ ] **Step 3: Replace active frontend copy**

Replace `GameFinder` and `Game Finder` in the listed rendered components,
route titles, descriptions, Open Graph content, friend UI copy, and fallback
notification copy with `PlayFinder`. Do not change `game_finder_token`.

- [ ] **Step 4: Verify frontend behavior**

Run: `npm test -- --run src/components/lovable/AppShell.test.tsx src/test/friends-social.routes.test.tsx && npm run build`

Expected: focused tests and the production build pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/components web/src/routes web/src/test
git commit -m "feat: rename frontend brand to PlayFinder"
```

### Task 2: Rebrand backend messages and active documentation

**Files:**
- Modify: `app/main.py`, `app/telegram.py`, `README.md`
- Test: `tests/test_playfinder_branding.py`

**Interfaces:**
- Produces: API/Telegram messages and active README branding with `PlayFinder`.

- [ ] **Step 1: Write a failing active-copy scan**

Create `tests/test_playfinder_branding.py` that reads the listed files and
asserts each contains `PlayFinder` and none contains `GameFinder` or
`Game Finder`.

- [ ] **Step 2: Run the test and confirm failure**

Run: `pytest -q tests/test_playfinder_branding.py`

Expected: FAIL with the old public brand found in one or more active files.

- [ ] **Step 3: Replace backend and README copy**

Update Telegram alert text, friend/invitation errors, and README heading and
active product references to `PlayFinder`. Keep database URLs and technical
`gamefinder` identifiers unchanged.

- [ ] **Step 4: Verify focused and full tests**

Run: `pytest -q tests/test_playfinder_branding.py && pytest -q`

Expected: focused branding test and full backend suite pass.

- [ ] **Step 5: Commit**

```bash
git add app/main.py app/telegram.py README.md tests/test_playfinder_branding.py
git commit -m "feat: rename public backend brand to PlayFinder"
```

### Task 3: Final source scan and release verification

**Files:**
- Verify only.

**Interfaces:**
- Consumes: active frontend, backend, and README source from Tasks 1-2.
- Produces: evidence that user-visible sources have no old brand.

- [ ] **Step 1: Scan active public source**

Run a constrained search over `web/src`, `app`, and `README.md` for
`GameFinder|Game Finder`.

Expected: no matches, except intentionally excluded technical identifiers
such as `game_finder_token` which do not match this case-sensitive scan.

- [ ] **Step 2: Run the full release checks**

Run: `pytest -q && npm test -- --run && npm run build && git diff --check`

Expected: all commands exit 0.

- [ ] **Step 3: Request review, push, and open a PR into main**

Use the repository's reviewed branch workflow. Do not create or target a
`phase-6` PR.
