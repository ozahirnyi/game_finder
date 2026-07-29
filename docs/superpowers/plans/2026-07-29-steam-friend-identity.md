# Steam Friend Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a linked friend's Steam persona name to both friend UI surfaces with a stable fallback.

**Architecture:** Extend the existing public friend response with the stored optional Steam persona. A small frontend helper selects a trimmed persona first and otherwise returns the existing display name; both friend routes call that helper.

**Tech Stack:** FastAPI, Pydantic, pytest, TypeScript, Vitest.

## Global Constraints

- Preserve non-Steam friend behavior and the existing `display_name` field.
- Never render a blank persona name.
- Do not change Steam linking, friendship persistence, or the Library page.

---

### Task 1: Expose and render the Steam persona name

**Files:**
- Modify: `app/schemas.py:441-447`
- Modify: `app/main.py:174-182`
- Modify: `tests/test_api_contracts.py`
- Modify: `web/src/lib/api.ts:84-86`
- Create: `web/src/lib/friendIdentity.ts`
- Create: `web/src/lib/friendIdentity.test.ts`
- Modify: `web/src/routes/friends.index.tsx:30-46`
- Modify: `web/src/routes/friends.$friendId.tsx:7-19`

**Interfaces:**
- Produces: `PublicUserRead.steam_persona_name: str | None` and `Friend.user.steam_persona_name?: string | null`.
- Produces: `friendDisplayName({ display_name, steam_persona_name }): string`, selecting a non-empty trimmed Steam persona or the existing display name.

- [ ] **Step 1: Write failing backend and frontend tests**

Append to `tests/test_api_contracts.py`:

```python
def test_public_friend_response_includes_steam_persona_name():
    user = SimpleNamespace(
        id=uuid.uuid4(), email="steam-user@steam.invalid", display_name="Playfinder name",
        bio=None, steam_avatar=None, steam_persona_name="Steam Persona",
    )
    response = main.public_user_response(user)
    assert response.steam_persona_name == "Steam Persona"
```

Create `web/src/lib/friendIdentity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { friendDisplayName } from "./friendIdentity";

describe("friendDisplayName", () => {
  it("prefers a non-empty Steam persona name", () => {
    expect(friendDisplayName({ display_name: "Playfinder", steam_persona_name: "  Steam Persona  " })).toBe("Steam Persona");
  });
  it("falls back to the Playfinder name", () => {
    expect(friendDisplayName({ display_name: "Playfinder", steam_persona_name: "   " })).toBe("Playfinder");
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `rtk pytest tests/test_api_contracts.py -q -k public_friend_response_includes_steam_persona_name`

Expected: FAIL because `PublicUserRead` lacks `steam_persona_name`.

Run: `rtk npm test -- src/lib/friendIdentity.test.ts`

Expected: FAIL because `friendIdentity.ts` does not exist.

- [ ] **Step 3: Implement the contract and shared fallback**

Add `steam_persona_name: str | None = None` to `PublicUserRead`. In `public_user_response`, pass `steam_persona_name=getattr(user, "steam_persona_name", None)`.

Create `web/src/lib/friendIdentity.ts`:

```ts
export function friendDisplayName(friend: { display_name: string; steam_persona_name?: string | null }) {
  return friend.steam_persona_name?.trim() || friend.display_name;
}
```

Add `steam_persona_name?: string | null` to `Friend.user` in `api.ts`. Import and call `friendDisplayName(user)` for `name` and `handle` in both friend routes.

- [ ] **Step 4: Verify GREEN and build**

Run: `rtk pytest tests/test_api_contracts.py -q -k public_friend_response_includes_steam_persona_name`

Expected: PASS.

Run: `rtk npm test -- src/lib/friendIdentity.test.ts && rtk npm run build`

Expected: PASS and build exit code 0.

- [ ] **Step 5: Commit**

```powershell
rtk git add app/schemas.py app/main.py tests/test_api_contracts.py web/src/lib/api.ts web/src/lib/friendIdentity.ts web/src/lib/friendIdentity.test.ts web/src/routes/friends.index.tsx web/src/routes/friends.$friendId.tsx
rtk git commit -m "fix: show Steam persona names for friends"
```
