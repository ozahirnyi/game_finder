# Origin/Main Task Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require every implementation task to begin on a unique branch created from freshly fetched `origin/main`.

**Architecture:** Add a Git workflow gate to the repository-level `AGENTS.md`. The instruction runs before exploration and makes Git command failure a safe stop condition, preserving user changes.

**Tech Stack:** Git, Codex agent instructions, RTK.

## Global Constraints

- Run Git commands through `rtk`.
- Do not SSH to Lightsail, deploy, stash, reset, or overwrite user changes.
- Use `origin/main` as the production baseline.

---

### Task 1: Enforce the fresh production baseline

**Files:**
- Modify: `AGENTS.md`
- Test: `AGENTS.md` text inspection

**Interfaces:**
- Consumes: `origin/main` as the verified Lightsail production baseline.
- Produces: mandatory pre-task Git workflow instructions for every agent.

- [ ] **Step 1: Add the Git workflow gate after the source-of-truth paragraph**

Add instructions requiring this exact sequence before implementation work:

```powershell
rtk git fetch origin
rtk git status --short
rtk git switch -c codex/<task-name> origin/main
```

State that a non-empty status or any failed command requires the agent to stop and report the condition without stashing, resetting, or overwriting files.

- [ ] **Step 2: Verify the instruction is precise**

Run:

```powershell
rtk rg -n "fetch origin|switch -c codex/<task-name> origin/main|Do not stash" AGENTS.md --max-count 10
```

Expected: all three required clauses are present.

- [ ] **Step 3: Review the diff**

Run:

```powershell
rtk diff -- AGENTS.md
```

Expected: the only behavior change is the pre-task branch baseline gate.

- [ ] **Step 4: Commit the instruction change**

Run:

```powershell
rtk git add AGENTS.md
rtk git commit -m "docs: require tasks to branch from origin main"
```

Expected: one commit containing only the instruction change.
