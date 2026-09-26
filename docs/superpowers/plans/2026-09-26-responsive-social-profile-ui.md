# Responsive social and profile UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the narrow-screen game invite picker, collapse profile notifications after five entries, add profile links and avatars to chats, and make the game page return-to-search action prominent.

**Architecture:** Keep changes in existing React components and preserve API contracts. Reuse established avatar and public profile link components; cover component behavior with the existing Vitest setup.

**Tech Stack:** React, TypeScript, Tailwind CSS, TanStack Router, Vitest, Testing Library.

## Global Constraints

- Keep changes small and aligned with the existing FastAPI + Vite/TanStack structure.
- All new frontend functionality must be covered by focused Vitest tests under `web/src/**`.
- Mock or stub external services; tests must not require live network calls or API keys.
- No backend or API contract changes are planned.

---

### Task 1: Make the game invitation card responsive

**Files:**
- Modify `web/src/routes/games.$gameId.tsx` where the invite composer is rendered.
- Modify `web/src/routes/-games.actions.test.tsx`.

**Interfaces:**
- Preserve existing invitation selection and send/cancel behavior.

- [x] **Step 1: Add a failing narrow-layout semantics test** asserting the friend select spans no wider than the invite panel and action controls can wrap (use stable classes or accessible structure consistent with the component).
- [x] **Step 2: Run the focused Vitest file** with `cd web; npm.cmd test -- src/routes/-games.actions.test.tsx` and confirm the new assertion fails for the current markup.
- [x] **Step 3: Apply responsive width constraints** (`min-w-0`, `w-full`, `max-w-full`) to the actual overflowing picker and allow action controls to wrap on narrow widths; keep desktop layout unchanged.
- [x] **Step 4: Re-run the focused Vitest file** and confirm it passes.
- [x] **Step 5: Commit** as `fix: keep game invite controls within card`.

### Task 2: Collapse profile notifications after five

**Files:**
- Modify `web/src/components/NotificationsPanel.tsx`.
- Modify `web/src/components/NotificationsPanel.test.tsx`.

**Interfaces:**
- Keep `NotificationsPanel({ className? })` and current notification navigation/read mutations unchanged.

- [x] **Step 1: Add a test** with more than five notifications asserting only the first five render initially and a “Show all” button reports collapsed state.
- [x] **Step 2: Add a test** clicking the control reveals all notifications and toggles its accessible expanded state and label.
- [x] **Step 3: Run** `cd web; npm.cmd test -- src/components/NotificationsPanel.test.tsx` and confirm the new tests fail before implementation.
- [x] **Step 4: Implement** a local expanded state; slice to five while collapsed and render an accessible button only when there are more than five.
- [x] **Step 5: Re-run** the same focused test command and confirm existing read/navigation tests still pass.
- [x] **Step 6: Commit** as `feat: collapse profile notifications`.

### Task 3: Add participant profile links and avatars to chats

**Files:**
- Modify `web/src/components/MessagesScreen.tsx` in conversation list and active conversation header.
- Modify `web/src/components/MessagesScreen.test.tsx`.
- Inspect `web/src/components/UserProfileLink.tsx` and `web/src/components/GameCover.tsx` to reuse established public profile and avatar behavior.

**Interfaces:**
- Use the participant's existing `public_id` and `avatar` fields if supplied by the conversation API type; do not change the API contract.
- Preserve conversation selection and messaging behavior.

- [x] **Step 1: Add tests** asserting the participant's display name links to their public profile and their avatar is rendered in the conversation list and active chat header.
- [x] **Step 2: Run** `cd web; npm.cmd test -- src/components/MessagesScreen.test.tsx` and confirm the new assertions fail before implementation.
- [x] **Step 3: Implement** avatar rendering with the existing `Avatar` component and profile navigation with `UserProfileLink`; ensure clicks on the profile link do not select a conversation.
- [x] **Step 4: Re-run** the same focused test command and confirm existing messaging behaviors still pass.
- [x] **Step 5: Commit** as `feat: link chat participants to profiles`.

### Task 4: Make “Back to search” more visible

**Files:**
- Modify the existing “Back to search” link in `web/src/routes/games.$gameId.tsx`.
- Update `web/src/routes/-games.detail.test.tsx`.

**Interfaces:**
- Keep the existing link destination and search parameters intact.

- [x] **Step 1: Add/update a test** asserting the back link remains a link with its current destination and receives the intended prominent visual/target classes.
- [x] **Step 2: Run** `cd web; npm.cmd test -- src/routes/-games.detail.test.tsx` and confirm the new expectation fails before implementation.
- [x] **Step 3: Increase** text size, spacing, contrast or button treatment, and hit area using the existing design tokens while retaining the same route/search state.
- [x] **Step 4: Re-run** the focused test and confirm it passes.
- [x] **Step 5: Commit** as `style: emphasize game search return link`.

### Task 5: Verify the combined frontend change

**Files:**
- No additional files unless verification reveals an implementation defect.

- [x] **Step 1: Run focused tests** for all changed component test files with `cd web; npm.cmd test -- <test-files>`.
- [x] **Step 2: Run frontend type/build verification** using the scripts in `web/package.json` (`npm.cmd run build` and the configured type-check script if separate).
- [x] **Step 3: Review** `rtk git diff --check` and `rtk git status --short`; fix whitespace or type errors and preserve the intended task branch changes.
