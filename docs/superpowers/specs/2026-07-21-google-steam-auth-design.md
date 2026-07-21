# Google and Steam sign-in on Railway

## Goal

Make registration and sign-in through Google OIDC and Steam OpenID dependable in the deployed Railway application. A successful provider flow must issue the normal application JWT and take the user to their profile.

## Account rules

### Google

1. Start Google OIDC Authorization Code flow with PKCE, `state`, and `nonce` from both the sign-in and registration pages.
2. Verify the Google ID token, issuer, audience, nonce, and confirmed email.
3. If the Google subject is already linked, authenticate that user.
4. Otherwise, normalize the confirmed email and find an existing password or Google account by email. Use it when present; otherwise create a passwordless user.
5. Create the Google identity link for the selected user, then issue the normal application JWT through a short-lived, single-use exchange code.

### Steam

1. Start Steam OpenID from both the sign-in and registration pages using the public Railway API URL for the realm and return URL.
2. Verify Steam's OpenID assertion server-side and extract the Steam ID.
3. If the Steam ID is already linked, authenticate that user.
4. Otherwise create a passwordless Steam-only user whose stable internal email is `steam-<steam-id>@steam.invalid`, then record Steam profile data where available.
5. Do not automatically merge a first-time Steam sign-in with an existing password or Google account: Steam OpenID does not return a verified email. An authenticated user links Steam from the profile flow.

## Components and data flow

- The frontend requests a provider login URL and redirects to the provider.
- The API creates a short-lived authorization transaction before redirecting. Google transactions retain PKCE verifier and nonce; Steam transactions retain state.
- Provider callbacks validate and consume the transaction before remote verification, resolve or create the application user, and create a short-lived one-time exchange code.
- The frontend callback page exchanges that code for an application JWT, stores it, and routes to `/profile`.
- Provider cancellation, missing values, expired/replayed state, invalid provider assertions, and an expired/replayed exchange code return an error state without authenticating a user.

## Railway deployment configuration

Set the following in the API service; never commit their secret values:

- `FRONTEND_PUBLIC_URL=https://<frontend-domain>`
- `FRONTEND_ORIGIN` and `FRONTEND_ORIGINS` including the deployed frontend origin
- `BACKEND_PUBLIC_URL=https://<api-domain>`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI=https://<api-domain>/auth/google/callback`
- `STEAM_API_KEY` for optional profile, library, and social enrichment

Register the same exact HTTPS Google redirect URI in Google Cloud Console. Steam OpenID uses the public API domain as its realm and its `/auth/steam/callback` endpoint as the return URL. The API must be publicly reachable over HTTPS.

## Implementation boundaries

- Preserve current password registration and login behavior.
- Preserve the existing profile-only Steam-linking flow.
- Avoid unrelated frontend redesign and do not modify generated `web/.output` artifacts.

## Verification

- Backend tests cover Google creation, email-based account reuse and linking, existing Google identity sign-in, Steam creation, Steam repeat sign-in, and one-time transaction consumption.
- Frontend tests cover provider launch and callback success/error states.
- Manual Railway validation covers Google and Steam registration, repeat login, cancellation, and the account-link conflict path.

