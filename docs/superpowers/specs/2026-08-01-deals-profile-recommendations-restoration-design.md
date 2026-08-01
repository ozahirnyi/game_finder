# Deals, profile, and recommendation navigation restoration

## Goal

Restore the pre-Lovable discovery flow: game-detail navigation from recommendations, four popular discounted Steam games, five genre deal sections, and editable profile genres and platforms.

## Design

- Enrich Steam-based recommendations with exact RAWG matches so every returned card has a catalog id and links to `/games/:gameId`.
- Restore the existing `/prices/genre-deals` client on the Deals page. Its backend already returns four Steam popular deals and five sections containing at most five genre-matching deals. Profile genres take priority; the fallback order is Action, RPG, Adventure, Strategy, Indie.
- Extend the self-profile settings modal with multi-select chips for favourite genres and preferred platforms. Persist both through the existing profile update API and invalidate profile, dashboard, and genre-deals queries after save.

## Scope

No schema migration or new external provider is required. Deal data, profile fields, and genre-selection fallback already exist in the backend.

## Verification

- Recommendation cards from Steam candidates have a RAWG id and render a game-detail link.
- Deals UI renders four popular cards and five genre sections from the existing grouped API.
- Profile settings saves selected genres and platforms and refreshes recommendation/deal query data.
