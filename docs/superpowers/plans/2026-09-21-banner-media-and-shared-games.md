# Banner Media and Shared Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make discovery banners use correct landscape art or a composed portrait fallback, recover from failed media URLs, and show cover-art cards for a friend's shared games.

**Architecture:** The catalog API will explicitly expose portrait cover art separately from optional hero artwork. `GameCover` becomes the single renderer that selects landscape art, a contained portrait composition, a same-shape alternate URL, or the existing named gradient fallback. `GameCard` and the profile shared-games grid feed that component with the appropriate media role.

**Tech Stack:** FastAPI/Pydantic, IGDB normalization, React 19, TypeScript, Tailwind CSS, TanStack Router/Query, Vitest/Testing Library, pytest.

## Global Constraints

- Do not present portrait cover art as a cropped 16:9 hero image.
- Preserve all existing catalog, friendship, visibility and invitation contracts.
- Do not add live provider calls to tests; use fixtures and mocked image events.
- All broken image paths end in a visible, accessible title fallback.

---

## File structure

- `app/integrations/igdb.py` — publishes distinct portrait `cover_image` and optional landscape `hero_image` fields.
- `tests/test_igdb.py` — locks the normalized media contract.
- `web/src/lib/api.ts` — declares the new optional catalog image field.
- `web/src/components/GameCover.tsx` — centrally renders portrait, hero, alternate URL and final fallback states.
- `web/src/components/GameCover.test.tsx` — tests those media states without network access.
- `web/src/components/GameCard.tsx` — supplies separate hero/portrait inputs to the renderer.
- `web/src/components/GameCard.test.tsx` — verifies a portrait-only discovery card chooses the composed treatment.
- `web/src/routes/index.tsx`, `web/src/routes/search.tsx`, `web/src/routes/games.$gameId.tsx`, `web/src/routes/deals.tsx` — preserve media roles when mapping API payloads to cards and detail hero surfaces.
- `web/src/components/ProfileView.tsx` — renders shared games as portrait cards with cover, metadata and the existing invite action.
- `web/src/components/ProfileView.test.tsx` — verifies cover rendering and the existing invitation flow.

### Task 1: Separate catalog portrait and hero media

**Files:**
- Modify: `app/integrations/igdb.py:135-165`
- Modify: `tests/test_igdb.py:90-130`

**Interfaces:**
- Produces: normalized catalog records with `cover_image: str | None`, `background_image: str | None` for backwards compatibility, and `hero_image: str | None` only when IGDB provides artwork.
- Consumed by: catalog/search/detail response handlers and frontend `CatalogGame`.

- [ ] **Step 1: Write the failing normalization tests**

```python
def test_normalize_igdb_game_keeps_portrait_cover_out_of_hero_field():
    result = normalize_igdb_game({
        "id": 1,
        "name": "Portrait Only",
        "cover": {"url": "//images.igdb.com/igdb/image/upload/t_thumb/cover.jpg"},
    })

    assert result["cover_image"] == "https://images.igdb.com/igdb/image/upload/t_cover_big/cover.jpg"
    assert result["hero_image"] is None


def test_normalize_igdb_game_keeps_artwork_as_hero_image():
    result = normalize_igdb_game({
        "id": 1,
        "name": "Wide Game",
        "cover": {"url": "//images.igdb.com/igdb/image/upload/t_thumb/cover.jpg"},
        "artworks": [{"url": "//images.igdb.com/igdb/image/upload/t_thumb/artwork.jpg"}],
    })

    assert result["cover_image"].endswith("t_cover_big/cover.jpg")
    assert result["hero_image"].endswith("t_1080p/artwork.jpg")
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `rtk pytest tests/test_igdb.py -k "portrait_cover_out_of_hero or keeps_artwork_as_hero" -q`

Expected: FAIL because `cover_image` is absent and portrait cover is used as the hero fallback.

- [ ] **Step 3: Make the minimal normalizer change**

```python
cover = _igdb_image_url((game.get("cover") or {}).get("url"), "t_cover_big")
hero_image = _igdb_image_url(artwork, "t_1080p")

return {
    # existing fields...
    "cover_image": cover,
    "background_image": cover,
    "hero_image": hero_image,
}
```

Keep `background_image` temporarily so non-card consumers and cached responses remain compatible; do not substitute `t_720p` cover art for a missing hero.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `rtk pytest tests/test_igdb.py -k "normalize_igdb_game" -q`

Expected: PASS.

- [ ] **Step 5: Commit the backend contract**

```powershell
rtk git add app/integrations/igdb.py tests/test_igdb.py
rtk git commit -m "fix: separate catalog cover and hero media"
```

### Task 2: Make the shared media component aspect-aware and resilient

**Files:**
- Modify: `web/src/lib/api.ts:27-42`
- Modify: `web/src/components/GameCover.tsx:3-85`
- Modify: `web/src/components/GameCover.test.tsx:1-67`

**Interfaces:**
- Consumes: `image?: string` (primary image for the selected role), `fallbackImage?: string` (same-role alternate), `portraitImage?: string` (cover art for a wide composed fallback), and `variant?: "card" | "hero"`.
- Produces: an accessible cover that first renders the primary, retries `fallbackImage` after an error, uses contained `portraitImage` for a hero with no viable landscape media, and finally renders the branded title fallback.

- [ ] **Step 1: Write failing component tests**

```tsx
it("shows portrait art without cropping when a hero has no landscape image", () => {
  render(<GameCover from="#111" to="#222" title="Portrait Only" variant="hero"
    portraitImage="https://images.example.test/cover.jpg" bare />);

  expect(screen.getByRole("img", { name: "Portrait Only" })).toHaveClass("object-contain");
});

it("uses its alternate image before the title fallback", () => {
  render(<GameCover from="#111" to="#222" title="Retry" variant="hero"
    image="https://images.example.test/primary.jpg"
    fallbackImage="https://images.example.test/alternate.jpg" />);

  fireEvent.error(screen.getByRole("img", { name: "Retry" }));
  expect(screen.getByRole("img", { name: "Retry" })).toHaveAttribute(
    "src", "https://images.example.test/alternate.jpg",
  );
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `rtk npm.cmd --prefix web test -- src/components/GameCover.test.tsx`

Expected: FAIL because `portraitImage` is not an accepted prop and portrait artwork has no composed hero state.

- [ ] **Step 3: Add the typed catalog field and media state machine**

```ts
export type CatalogGame = {
  // existing fields
  cover_image?: string | null;
  background_image?: string | null;
  hero_image?: string | null;
};
```

```tsx
type Props = {
  image?: string;
  fallbackImage?: string;
  portraitImage?: string;
  variant?: "card" | "hero";
  // existing presentation props
};

const usePortraitComposition = variant === "hero" && !activeImage && Boolean(portraitImage) && !broken;
```

Render the portrait in a centered, bounded 2:3 frame with `object-contain` on top of the existing gradient. Keep the existing image error transition for `image → fallbackImage → broken`, and let the portrait composition fall through to the named gradient if its image fails.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `rtk npm.cmd --prefix web test -- src/components/GameCover.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the reusable media renderer**

```powershell
rtk git add web/src/lib/api.ts web/src/components/GameCover.tsx web/src/components/GameCover.test.tsx
rtk git commit -m "fix: render catalog media by its native aspect"
```

### Task 3: Feed correct media roles into discovery and detail cards

**Files:**
- Modify: `web/src/components/GameCard.tsx:6-58`
- Modify: `web/src/components/GameCard.test.tsx:1-80`
- Modify: `web/src/routes/index.tsx:274-282,346-356,398-475`
- Modify: `web/src/routes/search.tsx:323-332,370-378`
- Modify: `web/src/routes/games.$gameId.tsx:69-108,144-155,427-440,618-630`
- Modify: `web/src/routes/deals.tsx:45-52`

**Interfaces:**
- Consumes: `GameCardData.heroUrl?: string`, `coverUrl?: string`, and `heroFallbackUrl?: string`.
- Produces: wide discovery/detail panels that display hero art when present and a composed portrait otherwise; Steam cards provide `library_hero.jpg`/`header.jpg` as same-shape fallbacks.

- [ ] **Step 1: Write a failing GameCard test**

```tsx
it("passes portrait-only catalog media to the composed hero treatment", () => {
  render(<GameCard game={{
    gameId: "42", title: "Portrait Only", coverUrl: "https://images.example.test/cover.jpg",
    coverFrom: "#111111", coverTo: "#222222",
  }} />);

  expect(screen.getByRole("img", { name: "Portrait Only" })).toHaveClass("object-contain");
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `rtk npm.cmd --prefix web test -- src/components/GameCard.test.tsx`

Expected: FAIL because `GameCard` passes the portrait image as a crop-to-fill card image.

- [ ] **Step 3: Update card mapping and all wide consumers**

```tsx
export type GameCardData = {
  heroUrl?: string;
  heroFallbackUrl?: string;
  coverUrl?: string;
  // existing fields
};

<GameCover
  variant="hero"
  image={game.heroUrl}
  fallbackImage={game.heroFallbackUrl}
  portraitImage={game.coverUrl}
  // existing props
/>
```

For catalog payloads, map `heroUrl: game.hero_image ?? undefined` and `coverUrl: game.cover_image ?? game.background_image ?? undefined`. For Steam-only cards use `library_hero.jpg` as the primary and `header.jpg` as fallback. Keep portrait-only library and wishlist cards on the default card variant.

- [ ] **Step 4: Run the focused frontend tests to verify they pass**

Run: `rtk npm.cmd --prefix web test -- src/components/GameCard.test.tsx src/routes/-index.recommendations.test.tsx src/routes/-search.test.tsx src/routes/-games.$gameId.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit discovery media wiring**

```powershell
rtk git add web/src/components/GameCard.tsx web/src/components/GameCard.test.tsx web/src/routes/index.tsx web/src/routes/search.tsx web/src/routes/games.$gameId.tsx web/src/routes/deals.tsx
rtk git commit -m "fix: use portrait fallback in discovery cards"
```

### Task 4: Render shared games as cover-art cards

**Files:**
- Modify: `web/src/components/ProfileView.tsx:585-629`
- Modify: `web/src/components/ProfileView.test.tsx:260-340`
- Modify: `tests/test_social_api.py:470-518`

**Interfaces:**
- Consumes: existing `SharedGame { source, external_id, title, cover_url }` from `GET /friends/{user_id}/shared-games`.
- Produces: a 2:3 shared-game card containing a `GameCover`, source label and `Invite <title>` button, without modifying friend/visibility authorization or invitation payloads.

- [ ] **Step 1: Write the failing UI and contract tests**

```tsx
it("renders a shared game's supplied cover artwork", () => {
  renderProfileWithSharedLibrary({
    status: "ready",
    data: [{ source: "steam", external_id: "620", title: "Portal 2", cover_url: "https://images.example.test/portal.jpg" }],
  });

  expect(screen.getByRole("img", { name: "Portal 2" })).toHaveAttribute(
    "src", "https://images.example.test/portal.jpg",
  );
});
```

```python
assert response.json()["data"] == [{
    "source": "steam", "external_id": "620", "title": "Portal 2",
    "cover_url": "https://cover.test/portal.jpg",
}]
```

Seed the friend-side `Game` fixture with `img_icon_url="https://cover.test/portal.jpg"` so the API assertion proves the UI's media field is populated without changing its contract.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `rtk npm.cmd --prefix web test -- src/components/ProfileView.test.tsx`

Expected: FAIL because the shared-games tile has no image.

Run: `rtk pytest tests/test_social_api.py -k "friend_shared_games_match_saved" -q`

Expected: FAIL until the updated fixture expectation includes the saved cover URL.

- [ ] **Step 3: Replace the shared-game tile body with a portrait card**

```tsx
<div className="overflow-hidden rounded-xl border border-border bg-surface-2">
  <GameCover from="#7c3aed" to="#111827" title={game.title}
    image={game.cover_url ?? undefined} compact bare className="aspect-[2/3] w-full" />
  <div className="p-3">
    <p className="truncate text-sm font-bold">{game.title}</p>
    <p className="label-mono mt-1.5 text-muted-foreground">{game.source}</p>
    <button type="button" aria-label={`Invite ${game.title}`} /* existing handler */>Invite</button>
  </div>
</div>
```

Use the existing handler unchanged so it retains `source` and `external_id` in the create-invite mutation. Do not render an image outside `GameCover`.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `rtk npm.cmd --prefix web test -- src/components/ProfileView.test.tsx`

Expected: PASS.

Run: `rtk pytest tests/test_social_api.py -k "friend_shared_games" -q`

Expected: PASS.

- [ ] **Step 5: Commit shared-game cards**

```powershell
rtk git add web/src/components/ProfileView.tsx web/src/components/ProfileView.test.tsx tests/test_social_api.py
rtk git commit -m "feat: show cover art for shared games"
```

### Task 5: Run final verification

**Files:**
- Verify only; no production edits.

**Interfaces:**
- Verifies: normalized media contract, renderer state machine, discovery route mapping, friend shared-game UI and no TypeScript build regressions.

- [ ] **Step 1: Run the focused backend tests**

Run: `rtk pytest tests/test_igdb.py tests/test_social_api.py -q`

Expected: PASS.

- [ ] **Step 2: Run the relevant frontend test suite**

Run: `rtk npm.cmd --prefix web test -- src/components/GameCover.test.tsx src/components/GameCard.test.tsx src/components/ProfileView.test.tsx src/routes/-index.recommendations.test.tsx src/routes/-search.test.tsx src/routes/-games.$gameId.test.ts`

Expected: PASS.

- [ ] **Step 3: Run production frontend validation**

Run: `rtk npm.cmd --prefix web run lint`

Expected: PASS with no lint errors.

Run: `rtk npm.cmd --prefix web run build`

Expected: exit code 0.

- [ ] **Step 4: Inspect the finished changes**

Run: `rtk git diff origin/main...HEAD --check`

Expected: no output and exit code 0.

- [ ] **Step 5: Commit any final verification-only test adjustment**

```powershell
rtk git status --short
```

Expected: no uncommitted changes. If a correction was required during final verification, add only the affected files and commit with `test: cover banner media regression`.
