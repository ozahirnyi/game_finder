# PlayFinder catalog actions and OAuth design

## Goal

Allow authenticated PlayFinder users to save catalog games to their library and wishlist, link Steam and Google accounts, and authenticate with either provider. Ship the supported public URLs to production without committing secrets.

## Scope and constraints

- Work only on branch `codex/catalog-actions-and-oauth`, created from `origin/main`; the pull request targets `main`.
- Do not use or modify `phase-6`.
- New user-facing copy uses the PlayFinder brand.
- OAuth tokens never appear in redirects, query strings, or logs. Browser redirects carry only the existing one-time `exchange_code`.
- The deployment changes only public URL environment values. OAuth credentials and API keys remain server-side secrets.

## Architecture

### Catalog persistence

The existing `Game` model remains the user's library. A new authenticated endpoint, `POST /library/catalog-games/{rawg_id}`, fetches the catalog record server-side and creates a `Game` using `source="catalog"` and `external_id="rawg:{rawg_id}"`. It returns `201` for a new row and `200` for the existing row, relying on the existing owner/source/external-id uniqueness invariant. `GET /games` already exposes `source` and `external_id`, so the UI can build its library state from a single request.

Wishlist does not have a durable data model: it currently overloads `Game.notes`. Introduce one focused wishlist persistence model with `owner_id`, title/detail display data, `source`, and `external_id`, with a unique owner/source/external-id constraint. Its catalog create endpoint fetches RAWG data on the server, is idempotent, and its list endpoint lets the client derive all card states in one request. Existing manually saved games remain library games; no notes-based migration is performed because those text markers are ambiguous.

### Frontend catalog actions

Replace mock search results with catalog search data that carries RAWG IDs, while retaining an explicit link to details. A shared catalog-actions component receives a catalog game and renders only for authenticated users. It queries the library and wishlist lists once, exposes independent mutations, stops click propagation inside search cards, and changes each label through adding, error/retry, and saved states. The detail route uses the same component.

### OAuth and Steam linking

Login and registration present Google and Steam buttons that request the existing backend login URLs before navigating. A TanStack `/auth/callback` route validates query parameters, exchanges the one-time code for a token, stores it with the existing token helper, invalidates auth/profile queries, and redirects to `/profile`. Invalid callbacks display a recoverable sign-in error without setting a token. The obsolete Next callback page is removed or made unreachable.

For existing accounts, profile links Google via the existing protected link-URL endpoint. Steam's screen requests the protected `/steam/login-url` and navigates to that response instead of linking to itself. Its `linked=1` and `error` parameters drive success/error UI and query invalidation.

### Deployment

Set only these public endpoint variables in Lightsail's server environment:

```dotenv
FRONTEND_ORIGIN=https://playfinder.cc
FRONTEND_ORIGINS=https://playfinder.cc
FRONTEND_PUBLIC_URL=https://playfinder.cc
BACKEND_PUBLIC_URL=https://playfinder.cc/api
GOOGLE_REDIRECT_URI=https://playfinder.cc/api/auth/google/callback
```

Add the same Google callback URI in Google Cloud Console. Deploy the merged `main` branch via the repository's standard Lightsail procedure, then verify health and Google configuration without disclosing secret values. Manually test Google login, Steam login, Google linking, and Steam library linking on `https://playfinder.cc`.

## Error handling and security

- Catalog persistence rejects guests through the standard auth dependency and does not accept client-provided title, source, or external ID as truth.
- Source lookup failures produce a clear API error and leave no partial persistence.
- Concurrent repeat requests resolve to one row per owner and external ID.
- OAuth UI reports unavailable providers and expired/invalid exchange codes without authenticating the browser.
- Steam link errors never present the account as connected.

## Verification

- Backend tests cover new/repeated catalog saves, per-user isolation, and guest rejection for both library and wishlist.
- Frontend tests cover authenticated and guest catalog actions, stopped card navigation, successful status changes, detail actions, Steam navigation and callback feedback, OAuth URL buttons, and callback token/error handling.
- Run focused tests during TDD, then all backend tests plus frontend test, lint, and build commands defined by the repository.
- Before merging, verify the actual deployed `/api/health` and `/api/auth/google/status` endpoints and complete browser flows.
