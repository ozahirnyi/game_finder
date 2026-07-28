# Profile sign-out design

## Goal

Give an authenticated PlayFinder user an unambiguous way to leave their account.

## Sidebar

The authenticated account link at the bottom of the desktop sidebar keeps its existing
destination, `/profile`, but its visible label changes from `Signed in` to `Profile`.
There is no dropdown or separate profile control in the sidebar.

## Profile sign-out

The profile header receives a secondary `Sign out` button beside `Edit profile`.
Activating it clears the stored auth token, clears cached user data, and navigates to
`/login`. Auth subscribers then update the shared shell to its signed-out state.

## Error handling

Sign-out is local-only and does not need a server request. It completes immediately;
there is no recoverable request error state.

## Verification

Frontend tests will assert that the sidebar exposes a `Profile` link for authenticated
users, and that profile sign-out clears auth state and redirects to the login route.
