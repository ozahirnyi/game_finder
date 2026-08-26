# Persistent business E2E

This project uses the deployed frontend and real API. It deliberately has no
`page.route("**/api/**")` fixture layer and no `webServer`.

Required environment variables are `E2E_BASE_URL`, `E2E_API_BASE_URL`, `E2E_ALLOWED_HOSTS`,
`E2E_FIXTURE_MARA_EMAIL`, `E2E_FIXTURE_MARA_PASSWORD`,
`E2E_FIXTURE_JONAS_EMAIL`, and `E2E_FIXTURE_JONAS_PASSWORD`.

The suite covers authentication persistence, profile preferences, PlayStation
import, library ownership, wishlist/favorites and price alerts, friend
requests, conversations, messages, game invites, notifications, and
cross-user privacy boundaries. Setup uses real API requests only to reconcile
test data; assertions and user actions run through the browser UI.
