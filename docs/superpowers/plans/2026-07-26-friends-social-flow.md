# Friends, Invites, and Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock Friends page with real PlayFinder discovery, friendship, private messages, and paginated Steam friends.

**Architecture:** Persist public social identities, requests, canonical friendships, and messages in the FastAPI/SQLAlchemy backend. Consume those protected APIs from TanStack Router routes, with Steam social kept as a separately paginated data source.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Pydantic, pytest; React, TypeScript, TanStack Router, Vitest, Testing Library.

## Global Constraints

- Public profiles expose only public nickname and optional Steam avatar; never email, Steam ID, or library data.
- Nicknames are mandatory and unique case-insensitively.
- Friendship requires recipient acceptance; visiting an invite link never changes friendship state.
- Only confirmed friends can read and send direct messages; trimmed message text is 1--2,000 characters.
- Chat polls every 15 seconds while open; no realtime server is added.
- Steam social pages use limits 1--24, offsets >= 0, and enrich only the requested page.
- Do not hand-edit `web/src/routeTree.gen.ts`; regenerate it through the router workflow.

---

### Task 1: Social persistence and protected API

Create the ORM models, Alembic migration, schemas, and FastAPI routes for public profiles, player discovery, requests, friendships, and messages. Add backend contract tests first and cover authorization, duplicate/self requests, safe discovery responses, trimmed messages, and cursor pagination.

### Task 2: Steam social pagination

Add offset-aware Steam friend fetches and API metadata (`friends_total`, `friends_has_more`), then add API tests covering a later page and parameter validation.

### Task 3: Social API client and routes

Add TypeScript API types/functions, public-profile and conversation routes, including preserved return navigation after login. Add focused UI tests before components.

### Task 4: Real Friends workspace

Replace `web/src/routes/friends.tsx` mock data with profile setup, friend/request controls, player search, copy-link feedback and fallback, conversation navigation, and a separately paginated Steam section. The shared-game invitation pre-fills but does not submit a direct-message draft.

### Task 5: Integration verification

Run focused backend/frontend tests, full backend tests, frontend lint and production build. Review the complete diff and repair any findings.
