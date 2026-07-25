# Auth Home Link Position Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move `← Back to PlayFinder` from each auth card to the viewport's top-left corner.

**Architecture:** Make each full-screen auth section `relative`, then render the existing `Link to="/"` before its centred card with `absolute left-6 top-6` styling.

**Tech Stack:** React, TanStack Router, Vitest.

---

### Task 1: Move and verify the home links

**Files:**
- Modify: `web/src/routes/login.tsx`
- Modify: `web/src/routes/register.tsx`
- Modify: `web/src/test/auth-recovery.routes.test.tsx`

- [ ] Write a failing test that asserts the home link is not inside the auth card.
- [ ] Render the existing `Link to="/"` immediately inside each `relative min-h-screen` section and style it `absolute left-6 top-6`.
- [ ] Run `rtk npm --prefix web test -- auth-recovery.routes.test.tsx`, then the full frontend suite and production build.
- [ ] Commit the route and test changes with `feat: position auth home link outside card`.
