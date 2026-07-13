# AI Search Eight Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return eight unique game recommendations from AI search and its local fallback.

**Architecture:** Keep the existing API contract and frontend rendering unchanged. Update the prompt instruction and have the fallback fill keyword matches with unique catalog games until it has eight items.

**Tech Stack:** Python, FastAPI, Pydantic, pytest.

## Global Constraints

- The `/recommendations` response schema remains `RecommendationResponse`.
- Both AI and fallback recommendation paths target exactly 8 items.
- Preserve the existing fallback error policy and catalog order.

---

### Task 1: Expand the fallback response

**Files:**
- Modify: `tests/test_config.py`
- Modify: `app/openai_client.py:42-195`

**Interfaces:**
- Consumes: `fallback_recommendations(prompt: str) -> dict`
- Produces: a dictionary whose `recommendations` list contains 8 unique existing catalog items.

- [ ] **Step 1: Write the failing test**

```python
def test_fallback_recommendations_returns_eight_unique_games():
    data = fallback_recommendations("dark rpg")
    titles = [item["title"] for item in data["recommendations"]]
    assert len(titles) == 8
    assert len(set(titles)) == 8
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_config.py::test_fallback_recommendations_returns_eight_unique_games -v`
Expected: FAIL because the fallback returns 3 games.

- [ ] **Step 3: Write minimal implementation**

```python
for item in catalog:
    if item["title"] not in seen:
        selected.append(item)
        seen.add(item["title"])
    if len(selected) == 8:
        break
```

Change the prompt constraint from `Exactly 3 recommendations` to `Exactly 8 recommendations`, and replace the fallback loop limit with 8 after appending catalog entries.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_config.py::test_fallback_recommendations_returns_eight_unique_games -v`
Expected: PASS.

- [ ] **Step 5: Run regression tests**

Run: `pytest tests/test_config.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

Do not commit: the working tree contains unrelated user changes. Leave the focused files unstaged for the user to review.
