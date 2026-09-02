# AI Search Error Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display safe, actionable AI-search failures in the search page.

**Architecture:** Map the existing `ApiError` status and structured detail to fixed user-facing messages in the route. The backend contract is unchanged.

**Tech Stack:** React, TypeScript, TanStack Query, Vitest.

## Global Constraints

- Do not expose API keys, provider payloads, or stack traces.
- Keep unknown failures as a retryable neutral message.
- Do not change the backend error contract.

---

### Task 1: Map AI errors and cover them with route tests

**Files:**
- Modify: `web/src/routes/search.tsx`
- Modify: `web/src/routes/-search.test.tsx`

**Interfaces:**
- Consumes: `ApiError` with `status` and `detail` from `web/src/lib/api.ts`.
- Produces: a user-safe error title and description for AI searches.

- [ ] **Step 1: Add failing UI tests**

Mock a 429 response with `ai_daily_quota_exhausted` and a 503 response with
`ai_recommendations_unavailable`; assert the search page renders the specific
quota and provider messages.

- [ ] **Step 2: Run the focused test**

Run: `npm --prefix web test -- --run src/routes/-search.test.tsx`

Expected: FAIL because the page always renders `AI search is unavailable`.

- [ ] **Step 3: Implement the minimal message mapper**

Add a route-local function that recognizes 401, 429 quota/cooldown codes, and
503 provider errors; use it in the mutation-error `EmptyState`.

- [ ] **Step 4: Verify the frontend**

Run: `npm --prefix web test -- --run && npm --prefix web run lint && npm --prefix web run build`

Expected: tests and build pass; lint has no errors.

- [ ] **Step 5: Commit, publish, and deploy**

Run: `git add web/src/routes/search.tsx web/src/routes/-search.test.tsx && git commit -m "fix: explain AI search failures" && git push -u origin codex/ai-search-error-feedback`

Expected: a focused pull request can be merged into `main` to trigger deployment.
