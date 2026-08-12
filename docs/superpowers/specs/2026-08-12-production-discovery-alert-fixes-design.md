# Production discovery and alert fixes

## Goal

Repair the confirmed production regressions without changing backend alert contracts or introducing fake catalog or AI data.

## Approved behaviour

- Wishlist shows every existing alert with an accessible Cancel action. Cancellation uses the existing owner-scoped `DELETE /price-alerts/{id}` endpoint.
- Discovery has compact top-level filters: On sale, Co-op, Solo, PC, Consoles, Multiplayer, plus a genres disclosure. Consoles expands to PS5, PS4, Xbox Series, Xbox One, and Switch. All selected filters intersect with title search and each other.
- Deal discovery uses only confirmed current deals. IGDB predicates and deal-enrichment matching receive integration-level coverage, rather than only mocked route forwarding.
- UI platform labels group Windows/macOS/Linux as PC while retaining specific console labels. Game Detail shows a grouped compact summary and can reveal the full normalized list.
- Rating is displayed whenever the catalog response has a finite positive rating; absent ratings have an explicit fallback.
- AI remains truthful: a missing or failed configured provider produces the existing unavailable state, never fabricated recommendations. Deployment configuration must supply `OPENAI_API_KEY` for live AI results.

## Non-goals

- No Home, AppShell, Library, Steam, PSN, Deals replacement or unrelated backend contract change.
- No fallback recommendations, migrations, or new notification delivery providers.

