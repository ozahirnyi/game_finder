# Social discovery and profile fixes

1. Replace the coupled Friends search and dialog state with one inline search surface; its results remain in place and actions do not open a duplicate input.
2. Render the public-user directory as ten accessible, full-width player rows with avatars and a card-level profile link. Keep the friend-request button outside that link.
3. Make recent-player lookup work for both catalog IDs and a Steam app ID, and always render the activity section with loading, error, and empty feedback.
4. Add a paginated, privacy-aware friend-library response (ten games per page), with server-side filtering by an optional search string. Use it on the public profile instead of fetching the unbounded friend library.
5. Add backend and route tests for the Steam activity fallback, library paging/searching, one-row player cards, and visible activity states; then run the focused suites, frontend build, and lint.
