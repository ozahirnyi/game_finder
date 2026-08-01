# Home Recommendations Design

## Goal

Restore a truthful `Recommended for you` section on the home page: personalized recommendations for signed-in players and real trending catalog games for guests.

## Scope

This package changes only the typed frontend API client and home route. The existing backend `GET /dashboard` recommendation service and `GET /catalog/trending-games` catalog endpoint remain the sources of truth.

## Data Flow

- A signed-in visitor loads `GET /dashboard` through a new typed `getDashboard()` client function. The page consumes `recommendations.status`, `recommendations.data`, and `recommendations.message`.
- A guest loads `GET /catalog/trending-games?page_size=12` through the existing `getTrendingGames()` client function.
- The home route never substitutes trending cards for a signed-in user's empty or error recommendation result.

## Rendering Rules

- Signed-in, ready recommendations: render recommendation cards with title, reason, tags, optional cover, and a game detail link only when `rawg_id` is present.
- Signed-in, empty recommendations: render an honest empty state explaining how to add signals (Steam, library, or profile) without showing synthetic cards.
- Signed-in, failed recommendations: render an error state using the server message when available and no replacement cards.
- Guest: render real catalog trending games through the existing `GameCard` component, which links only verified catalog IDs to `/games/$gameId`.

## API Types

`web/src/lib/api.ts` adds a `Dashboard` shape with the existing backend `DataBlock` contract and recommendation items containing `title`, `reason`, `tags`, optional `rawg_id`, and optional `cover_url`.

## Testing

Tests are written first. API-client coverage verifies `getDashboard()` uses authenticated `GET /dashboard`. Home tests verify the authenticated ready, empty, and error states; guest trending cards; and that recommendation links are emitted only when a usable game ID is present.

## Non-goals

- Altering recommendation ranking or generating recommendations in the browser.
- Returning demo cards for any signed-in state.
- Calling an untyped or new backend endpoint.
