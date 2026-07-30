# Clickable Deals Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Deals cards open the internal game page while retaining an independent Steam storefront action.

**Architecture:** `DealsPage` resolves the existing internal link once per deal. The card becomes a relative container with a full-card internal `Link` overlay. Its visible content sits above the overlay; the Steam anchor receives a higher stacking context, avoiding nested anchors and preserving its external behaviour.

**Tech Stack:** React, TanStack Router, Vitest, Testing Library.

## Global Constraints

- Remove all visible `View on Playfinder` text from Deals.
- The Steam action continues to open in a new tab.
- A deal without an internal target remains non-clickable except for its Steam link.

---

### Task 1: Make deal cards internally clickable

**Files:**
- Modify: `web/src/routes/deals.tsx`
- Test: `web/src/routes/-deals.test.tsx`

**Interfaces:**
- Consumes: `gameLink(deal)` returning router params and optional Steam source search.
- Produces: a card-level internal link at `/games/$gameId` and an independent `Open in Steam` anchor.

- [ ] **Step 1: Write the failing test**

```tsx
expect(screen.queryByRole("link", { name: "View on Playfinder" })).not.toBeInTheDocument();
expect((await screen.findByRole("link", { name: "Open Portal 2 on Playfinder" })).getAttribute("href"))
  .toBe("/games/620?source=steam&title=Portal+2");
expect(screen.getByRole("link", { name: "Open in Steam" })).toHaveAttribute("target", "_blank");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm run test -- --run src/routes/-deals.test.tsx`

Expected: FAIL because the visible `View on Playfinder` link still exists and no card overlay link is rendered.

- [ ] **Step 3: Write minimal implementation**

```tsx
{gameLink(g) && <Link to="/games/$gameId" {...gameLink(g)!} aria-label={`Open ${g.name} on Playfinder`} className="absolute inset-0 z-0" />}
<div className="relative z-10 ...">...</div>
<a className="relative z-20 ..." target="_blank" ...>Open in Steam</a>
```

Apply the same link resolution to the hero card and remove both visible internal-action labels.

- [ ] **Step 4: Run test and type check**

Run: `rtk npm run test -- --run src/routes/-deals.test.tsx` and `rtk npm exec tsc -- --noEmit`

Expected: both exit with code 0.

- [ ] **Step 5: Commit**

```bash
git add web/src/routes/deals.tsx web/src/routes/-deals.test.tsx docs/superpowers/plans/2026-07-30-clickable-deal-cards.md
git commit -m "fix: make deal cards clickable"
```
