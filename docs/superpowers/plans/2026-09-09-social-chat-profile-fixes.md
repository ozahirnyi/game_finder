# Social, chat and profile fixes

Approved scope: remove the Steam friends tab and the lower Friends online deal card; automatically import registered Steam contacts; implement removal, blocking and unblocking; replace the profile message form with a real Messages page polling every three seconds; repair friend library links, hours and error states; audit the existing tests and fix integration status displays.

## Backend task contract
- DELETE /friends/{user_id} removes friendship and persists a canonical pair auto-import suppression. Manual accepted requests may reconnect; Steam never undoes a removal. PUT/DELETE /social/blocks/{user_id} block/unblock idempotently; GET /social/blocks returns [{user: existing public user response, created_at}]. Blocks are directional but all contact and authenticated profile visibility is denied both ways. Unblock does not restore friendship or remove import suppression.
- Block removes friendship, closes pending requests/invites, hides conversations and prevents direct API access. Ordinary removal retains read-only message history. Apply enforcement to legacy and social endpoints, searches, profiles, privacy, invites, messages, notifications. Preserve public unauthenticated visibility policy.
- POST /steam/friends/sync returns {status: 'synced'|'skipped'|'unavailable', added: number, message: string|null}. Throttle at 15 minutes, optional query force=true for explicit retry. Sync after Steam link/login; all contacts, no library downloads. Failure never fails successful authentication. Use persisted suppression and concurrency-safe upserts/locks. Add missing migration(s).
- GET /conversations/{id} returns existing Conversation plus can_message:boolean. List supports existing limit/offset and includes can_message. GET /conversations/{id}/messages retains ascending array response and accepts before_id/after_id optional UUID cursors plus limit (50 default); fetching must not mark read. POST /conversations/{id}/read accepts {message_id: UUID}, only marks incoming through that message. POST messages accepts optional client_message_id: UUID with per-sender idempotency and returns ConversationMessage. Preserve existing callers without new optional arguments. Cursor access is scoped to its conversation.
- Public friend library must expose detail_game_id plus detail_source ('steam' or null), preserve minutes, and provide a partial/error status message when Steam fails without pretending the library is empty. Reuse existing catalog resolver policy for saved non-Steam games.

## Frontend task contract
- /messages and /messages/$conversationId share a full conversation UI with mobile list/detail navigation, 3-second visible-only polling, ordered/deduplicated messages, older history, read receipts only for visible opened chat, retained draft on failures, client message UUID for retry, no forced scroll while reading earlier history.
- All Message actions create/reuse a conversation and navigate. Legacy compose=message and friends?conversation redirects remain compatible. Message notifications navigate to Messages.
- Removal/block actions on friends and profiles with confirmation/error states. Blocked list and Unblock on Friends. Remove Steam tab and eager/preload social fetch. Sync on friends visit and invalidate relationships.
- Fix hours sum/unknown and game links using detail_game_id/detail_source rather than library UUID. Keep upper friends block, remove lower deals friends block and unused gap. Fix profile error skeleton and integration loading/Google/PSN states.

## Validation and delivery
- Tests first for behavior regressions. Backend integration tests with isolated database; frontend unit/UI tests; real business flows only isolated test accounts and environment.
- Verify typecheck, lint, build, pytest, Vitest, Playwright. Preserve existing tests' meaningful assertions; update old UI expectations rather than hiding failures.
- Separate source changes from generated artifacts; push codex/social-chat-profile-fixes and create PR. No production deploy or merge in this task.

## Progress
- [x] Deployed base verified: b372d68; local isolated worktree created.
- [ ] Backend social and chat contracts, migrations and regression tests.
- [ ] Frontend friends, messaging, profiles and home.
- [ ] Full validation, independent review, fixes and PR.

## Audit evidence
- Existing standard Playwright suite mocks all API calls. Business E2E workflow is manual; GitHub returned no recorded runs.
- Search Portal 2, catalog detail, Steam library detail, wishlist list, deals and account render on live site.
- Price history unavailable for Bodycam and Portal 2; provider key exists, cause unconfirmed.
- Google and PlayStation status hardcoded disconnected; Telegram briefly shows unconfigured before response.
- Remote isolated frontend test result was lost when tool session changed; do not claim it passed.
