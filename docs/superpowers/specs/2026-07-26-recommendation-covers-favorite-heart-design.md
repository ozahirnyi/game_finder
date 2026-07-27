# Recommendation covers and favorite heart

## Scope

Fix the dashboard recommendation cards so they render the RAWG cover URL already returned by the API. Replace the catalog game detail page's text button for favorites with a compact heart control.

## Covers

`GameCover` treats its `from` prop as an image URL when it is an HTTP(S) address. Dashboard recommendations must pass `item.cover_url` through `from`, and use the existing fallback colour when no cover is available. The destination colour remains the current dark surface colour. This preserves readable, image-free fallback cards.

## Favorite heart

`CatalogGameActions` keeps the Library and Wishlist controls unchanged. Its Favorites control becomes an icon-only, labelled button:

- An outlined heart means the game is not in Favorites and adds it on click.
- A filled heart means it is in Favorites and removes it on click.
- The control is disabled while the respective request is running and exposes an accessible label describing the action.
- Successful mutations invalidate the same collection queries as today so the detail page, dashboard, profile and favorites list stay synchronized.
- Errors continue to appear in the component's existing alert area.

## Tests

Add focused frontend tests that assert a recommendation cover URL is rendered and that the heart control calls the add or removal API based on its current favorite state.
