# Search Restoration Implementation Plan

**Goal:** Restore usable catalog and AI search when RAWG or OpenAI is temporarily unavailable.

**Evidence:** Production `GET /search/games?q=Hades` returns `504 Gateway Timeout` from RAWG; the frontend currently converts any empty/error catalog response into the same empty state. AI search exposes only a generic unavailable state and has no observable contract for upstream errors.

## Tasks

1. Add backend contract tests for RAWG timeout and OpenAI failure responses.
2. Add a cached Steam title-search fallback to `/search/games`; return catalog-shaped Steam results with `steam_appid`, title, image, and store URL when RAWG times out.
3. Make catalog results route Steam fallback games with `source=steam`, avoiding a second RAWG lookup.
4. Add an explicit AI-search backend fallback/timeout policy and return a structured, user-visible error only when no recommendation fallback is available.
5. Add frontend tests for catalog fallback cards, loading/error distinction, and AI fallback/error rendering.
6. Verify with focused tests, full backend/frontend suites, and production requests to both search modes.
