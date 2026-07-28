# PlayFinder visual rebrand design

## Goal

Replace the public brand `GameFinder` and `Game Finder` with `PlayFinder` in
the deployed product and its active documentation, without changing technical
identifiers that would affect existing users or production data.

## Included changes

- Navigation and application-shell brand labels.
- Browser titles, SEO description, Open Graph metadata, and route copy.
- Telegram user messages and errors that name the product.
- README heading and current product wording.
- Frontend tests that assert the visible brand.

The canonical spelling is `PlayFinder` everywhere, including prose and page
metadata.

## Preserved technical compatibility

Do not rename database names, Docker container/volume names, environment
variable names, backend module paths, JWT/local-storage key `game_finder_token`,
or historical release/spec documents. These names are implementation details;
changing them could create a new database volume or invalidate active browser
sessions without adding value to the user-facing rebrand.

## Validation

Add focused tests for the rendered brand and public metadata. Run the backend
test suite, frontend tests, frontend production build, and a source scan that
confirms active user-facing files no longer contain the old public name.
