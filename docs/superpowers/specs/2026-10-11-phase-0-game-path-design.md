# PlayFinder Phase 0: Existing Path to a Game

**Status:** Agreed design, 11 October 2026

**Baseline:** `origin/main` at `a1ec6f0` when this document was written

**Source documents:** `user-experience-pipelines-v3.md` and `playfinder-roadmap-phases.md`, supplied by the user.

## Goal and scope

A person can find a game, recognize whether it is already in their library, and choose an available next action: open its store, save it to the wishlist, set a price alert, or return to the owned game. Phase 0 covers the game detail page, ordinary search, home recommendations, AI search results, and the in-app and Telegram price-alert path. It does not add party features, Discord delivery, wider discovery filters, recommendation-copy personalization, or mass confirmation of PlayStation and manual-library catalog matches. The latter is a follow-on item after Phase 0; PlayStation import already performs batch matching and the repair page already lists suggestions.

## Confirmed product decisions

1. A Steam-only game with no catalog match has a full detail page, wishlist action, and price-alert action.
2. An owned game shows an explicit library state and link to the library. The game page hides wishlist and price-alert actions for it, regardless of whether it was acquired through Steam, PlayStation, or a manually added library record.
3. When a wishlisted game with an active alert becomes owned, the alert is disabled automatically and the user is informed. Its settings and history remain available for inspection. Removal of ownership does not automatically re-enable the alert.
4. A triggered price-alert notification opens the correct game page with a prominent snapshot of the matching offer and a store action. It does not send the user straight to an external store.
5. An AI recommendation without a verified catalog match remains visible as a title and explanation with a search action. If a trustworthy Steam appid is supplied by the provider, it may open a Steam-only page. A title alone never silently opens a merely similar game.

## Identity and ownership

Treat `(source, external_id)` as the identity of a saved game and the wishlist UUID as the identity of a wishlist entry. IGDB IDs and Steam appids are separate namespaces even when their numeric values happen to match. A catalog detail page can check ownership using its IGDB ID and its verified Steam appid; a Steam-only page checks the appid. PlayStation and manual records count as owned on a catalog page only when they carry a confirmed `catalog_game_id`. Unlinked records must not be matched on title alone.

Add an authenticated, owner-scoped membership response for a detail-page target. It returns the matched library record IDs and sources so the page can show a clear owned state and a library link. A guest sees no personal state and is invited to sign in for wishlist or alert actions. Loading errors must not be presented as a confident “not owned” result. A current session must not receive another user's library records.

The server uses the same identity rules when accepting a new wishlist entry or alert. This prevents a direct API call from activating an alert for a game the connected library already shows as owned. Existing alerts that become owned are paused through a shared service called after library additions and synchronization, with a watcher-side check as a final safeguard. Pausing stores a reason and time and creates one in-app notice. It does not delete the wishlist entry or alert. Repeated syncs do not produce duplicate notices.

## Detail-page actions

The detail-page action area has three states:

| State | Visible result |
| --- | --- |
| Owned | “In your library” with source and link to Library; no wishlist or alert action; store link remains available |
| Wishlisted, not owned | “In wishlist”; alert can be created or its current state inspected; store link remains available |
| Neither, not owned | Add to wishlist, set alert, and open store when a verified store link exists |

Setting an alert may save the game to the wishlist first, but the mutation must use the provider-specific wishlist endpoint and then the returned wishlist UUID. It must not infer the target from `catalog_game_id`. A failed wishlist save cannot create an alert.

## Search and recommendation routes

Ordinary search cards use a verified IGDB ID or Steam appid. Home recommendation cards use a verified IGDB ID; unresolved cards show their title, reason, and a search action. AI recommendation enrichment preserves model output when catalog matching returns no exact result or temporarily fails, and marks the resolution status. The UI renders a route only for a verified target. An unmatched result is labeled as such and offers a search by title. Catalog unavailability is communicated separately from a genuine no-match result.

The game-detail loader verifies the fetched ID. It must not silently substitute a different catalog item after a failed ID lookup using a loose title prefix. A broken target yields a recoverable “game unavailable” path with search by title. Navigation retains a return path to the original result list.

## Price-alert lifecycle and offer navigation

Create alerts by wishlist UUID. Keep the current numeric field temporarily for older clients only if the server can resolve it unambiguously as a catalog entry; ambiguous numeric identities return an explicit error. Alert reads include wishlist UUID, provider identity, and active or paused status. Add a database migration for alert pause metadata and update the Pydantic and frontend contracts together.

The watcher checks active alerts against a regional Steam offer. It records the matching offer's shop, price, currency, discount, URL, and observation time in the in-app notification payload, with `source` and `external_id` for routing. A source-aware notification route opens `/games/$gameId`; Steam-only targets include `source=steam`. The URL also carries the notification ID, allowing the detail page to load the owner-scoped saved offer and show it after a reload. Legacy catalog-only notifications still open the catalog page. Store URLs are accepted only from the trusted price-provider result and rendered as external links; missing or obsolete offers fall back to the game page with a clear message.

In-app delivery must happen once per offer key. Telegram delivery happens only for a connected account that selected it and succeeds before its delivery key is updated. Provider failure or a failed Telegram send must not mark the alert delivered. Whether the production watcher is enabled is not established by the repository; `.env.example` and Compose default it to `false`, so deployment configuration requires a separate read-only check before any production delivery claim.

## Verification and release criteria

- Backend tests cover owner isolation, cross-provider numeric ID collision, linked and unlinked ownership, wishlisting and alert creation, auto-pause idempotency, watcher thresholds and deduplication, delivery failure, and owner-scoped offer retrieval.
- Frontend tests cover owned, wishlisted, new, and Steam-only detail states; search, home, and AI routing; unmatched and unavailable AI results; and both new and legacy notification links.
- A controlled end-to-end run uses a test account and stubbed price provider to exercise setup, trigger, in-app delivery, optional Telegram delivery through a stub, notification click, correct game page, offer snapshot, and store link. No live API key or production alert is required by automated tests.
- Browser acceptance checks confirm ordinary search, home recommendation, a resolved AI result, an unresolved AI result, Steam-only and owned pages, and the alert navigation. Results from 8 October are hypotheses until repeated. The 11 October public-browser check confirmed only ordinary Counter-Strike 2 search navigation and a Steam-only page with a disabled alert in a QA account with an empty library.

Phase 0 is complete when these paths pass focused tests and a browser scenario without a wrong game target, false ownership claim, duplicate alert, dead action, or broken notification destination.
