# AI Search, Wishlist Price, and Steam Link Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep completed AI results available after Back navigation, show wishlist prices, and surface Steam account-conflict feedback.

**Architecture:** URL search state restores AI mode and prompt, while React Query retains the completed recommendation response for the current browser session. Wishlist cards independently query cached price history using the profile region. Steam callback errors redirect to Account and the connected-services component renders them.

**Tech Stack:** React, TanStack Router, TanStack Query, Vitest, FastAPI, pytest.

## Global Constraints

- Never re-run the rate-limited AI endpoint when restoring completed results.
- Preserve exactly the resolved recommendation payload from the original request.
- Prices use `profile.price_country_code`, defaulting to `US` only when unset.
- A conflicting Steam account produces a visible error, not a 404 route.

---

### Task 1: Restore completed AI searches

**Files:**
- Modify: `web/src/routes/search.tsx`
- Test: `web/src/routes/-search.test.tsx`

- [ ] Add a failing route test that submits an AI query, remounts the route with its original QueryClient and URL, and expects the five cards without a second `/recommendations` request.
- [ ] Add `mode=ai` to the URL when AI mode is selected and initialize mode from it.
- [ ] Write each successful response into a long-lived React Query cache key derived from the submitted prompt; read that query for rendering after remount.
- [ ] Run `npm test -- --run src/routes/-search.test.tsx` from `web`.

### Task 2: Display wishlist prices

**Files:**
- Modify: `web/src/routes/wishlist.tsx`
- Modify: `web/src/lib/collectionPresentation.ts`
- Modify: `web/src/lib/collectionPresentation.test.ts`
- Test: `web/src/routes/-wishlist.test.tsx`

- [ ] Add a failing wishlist test with a current USD price and assert the card displays `19.99 USD`.
- [ ] Query the profile for the preferred country and request a price-history entry per wishlist catalog ID.
- [ ] Format current prices in the presentation helper and retain the unavailable label only for missing data.
- [ ] Run `npm test -- --run src/routes/-wishlist.test.tsx src/lib/collectionPresentation.test.ts` from `web`.

### Task 3: Surface Steam conflict errors

**Files:**
- Modify: `app/main.py`
- Modify: `web/src/components/ConnectedServices.tsx`
- Test: `tests/integration/backend/test_callback_edges_api.py`
- Test: `web/src/components/ConnectedServices.test.tsx`

- [ ] Add a failing callback test for a Steam ID linked to another user; expect a 303 Location beginning `/account?steam_error=`.
- [ ] Redirect Steam callback failures to Account under `steam_error`.
- [ ] Read `steam_error` in ConnectedServices and render it inline.
- [ ] Run the focused pytest and Vitest files.

### Task 4: Integration verification

- [ ] Run the full frontend test suite and backend pytest suite.
- [ ] Run formatting/type/lint checks configured by `web/package.json`.
- [ ] Review the diff, commit the implementation, push `codex/ai-search-wishlist-steam`, and open a pull request.
