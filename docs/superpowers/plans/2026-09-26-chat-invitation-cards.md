# Chat Invitation Cards Implementation Plan

> **For agentic workers:** Execute inline in task order. Steps use checkbox syntax.

**Goal:** Turn game invitations into actionable cards in Chats, show aggregate unread chat count, and route profile invite notifications to the correct conversation.

**Architecture:** Keep `GameInvite` as the status source of truth and associate each invite with a typed `Message` row. The existing conversation API returns linked invitation data, and its unread calculation counts the card like a message. The frontend renders pending/answered cards, updates caches after actions, displays summed unread counts in app navigation, and preserves `/messages` URLs while labeling the destination Chats.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Pydantic, React, TanStack Query/Router, Vitest, pytest.

## Global Constraints

- Use `origin/main` as the implementation baseline and preserve participant/owner scoping.
- Keep `/messages` route paths so existing links remain valid.
- Game invite creation and response side effects must be atomic and stale/repeated responses must not duplicate messages.
- The invitation notification is not a second unread chat message.
- No live external services or provider calls are needed.

---

### Task 1: Persist typed invitation messages and API response events

**Files:**
- Modify: `app/database.py` (`Message` model)
- Modify: `app/schemas.py` (`MessageRead` and invite response contracts)
- Modify: `app/main.py` (conversation/message serializers, invite create/respond routes)
- Create: `alembic/versions/<new_revision>_add_typed_game_invite_messages.py`
- Test: `tests/test_social_chat_fixes.py`
- Test: `tests/test_social_api.py`

**Interfaces:** `Message.kind` is `text | game_invite | system`; existing rows default to `text`. `Message.game_invite_id` is an optional unique FK. `MessageRead` includes the kind and participant-safe invite projection. Invite create responses expose `conversation_id` for stable notification routing.

- [x] Add tests proving invite creation adds one linked message/notification and response adds one system event; test participant scoping and repeat response.
- [x] Run focused backend tests to establish failing expectations.
- [x] Add model fields and Alembic migration with a `text` server default for existing rows.
- [x] Extend serializers to include linked invite data only for conversation participants.
- [x] In invite creation's transaction, ensure the pair conversation and persist invite, linked card message, and notification with `conversation_id`.
- [x] In response's transaction, enforce pending status, update invite, persist one system response message, and notify sender with `conversation_id`.
- [x] Run focused backend tests and inspect migration upgrade/downgrade.

### Task 2: Render invitation cards and response feedback in chat

**Files:** `web/src/lib/api.ts`, `web/src/components/MessagesScreen.tsx`, `web/src/components/MessagesScreen.test.tsx`, `web/src/routes/messages.index.tsx`.

**Interfaces:** Message kind is `text | game_invite | system`. Invitation message carries the server-projected invite. Existing `respondToGameInvite(id, status)` handles Accept and Decline.

- [x] Add component tests for pending recipient controls, sender view, accepted/declined states, system result text, and response errors.
- [x] Run the focused Vitest file to confirm new expectations fail.
- [x] Keep existing text rendering; render invitation messages as distinct cards and system messages as conversation events.
- [x] Disable actions during mutation. On success invalidate `conversation-messages`, `conversation`, `conversations`, and `notifications`.
- [x] Keep stale/unauthorized errors neutral and refetch authoritative state.
- [x] Run the focused Vitest file.

### Task 3: Chats label, aggregate badge, and notification deep links

**Files:** `web/src/components/AppShell.tsx`, `web/src/lib/notificationNavigation.ts`, `web/src/components/NotificationsPanel.tsx`, `web/src/components/ProfileView.tsx`, corresponding Vitest files `web/src/lib/notificationNavigation.test.ts`, `web/src/components/NotificationsPanel.test.tsx`, `web/src/components/-AppShell.prefetch.test.tsx`, `web/src/routes/-index.startup.test.tsx`.

**Interfaces:** `GET /conversations/unread-count` returns the signed-in user's aggregate unread count, excluding conversations no longer visible to them. The Chats badge hides at zero, caps visually at `99+`, and exposes exact accessible count. Both invite notification types route via `conversation_id` to `/messages/$conversationId`.

- [x] Add tests for label and badge sum/zero/cap, invite destinations, and navigate-before-read sequencing.
- [x] Run focused Vitest files to confirm new expectations fail.
- [x] Rename visible navigation and chat page labels to Chats; retain `/messages` route paths.
- [x] Derive unread total from the owner-scoped unread count endpoint and refresh/invalidate on reads, sends, invite create, and response.
- [x] Route invite notifications to the conversation and mark them read after starting navigation.
- [x] Invalidate conversations after an invite is sent from profile UI.
- [x] Run focused Vitest files.

### Task 4: Contract verification and integration review

- [x] Run focused backend and frontend suites for changed contracts.
- [x] Run frontend lint and production build.
- [x] Review participant authorization, pending-only response, no duplicate events, and correct unread counting.
- [x] Record command results and environment limitations before reporting completion.
