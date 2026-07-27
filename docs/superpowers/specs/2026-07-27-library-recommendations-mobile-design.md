# Library, Recommendations, and Mobile Fixes Design

## Goal

Make PlayFinder's library easier to browse, make recommendations genuinely personal and Steam-focused, complete social sign-in nicknames, and repair the mobile navigation and Deals card layout.

## Scope

### Shared interaction polish

All interactive buttons and links styled as buttons receive a consistent hover and keyboard `focus-visible` state. Existing disabled states remain unchanged.

### Library

Library opens on an `All games` view. It combines PlayFinder-saved games, Steam games, and PSN games. The filter control offers `All`, `PlayFinder`, `Steam`, and `PSN`; selecting a filter only changes the visible list.

Steam entries are clickable. A click opens the matching PlayFinder game detail page. If the Steam game does not yet have a catalog mapping, the backend resolves or creates the owner-safe catalog record before returning its detail route.

### Automatic nicknames for social sign-in

Email/password accounts continue to require a user-selected public nickname. On first Google sign-in, the application initializes the nickname from Google's display name. On first Steam sign-in, it initializes the nickname from the Steam persona name. The stored nickname is normalized, made unique with a deterministic safe suffix when needed, and remains editable by the user afterward.

### Recommended for You

The recommender uses, in descending importance:

1. Steam library titles and playtime when Steam is linked.
2. Games saved in PlayFinder Library.
3. Profile preferences.

Every displayed recommendation must be available on Steam and must not already be owned in the linked Steam library or saved in PlayFinder Library. PSN-only games are excluded. A title that is also available on PSN may still be recommended because Steam availability is the eligibility rule.

With Steam linked, Steam activity is the strongest ranking signal. Without Steam, the system uses Library and profile preferences, but still validates that results are available on Steam.

The cache key includes the normalized Steam library/playtime fingerprint, saved-library fingerprint, and recommendation-relevant profile preferences. Changes to any of these inputs create a new cache entry, so the home page stops showing stale or shared results. Candidate generation and ranking must remain deterministic when the AI provider is unavailable, rather than falling back to the same global list for every user.

### Mobile layout

The five fixed bottom-navigation destinations are `Home`, `Library`, `Deals`, `Friends`, and `Profile`. Steam and PSN remain inside Library and are not mobile-nav destinations.

The game-detail page must not create unexplained vertical empty space on a phone viewport.

Deals preserve their visual style but use a mobile-specific vertical card: a wide game cover across the top, then a full-width content area below. The title can use multiple lines rather than being permanently ellipsized. Current price, previous price, discount, and CTA stay inside the content area, wrap as necessary, and never overlap or overflow.

## Error Handling and Safety

- Platform filters show an explicit empty state when no games match.
- A failed Steam catalog resolution leaves the game visible with a clear non-navigation error; it never opens an unrelated title.
- Social identity claims are used only for a new account's initial nickname and are normalized before storage.
- Recommendation provider, Steam Store, and catalog lookup failures return a user-visible fallback state without exposing credentials or cross-user data.

## Acceptance Criteria

- Every button/link-button has hover and keyboard focus feedback.
- Library initially shows all platform sources and each filter shows only its source.
- Steam Library games open the correct PlayFinder game page.
- New Steam and Google accounts have usable public nicknames without a manual setup step; email accounts still choose one.
- Recommendations vary with a user's Steam/library/profile inputs, exclude owned/saved and PSN-only games, and refresh when those inputs change.
- The mobile bottom bar includes Friends and has five destinations.
- Mobile game details have no unintended blank scrollable area.
- Mobile Deals cards show a top cover and readable, non-overflowing title/price content below.
- Focused regression tests, applicable complete test suites, production build, and visual mobile checks pass.
