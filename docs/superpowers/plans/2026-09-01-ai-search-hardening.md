# AI Search Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver authenticated, quota-protected AI game recommendations with real catalog covers, safe internal navigation, preserved AI reasons/tags, and a catalog-consistent UI.

**Architecture:** FastAPI persists one quota row per user and UTC date and serializes reservations by locking the existing user row before incrementing the quota. The recommendation endpoint reserves quota before calling OpenAI, then enriches each title through bounded, exact-match RAWG catalog searches. The active Vite/TanStack frontend reads server quota state, gates guests, renders catalog-native cards, and uses a real URL-backed catalog search as the unmatched fallback.

**Tech Stack:** Python 3, FastAPI, SQLAlchemy, Alembic, PostgreSQL/SQLite tests, pytest, React 19, TypeScript, Vite, TanStack Router, Vitest, Testing Library, Tailwind CSS.

## Global Constraints

- AI recommendations require authentication; guests cannot call either recommendation endpoint from the UI.
- Allow exactly three reserved AI attempts per user per UTC calendar day.
- Enforce at least 60 seconds between reserved attempts.
- Reserve before AI generation; a provider failure consumes the reserved attempt, while an invalid prompt rejected before reservation does not.
- Persist quota in the database and make concurrent reservations safe across workers.
- Reset the daily count at `00:00 UTC` and expose authoritative `remaining`, `cooldown_until`, and `reset_at` timestamps.
- Catalog identity requires an exact normalized title and a non-null internal ID; never create a game-detail link for an approximate or missing match.
- Preserve AI `reason` and `tags` on every result, including unmatched results.
- Keep already-rendered recommendations visible after later request failures.
- Reuse the active Vite/TanStack catalog visual system and do not add prototype data.
- Preserve unrelated user changes in `web/src/features/discovery/discovery.test.tsx` and untracked plan files; never stage them.
- Prefix every shell command with `rtk` and use the repository RTK rules.

## File Structure

- `app/database.py` — persistent `AIRecommendationQuota` ORM model.
- `alembic/versions/8d31c9f412ab_add_ai_recommendation_quotas.py` — quota-table migration from current head `c3d4e5f6a7b8`.
- `app/recommendation_quota.py` — UTC quota snapshots, locked reservation, and denial type.
- `tests/test_recommendation_quota.py` — quota unit and concurrency-oriented transaction tests.
- `app/recommendations.py` — title normalization and bounded per-item catalog enrichment.
- `tests/test_recommendation_enrichment.py` — exact-match, partial-failure, and concurrency-bound tests.
- `app/schemas.py` — quota and enriched recommendation response DTOs.
- `app/integrations/rawg.py` — retain platform names in search results.
- `app/main.py` — authenticated quota status and recommendation endpoints.
- `tests/test_api_contracts.py` — auth, structured `429`, quota consumption, and enriched response contracts.
- `web/src/lib/api.ts` — typed quota/enriched recommendation calls and structured `ApiError.detail`.
- `web/src/lib/api.test.ts` — authenticated request and structured quota error tests.
- `web/src/components/GameCover.tsx` — optional real image with existing gradient fallback.
- `web/src/components/GameCover.test.tsx` — real-image and fallback behavior.
- `web/src/features/auth/ActiveAuthScreen.tsx` — minimal Vite/TanStack email sign-in needed by the guest gate.
- `web/src/features/auth/ActiveAuthScreen.test.tsx` — sign-in pending, success, and error behavior.
- `web/src/routes/login.tsx` — active sign-in destination.
- `web/src/features/discovery/AiRecommendationSearch.tsx` — quota loading, form, countdown, retained results, and cards.
- `web/src/features/discovery/AiRecommendationSearch.test.tsx` — guest, quota, cooldown, error, link, cover, reason, and tag tests.
- `web/src/routes/search.tsx` — real URL-backed catalog results plus the AI recommendation section.
- `web/src/routes/search.test.tsx` — ordinary search fallback and AI-section integration.

---

### Task 1: Persist and atomically reserve daily AI quota

**Files:**
- Modify: `app/database.py`
- Create: `alembic/versions/8d31c9f412ab_add_ai_recommendation_quotas.py`
- Create: `app/recommendation_quota.py`
- Create: `tests/test_recommendation_quota.py`

**Interfaces:**
- Consumes: SQLAlchemy `Session`, an existing `User.id`, and an aware UTC `datetime`.
- Produces: `QuotaSnapshot`, `QuotaDenied`, `get_quota_status(db, user_id, now=None)`, and `reserve_quota(db, user_id, now=None)`.

- [ ] **Step 1: Write failing quota behavior tests**

Create a temporary SQLite engine with `StaticPool`, create `User` and `AIRecommendationQuota` tables, and express the desired clock explicitly:

```python
@pytest.fixture
def session():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        yield db
    Base.metadata.drop_all(engine)

@pytest.fixture
def user(session):
    value = User(email=f"quota-{uuid.uuid4()}@example.test", password_hash="hash")
    session.add(value)
    session.commit()
    return value

def test_three_attempts_are_available_and_fourth_is_denied(session, user):
    start = datetime(2026, 9, 1, 8, 0, tzinfo=timezone.utc)
    first = reserve_quota(session, user.id, start)
    second = reserve_quota(session, user.id, start + timedelta(seconds=60))
    third = reserve_quota(session, user.id, start + timedelta(seconds=120))

    assert [first.remaining, second.remaining, third.remaining] == [2, 1, 0]
    with pytest.raises(QuotaDenied) as exc:
        reserve_quota(session, user.id, start + timedelta(seconds=180))
    assert exc.value.code == "ai_daily_quota_exhausted"
    assert exc.value.snapshot.reset_at == datetime(2026, 9, 2, tzinfo=timezone.utc)


def test_cooldown_denies_without_consuming_an_attempt(session, user):
    start = datetime(2026, 9, 1, 8, 0, tzinfo=timezone.utc)
    reserve_quota(session, user.id, start)

    with pytest.raises(QuotaDenied) as exc:
        reserve_quota(session, user.id, start + timedelta(seconds=59))

    assert exc.value.code == "ai_recommendation_cooldown"
    assert get_quota_status(session, user.id, start + timedelta(seconds=59)).remaining == 2


def test_utc_day_creates_a_fresh_quota(session, user):
    reserve_quota(session, user.id, datetime(2026, 9, 1, 23, 59, tzinfo=timezone.utc))
    snapshot = reserve_quota(session, user.id, datetime(2026, 9, 2, 0, 0, tzinfo=timezone.utc))
    assert snapshot.remaining == 2
    assert snapshot.reset_at == datetime(2026, 9, 3, tzinfo=timezone.utc)
```

- [ ] **Step 2: Run the quota tests and verify RED**

Run: `rtk pytest -q tests/test_recommendation_quota.py`

Expected: FAIL because `AIRecommendationQuota` and `app.recommendation_quota` do not exist.

- [ ] **Step 3: Add the ORM model and migration**

Import `date` from `datetime` and `Date` from SQLAlchemy, then add a composite primary key so the database enforces one record per user/day:

```python
class AIRecommendationQuota(Base):
    __tablename__ = "ai_recommendation_quotas"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    quota_date: Mapped[date] = mapped_column(Date, primary_key=True)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    last_attempt_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
```

Create migration revision `8d31c9f412ab`, `down_revision = "c3d4e5f6a7b8"`:

```python
revision = "8d31c9f412ab"
down_revision = "c3d4e5f6a7b8"

def upgrade() -> None:
    op.create_table(
        "ai_recommendation_quotas",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("quota_date", sa.Date(), nullable=False),
        sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "quota_date"),
    )
    op.create_index("ix_ai_recommendation_quotas_user_id", "ai_recommendation_quotas", ["user_id"])

def downgrade() -> None:
    op.drop_index("ix_ai_recommendation_quotas_user_id", table_name="ai_recommendation_quotas")
    op.drop_table("ai_recommendation_quotas")
```

- [ ] **Step 4: Implement the locked reservation service**

Use the existing user row as the serialization point, which also handles the first request of a day safely:

```python
DAILY_LIMIT = 3
COOLDOWN = timedelta(seconds=60)

@dataclass(frozen=True)
class QuotaSnapshot:
    limit: int
    remaining: int
    cooldown_until: datetime | None
    reset_at: datetime

class QuotaDenied(Exception):
    def __init__(self, code: str, message: str, snapshot: QuotaSnapshot):
        self.code = code
        self.message = message
        self.snapshot = snapshot
        super().__init__(message)

def reserve_quota(db: Session, user_id: uuid.UUID, now: datetime | None = None) -> QuotaSnapshot:
    current = _utc(now)
    db.query(User.id).filter(User.id == user_id).with_for_update().one()
    row = db.get(AIRecommendationQuota, (user_id, current.date()))
    if row is None:
        row = AIRecommendationQuota(user_id=user_id, quota_date=current.date())
        db.add(row)
        db.flush()
    snapshot = _snapshot(row, current)
    if row.attempt_count >= DAILY_LIMIT:
        db.rollback()
        raise QuotaDenied("ai_daily_quota_exhausted", "Daily AI search limit reached.", snapshot)
    if snapshot.cooldown_until and current < snapshot.cooldown_until:
        db.rollback()
        raise QuotaDenied("ai_recommendation_cooldown", "Please wait before searching again.", snapshot)
    row.attempt_count += 1
    row.last_attempt_at = current
    db.commit()
    return _snapshot(row, current)
```

`_utc()` must reject naive datetimes in tests, `_snapshot()` must clamp remaining at zero, omit expired cooldowns, and calculate the next UTC midnight with `datetime.combine(day + timedelta(days=1), time.min, tzinfo=timezone.utc)`.

- [ ] **Step 5: Verify migration and quota GREEN**

Run: `rtk pytest -q tests/test_recommendation_quota.py`

Expected: PASS.

Run: `rtk proxy .\.venv\Scripts\alembic.exe upgrade head`

Expected: migration `8d31c9f412ab` applies successfully.

- [ ] **Step 6: Commit the quota foundation**

Run: `rtk git add app/database.py app/recommendation_quota.py alembic/versions/8d31c9f412ab_add_ai_recommendation_quotas.py tests/test_recommendation_quota.py`

Run: `rtk git commit -m "feat: persist AI recommendation quotas"`

### Task 2: Enrich AI results with exact catalog identities

**Files:**
- Create: `app/recommendations.py`
- Create: `tests/test_recommendation_enrichment.py`
- Modify: `app/integrations/rawg.py`
- Create: `tests/test_rawg.py`

**Interfaces:**
- Consumes: AI dictionaries containing `title`, `reason`, and `tags`, plus async `search_title(title) -> {"results": [...]}`.
- Produces: `normalize_catalog_title(value)` and `enrich_recommendations(items, search_title, concurrency=3)`.

- [ ] **Step 1: Write failing exact-match and partial-failure tests**

```python
@pytest.mark.asyncio
async def test_enrichment_uses_only_exact_normalized_match():
    async def search(_title):
        return {"results": [
            {"id": 7, "name": "Hades II Deluxe", "background_image": "wrong.jpg"},
            {"id": 8, "name": "HÁDES II", "background_image": "right.jpg", "platforms": ["PC"]},
        ]}
    result = await enrich_recommendations(
        [{"title": "Hades II", "reason": "Fast runs", "tags": ["Action"]}], search
    )
    assert result[0]["game"]["id"] == 8
    assert result[0]["game"]["background_image"] == "right.jpg"
    assert result[0]["reason"] == "Fast runs"
    assert result[0]["tags"] == ["Action"]


@pytest.mark.asyncio
async def test_one_catalog_failure_does_not_discard_other_recommendations():
    async def search(title):
        if title == "Broken":
            raise RAWGError("timeout", status_code=504)
        return {"results": [{"id": 9, "name": title, "background_image": "ok.jpg"}]}
    result = await enrich_recommendations(
        [
            {"title": "Broken", "reason": "One", "tags": []},
            {"title": "Working", "reason": "Two", "tags": ["Co-op"]},
        ], search
    )
    assert result[0]["game"] is None
    assert result[1]["game"]["id"] == 9
```

Add the bounded-concurrency test explicitly:

```python
@pytest.mark.asyncio
async def test_enrichment_limits_parallel_catalog_searches():
    active = 0
    peak = 0
    release = asyncio.Event()

    async def search(title):
        nonlocal active, peak
        active += 1
        peak = max(peak, active)
        await release.wait()
        active -= 1
        return {"results": [{"id": int(title), "name": title}]}

    task = asyncio.create_task(enrich_recommendations(
        [{"title": str(index), "reason": "", "tags": []} for index in range(1, 7)],
        search,
        concurrency=3,
    ))
    while peak < 3:
        await asyncio.sleep(0)
    assert peak == 3
    release.set()
    await task
    assert peak == 3
```

- [ ] **Step 2: Run enrichment tests and verify RED**

Run: `rtk pytest -q tests/test_recommendation_enrichment.py`

Expected: FAIL because `app.recommendations` does not exist.

- [ ] **Step 3: Implement bounded enrichment**

```python
def normalize_catalog_title(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return " ".join(re.sub(r"[^a-z0-9]+", " ", ascii_value.lower()).split())

async def enrich_recommendations(items, search_title, concurrency: int = 3):
    semaphore = asyncio.Semaphore(concurrency)

    async def enrich(item):
        try:
            async with semaphore:
                payload = await search_title(item["title"])
            wanted = normalize_catalog_title(item["title"])
            match = next(
                (candidate for candidate in payload.get("results", [])
                 if candidate.get("id") is not None
                 and normalize_catalog_title(candidate.get("name") or "") == wanted),
                None,
            )
        except Exception:
            match = None
        return {**item, "game": match}

    return await asyncio.gather(*(enrich(item) for item in items))
```

Do not swallow `asyncio.CancelledError`; explicitly re-raise it before the broad per-item failure fallback.

- [ ] **Step 4: Preserve platform names in RAWG search normalization**

Extend each result returned by `fetch_rawg_games`:

```python
"platforms": [
    entry["platform"]["name"]
    for entry in game.get("platforms", [])
    if entry.get("platform", {}).get("name")
],
```

Create `tests/test_rawg.py` with a mocked `httpx.AsyncClient` response and assert:

```python
@pytest.mark.asyncio
async def test_rawg_search_preserves_platform_names(monkeypatch):
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {"results": [{
        "id": 8, "name": "Hades II", "released": "2025-09-25",
        "background_image": "cover.jpg",
        "platforms": [{"platform": {"name": "PC"}}, {"platform": {"name": "PlayStation 5"}}],
    }]}
    client = AsyncMock()
    client.get.return_value = response
    context = AsyncMock()
    context.__aenter__.return_value = client
    monkeypatch.setattr(rawg.httpx, "AsyncClient", Mock(return_value=context))

    payload = await rawg.fetch_rawg_games("Hades II")

    assert payload["results"][0]["platforms"] == ["PC", "PlayStation 5"]
```

- [ ] **Step 5: Verify enrichment GREEN and commit**

Run: `rtk pytest -q tests/test_recommendation_enrichment.py tests/test_rawg.py`

Expected: PASS.

Run: `rtk git add app/recommendations.py app/integrations/rawg.py tests/test_recommendation_enrichment.py tests/test_rawg.py`

Run: `rtk git commit -m "feat: enrich AI picks from the catalog"`

### Task 3: Secure and extend the recommendation API contract

**Files:**
- Modify: `app/schemas.py`
- Modify: `app/main.py`
- Modify: `tests/test_api_contracts.py`

**Interfaces:**
- Consumes: `get_current_user`, `get_db`, `get_quota_status`, `reserve_quota`, `get_recommendation`, and `enrich_recommendations`.
- Produces: authenticated `GET /recommendations/quota` and authenticated `POST /recommendations`.

- [ ] **Step 1: Write failing endpoint contract tests**

Add isolated dependency overrides for the user and database, and monkeypatch quota/provider/enrichment boundaries. Define the helpers in the same test module:

```python
@pytest.fixture
def authenticated_ai_request():
    user = SimpleNamespace(id=uuid.uuid4())
    db = object()
    main.app.dependency_overrides[main.get_current_user] = lambda: user
    main.app.dependency_overrides[main.get_db] = lambda: db
    try:
        yield user, db
    finally:
        main.app.dependency_overrides.clear()

def quota_snapshot(remaining: int) -> QuotaSnapshot:
    return QuotaSnapshot(
        limit=3,
        remaining=remaining,
        cooldown_until=None,
        reset_at=datetime(2026, 9, 2, tzinfo=timezone.utc),
    )

def test_ai_recommendations_require_authentication():
    response = client.post("/recommendations", json={"prompt": "cozy co-op", "liked_game_ids": []})
    assert response.status_code == 401


def test_ai_recommendation_quota_denial_is_structured(monkeypatch, authenticated_ai_request):
    snapshot = QuotaSnapshot(
        limit=3, remaining=0, cooldown_until=None,
        reset_at=datetime(2026, 9, 2, tzinfo=timezone.utc),
    )
    def deny(*_args, **_kwargs):
        raise QuotaDenied("ai_daily_quota_exhausted", "Daily AI search limit reached.", snapshot)
    monkeypatch.setattr(main, "reserve_quota", deny)
    response = client.post("/recommendations", json={"prompt": "cozy co-op"})
    assert response.status_code == 429
    assert response.json()["detail"]["code"] == "ai_daily_quota_exhausted"
    assert response.json()["detail"]["quota"]["remaining"] == 0


def test_ai_response_contains_quota_catalog_cover_reason_and_tags(monkeypatch, authenticated_ai_request):
    monkeypatch.setattr(main, "reserve_quota", lambda *_a, **_k: quota_snapshot(remaining=2))
    monkeypatch.setattr(main, "get_recommendation", lambda *_a, **_k: {
        "recommendations": [{"title": "Hades II", "reason": "Fast runs", "tags": ["Action"]}]
    })
    async def enrich(items, _search):
        return [{**items[0], "game": {
            "id": 8, "name": "Hades II", "released": "2025-09-25",
            "background_image": "cover.jpg", "platforms": ["PC"],
        }}]
    monkeypatch.setattr(main, "enrich_recommendations", enrich)
    response = client.post("/recommendations", json={"prompt": "fast roguelike"})
    assert response.status_code == 200
    assert response.json()["recommendations"][0]["game"]["id"] == 8
    assert response.json()["recommendations"][0]["reason"] == "Fast runs"
    assert response.json()["quota"]["remaining"] == 2
```

Add these two complete contract tests:

```python
def test_quota_status_returns_authoritative_fields(monkeypatch, authenticated_ai_request):
    monkeypatch.setattr(main, "get_quota_status", lambda *_a, **_k: quota_snapshot(remaining=3))
    response = client.get("/recommendations/quota")
    assert response.status_code == 200
    assert response.json() == {
        "limit": 3, "remaining": 3, "cooldown_until": None,
        "reset_at": "2026-09-02T00:00:00Z",
    }

def test_blank_prompt_does_not_reserve_quota(monkeypatch, authenticated_ai_request):
    reserve = Mock()
    monkeypatch.setattr(main, "reserve_quota", reserve)
    response = client.post("/recommendations", json={"prompt": "   "})
    assert response.status_code == 400
    reserve.assert_not_called()
```

- [ ] **Step 2: Run endpoint tests and verify RED**

Run: `rtk pytest -q tests/test_api_contracts.py -k "ai_recommendation"`

Expected: FAIL because the endpoints are not authenticated and the new schemas do not exist.

- [ ] **Step 3: Add quota and enriched response schemas**

```python
class RecommendationQuotaRead(BaseModel):
    limit: int
    remaining: int
    cooldown_until: datetime | None = None
    reset_at: datetime

class RecommendationCatalogGame(BaseModel):
    id: int
    name: str
    released: str | None = None
    background_image: str | None = None
    platforms: list[str] = Field(default_factory=list)

class RecommendationItem(BaseModel):
    title: str
    reason: str
    tags: list[str] = Field(default_factory=list)
    game: RecommendationCatalogGame | None = None

class RecommendationResponse(BaseModel):
    recommendations: list[RecommendationItem] = Field(default_factory=list)
    quota: RecommendationQuotaRead | None = None
```

Also add `platforms: list[str] = Field(default_factory=list)` to the existing `GameSearchItem` so ordinary catalog-search responses do not strip the RAWG platform data. Steam fallback items naturally serialize an empty list.

Keep `quota` optional because `/steam/recommendations` currently shares this response model and is outside the daily generic AI-search contract.

- [ ] **Step 4: Implement authenticated quota and recommendation endpoints**

```python
@app.get("/recommendations/quota", response_model=RecommendationQuotaRead)
def recommendation_quota(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    return get_quota_status(db, current_user.id)

@app.post("/recommendations", response_model=RecommendationResponse)
async def recommendations(
    data: RecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prompt = data.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt cannot be empty")
    try:
        quota = reserve_quota(db, current_user.id)
    except QuotaDenied as exc:
        raise HTTPException(status_code=429, detail={
            "code": exc.code, "message": exc.message, "quota": asdict(exc.snapshot),
        }) from exc
    generated = await asyncio.to_thread(get_recommendation, prompt, data.liked_game_ids)

    async def cached_search(title: str):
        key = build_cache_key("recommendation_catalog_search", q=title)
        return await get_json_cached(key, CACHE_TTL, lambda: fetch_rawg_games(title, page=1))

    enriched = await enrich_recommendations(generated.get("recommendations", []), cached_search)
    return {"recommendations": enriched, "quota": asdict(quota)}
```

Remove the IP-only `@limiter.limit("5/minute")` decorator from this endpoint. The authenticated persistent quota is the authority; anonymous requests fail before generation.

- [ ] **Step 5: Verify provider failure still consumes quota**

Add a contract test that records the reservation before the provider failure:

```python
def test_provider_failure_keeps_reserved_attempt(monkeypatch, authenticated_ai_request):
    reserve = Mock(return_value=quota_snapshot(remaining=2))
    monkeypatch.setattr(main, "reserve_quota", reserve)
    monkeypatch.setattr(
        main,
        "get_recommendation",
        Mock(side_effect=HTTPException(status_code=503, detail={
            "code": "ai_recommendations_unavailable", "message": "OpenAI is temporarily unavailable.",
        })),
    )
    response = client.post("/recommendations", json={"prompt": "cozy"})
    assert response.status_code == 503
    reserve.assert_called_once()
```

Run: `rtk pytest -q tests/test_api_contracts.py -k "ai_recommendation" tests/test_config.py`

Expected: PASS.

- [ ] **Step 6: Commit the API contract**

Run: `rtk git add app/main.py app/schemas.py tests/test_api_contracts.py`

Run: `rtk git commit -m "feat: secure AI recommendation API"`

### Task 4: Type structured quota responses in the browser client

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/lib/api.test.ts`

**Interfaces:**
- Consumes: backend quota and enriched recommendation JSON.
- Produces: `RecommendationQuota`, `RecommendationGame`, enriched `RecommendationItem`, `getRecommendationQuota()`, authenticated `getRecommendations(prompt)`, and `ApiError.detail`.

- [ ] **Step 1: Write failing browser API tests**

```ts
const validToken = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});

it("authenticates quota and recommendation calls", async () => {
  setToken(validToken)
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(jsonResponse({ limit: 3, remaining: 3, cooldown_until: null, reset_at: "2026-09-02T00:00:00Z" }))
    .mockResolvedValueOnce(jsonResponse({ recommendations: [], quota: { limit: 3, remaining: 2, cooldown_until: null, reset_at: "2026-09-02T00:00:00Z" } })))
  await getRecommendationQuota()
  await getRecommendations("cozy")
  expect(fetch).toHaveBeenNthCalledWith(1, expect.stringContaining("/recommendations/quota"), expect.objectContaining({
    headers: expect.objectContaining({}),
  }))
  expect(new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers).get("Authorization")).toBe(`Bearer ${validToken}`)
})

it("keeps structured quota detail on 429", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: {
    code: "ai_daily_quota_exhausted", message: "Daily AI search limit reached.",
    quota: { limit: 3, remaining: 0, cooldown_until: null, reset_at: "2026-09-02T00:00:00Z" },
  }}, 429)))
  const error = await getRecommendations("cozy").catch((reason) => reason)
  expect(error).toBeInstanceOf(ApiError)
  expect(error.detail.code).toBe("ai_daily_quota_exhausted")
  expect(error.detail.quota.remaining).toBe(0)
})
```

- [ ] **Step 2: Run client tests and verify RED**

Run: `rtk npm --prefix web test -- --run src/lib/api.test.ts`

Expected: FAIL because quota types, auth flags, and `ApiError.detail` are missing.

- [ ] **Step 3: Implement types and authenticated calls**

```ts
export type RecommendationQuota = {
  limit: number;
  remaining: number;
  cooldown_until: string | null;
  reset_at: string;
};

export type SearchGame = {
  id: number | null;
  name: string | null;
  released: string | null;
  background_image: string | null;
  platforms?: string[];
  source?: "steam";
  steam_appid?: number;
  url?: string;
};

export type RecommendationGame = {
  id: number;
  name: string;
  released: string | null;
  background_image: string | null;
  platforms: string[];
};

export type RecommendationItem = {
  title: string;
  reason: string;
  tags: string[];
  game?: RecommendationGame | null;
};

export type AIRecommendationResponse = {
  recommendations: RecommendationItem[];
  quota: RecommendationQuota;
};

export class ApiError extends Error {
  constructor(message: string, public status: number, public detail: unknown = null) {
    super(message);
    this.name = "ApiError";
  }
}

export function getRecommendationQuota() {
  return request<RecommendationQuota>("/recommendations/quota", { auth: true });
}

export function getRecommendations(prompt: string) {
  return request<AIRecommendationResponse>("/recommendations", {
    method: "POST", body: { prompt, liked_game_ids: [] }, auth: true,
  });
}
```

Change the request helper to pass the original JSON `detail` into `ApiError` while retaining its existing user-facing message behavior.

- [ ] **Step 4: Verify GREEN and commit**

Run: `rtk npm --prefix web test -- --run src/lib/api.test.ts src/lib/api-url.test.ts`

Expected: PASS.

Run: `rtk git add web/src/lib/api.ts web/src/lib/api.test.ts`

Run: `rtk git commit -m "feat: expose AI quota in web API"`

### Task 5: Render real covers without breaking existing catalog cards

**Files:**
- Modify: `web/src/components/GameCover.tsx`
- Create: `web/src/components/GameCover.test.tsx`

**Interfaces:**
- Consumes: existing gradient props and optional `src?: string | null`.
- Produces: the same `GameCover` component with real-image rendering and gradient fallback.

- [ ] **Step 1: Write failing cover tests**

```tsx
it("renders a real catalog cover when src is present", () => {
  render(<GameCover title="Hades II" src="https://cdn.example/hades.jpg" />)
  expect(screen.getByRole("img", { name: "Hades II cover" })).toHaveAttribute("src", "https://cdn.example/hades.jpg")
})

it("keeps the styled fallback when src is absent", () => {
  render(<GameCover title="Unknown Game" src={null} />)
  expect(screen.queryByRole("img")).not.toBeInTheDocument()
  expect(screen.getByLabelText("Unknown Game cover unavailable")).toBeVisible()
})
```

- [ ] **Step 2: Run cover tests and verify RED**

Run: `rtk npm --prefix web test -- --run src/components/GameCover.test.tsx`

Expected: FAIL because `src` and accessible cover states are unsupported.

- [ ] **Step 3: Extend `GameCover` compatibly**

Make `from` and `to` optional with stable defaults, keep the gradient DOM as the fallback, and layer the image above it:

```tsx
type Props = {
  from?: string;
  to?: string;
  src?: string | null;
  title: string;
  className?: string;
  compact?: boolean;
};

export function GameCover({
  from = "hsl(266 74% 42%)", to = "hsl(240 10% 8%)", src, title, className = "", compact = false,
}: Props) {
  const initials = title.split(/\s|:/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("");
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      aria-label={src ? undefined : `${title} cover unavailable`}
      style={{ background: `radial-gradient(120% 90% at 15% 10%, ${from}55 0%, transparent 55%), linear-gradient(135deg, ${to} 0%, ${from}22 100%), ${to}` }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_90%,rgba(255,255,255,0.08),transparent_50%)]" />
      <div className="absolute inset-0 flex flex-col justify-between p-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/50">
          GF · {title.split(" ")[0].slice(0, 4).toUpperCase()}
        </span>
        <span className={`font-black tracking-tighter text-white/95 leading-none ${compact ? "text-2xl" : "text-3xl"}`}>
          {compact ? initials : title}
        </span>
      </div>
      {src ? <img src={src} alt={`${title} cover`} className="absolute inset-0 size-full object-cover" /> : null}
    </div>
  );
}
```

Keep existing callers source-compatible and do not replace their gradients.

- [ ] **Step 4: Verify GREEN and commit**

Run: `rtk npm --prefix web test -- --run src/components/GameCover.test.tsx src/components/ui.test.tsx`

Expected: PASS.

Run: `rtk git add web/src/components/GameCover.tsx web/src/components/GameCover.test.tsx`

Run: `rtk git commit -m "feat: support real game covers"`

### Task 6: Provide a working sign-in destination for the guest gate

**Files:**
- Create: `web/src/features/auth/ActiveAuthScreen.tsx`
- Create: `web/src/features/auth/ActiveAuthScreen.test.tsx`
- Create: `web/src/routes/login.tsx`

**Interfaces:**
- Consumes: `loginUser(email, password)`, `setToken(token)`, and an `onSuccess()` callback.
- Produces: Vite/TanStack-safe `ActiveAuthScreen` and `/login` route.

- [ ] **Step 1: Write failing active-auth tests**

```tsx
const onSuccess = vi.fn();

beforeEach(() => {
  onSuccess.mockReset();
  vi.mocked(loginUser).mockReset();
  vi.mocked(setToken).mockReset();
});

it("stores the token and navigates after sign in", async () => {
  vi.mocked(loginUser).mockResolvedValue({ access_token: "token", token_type: "bearer" })
  render(<ActiveAuthScreen onSuccess={onSuccess} />)
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "player@example.test" } })
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret" } })
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }))
  await waitFor(() => expect(setToken).toHaveBeenCalledWith("token"))
  expect(onSuccess).toHaveBeenCalled()
})

it("prevents duplicate submits while login is pending", async () => {
  vi.mocked(loginUser).mockReturnValue(new Promise(() => undefined))
  render(<ActiveAuthScreen onSuccess={onSuccess} />)
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "player@example.test" } })
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret" } })
  const submit = screen.getByRole("button", { name: /sign in/i })
  fireEvent.click(submit)
  fireEvent.click(submit)
  expect(await screen.findByRole("button", { name: /signing in/i })).toBeDisabled()
  expect(loginUser).toHaveBeenCalledTimes(1)
})

it("shows the API error without navigating", async () => {
  vi.mocked(loginUser).mockRejectedValue(new ApiError("Invalid email or password", 401))
  render(<ActiveAuthScreen onSuccess={onSuccess} />)
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "player@example.test" } })
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrong" } })
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password")
  expect(onSuccess).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run auth tests and verify RED**

Run: `rtk npm --prefix web test -- --run src/features/auth/ActiveAuthScreen.test.tsx`

Expected: FAIL because the Vite-compatible screen and route do not exist.

- [ ] **Step 3: Implement the minimal active sign-in screen and route**

```tsx
export function ActiveAuthScreen({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError("");
    try {
      const token = await loginUser(email, password);
      setToken(token.access_token);
      onSuccess();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Unable to sign in. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-6">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sign in to use AI game search.</p>
      {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">Email
          <input aria-label="Email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" />
        </label>
        <label className="block text-sm font-medium">Password
          <input aria-label="Password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" />
        </label>
        <button type="submit" disabled={pending} className="w-full rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-50">
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </section>
  );
}
```

The `/login` route renders inside `AppShell` and calls `navigate({ to: "/search" })` after success. Use only TanStack Router imports; do not reuse the Next-only `AuthPanel`.

- [ ] **Step 4: Verify GREEN and commit**

Run: `rtk npm --prefix web test -- --run src/features/auth/ActiveAuthScreen.test.tsx`

Expected: PASS.

Run: `rtk npm --prefix web run build`

Expected: PASS with the generated route tree containing `/login`.

Run: `rtk git add web/src/features/auth/ActiveAuthScreen.tsx web/src/features/auth/ActiveAuthScreen.test.tsx web/src/routes/login.tsx web/src/routeTree.gen.ts`

Run: `rtk git commit -m "feat: add active sign-in route"`

### Task 7: Build the quota-aware AI recommendation UI

**Files:**
- Create: `web/src/features/discovery/AiRecommendationSearch.tsx`
- Create: `web/src/features/discovery/AiRecommendationSearch.test.tsx`
- Modify: `web/src/routes/search.tsx`
- Create: `web/src/routes/search.test.tsx`

**Interfaces:**
- Consumes: auth snapshot subscription, quota/recommendation API calls, `GameCover`, and TanStack links.
- Produces: `AiRecommendationSearch` and a search route containing real ordinary results plus AI recommendations.

- [ ] **Step 1: Write failing guest and quota-state tests**

```tsx
const availableQuota = (remaining = 3, cooldownUntil: string | null = null): RecommendationQuota => ({
  limit: 3,
  remaining,
  cooldown_until: cooldownUntil,
  reset_at: "2026-09-02T00:00:00Z",
});

function fillAndSubmit(prompt: string) {
  fireEvent.change(screen.getByLabelText(/describe what you want to play/i), { target: { value: prompt } });
  fireEvent.click(screen.getByRole("button", { name: /find games/i }));
}

it("does not call AI APIs for a guest and links to sign in", () => {
  vi.mocked(getAuthSnapshot).mockReturnValue(false)
  render(<AiRecommendationSearch />)
  expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login")
  expect(getRecommendationQuota).not.toHaveBeenCalled()
  expect(getRecommendations).not.toHaveBeenCalled()
})

it("shows remaining quota and blocks submission during cooldown", async () => {
  vi.mocked(getAuthSnapshot).mockReturnValue(true)
  vi.mocked(getRecommendationQuota).mockResolvedValue({
    limit: 3, remaining: 2,
    cooldown_until: new Date(Date.now() + 60_000).toISOString(),
    reset_at: "2026-09-02T00:00:00Z",
  })
  render(<AiRecommendationSearch />)
  expect(await screen.findByText(/2 of 3 AI searches remaining/i)).toBeVisible()
  expect(screen.getByRole("button", { name: /try again in/i })).toBeDisabled()
})
```

- [ ] **Step 2: Write failing card and retained-error tests**

```tsx
it("renders a matched cover, internal link, reason, and tags", async () => {
  vi.mocked(getAuthSnapshot).mockReturnValue(true)
  vi.mocked(getRecommendationQuota).mockResolvedValue(availableQuota())
  vi.mocked(getRecommendations).mockResolvedValue({
    recommendations: [{
      title: "Hades II", reason: "Fast runs", tags: ["Action", "Roguelike"],
      game: { id: 8, name: "Hades II", released: "2025-09-25", background_image: "cover.jpg", platforms: ["PC"] },
    }],
    quota: availableQuota(2, new Date(Date.now() + 60_000).toISOString()),
  })
  render(<AiRecommendationSearch />)
  await screen.findByText(/3 of 3 AI searches remaining/i)
  fillAndSubmit("fast runs")
  expect(await screen.findByRole("link", { name: /Hades II/i })).toHaveAttribute("href", "/games/8")
  expect(screen.getByRole("img", { name: "Hades II cover" })).toHaveAttribute("src", "cover.jpg")
  expect(screen.getByText("Fast runs")).toBeVisible()
  expect(screen.getByText("Action")).toBeVisible()
})

it("keeps existing cards after a later request fails", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.mocked(getAuthSnapshot).mockReturnValue(true)
  vi.mocked(getRecommendationQuota).mockResolvedValue(availableQuota())
  vi.mocked(getRecommendations)
    .mockResolvedValueOnce({
      recommendations: [{ title: "Hades II", reason: "Fast runs", tags: ["Action"], game: null }],
      quota: availableQuota(2, new Date(Date.now() + 60_000).toISOString()),
    })
    .mockRejectedValueOnce(new Error("OpenAI is temporarily unavailable."))
  render(<AiRecommendationSearch />)
  await screen.findByText(/3 of 3 AI searches remaining/i)
  fillAndSubmit("fast runs")
  expect(await screen.findByText("Hades II")).toBeVisible()
  await vi.advanceTimersByTimeAsync(60_000)
  fillAndSubmit("something else")
  expect(await screen.findByRole("alert")).toHaveTextContent("OpenAI is temporarily unavailable.")
  expect(screen.getByText("Hades II")).toBeVisible()
  vi.useRealTimers()
})

it("uses ordinary catalog search for an unmatched recommendation", async () => {
  vi.mocked(getAuthSnapshot).mockReturnValue(true)
  vi.mocked(getRecommendationQuota).mockResolvedValue(availableQuota())
  vi.mocked(getRecommendations).mockResolvedValue({
    recommendations: [{ title: "Unknown Gem", reason: "Fits the mood", tags: ["Co-op"], game: null }],
    quota: availableQuota(2),
  })
  render(<AiRecommendationSearch />)
  await screen.findByText(/3 of 3 AI searches remaining/i)
  fillAndSubmit("hidden co-op")
  const fallback = await screen.findByRole("link", { name: /search catalog for Unknown Gem/i })
  expect(fallback).toHaveAttribute("href", "/search?q=Unknown%20Gem")
  expect(screen.queryByRole("link", { name: /view Unknown Gem/i })).not.toBeInTheDocument()
  expect(screen.getByText("Fits the mood")).toBeVisible()
  expect(screen.getByText("Co-op")).toBeVisible()
})
```

In `web/src/routes/search.test.tsx`, prove the fallback destination performs a real API search:

```tsx
it("loads ordinary catalog results from the q URL parameter", async () => {
  vi.mocked(getAuthSnapshot).mockReturnValue(false)
  vi.mocked(searchGames).mockResolvedValue({ results: [{
    id: 8, name: "Hades II", released: "2025-09-25",
    background_image: "cover.jpg", platforms: ["PC"],
  }] })
  const history = createMemoryHistory({ initialEntries: ["/search?q=Hades%20II"] })
  const router = createRouter({ routeTree, history })
  render(<RouterProvider router={router} />)
  expect(await screen.findByRole("link", { name: /Hades II/i })).toHaveAttribute("href", "/games/8")
  expect(searchGames).toHaveBeenCalledWith("Hades II")
  expect(screen.getByRole("img", { name: "Hades II cover" })).toHaveAttribute("src", "cover.jpg")
})
```

- [ ] **Step 3: Run AI UI tests and verify RED**

Run: `rtk npm --prefix web test -- --run src/features/discovery/AiRecommendationSearch.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 4: Implement authoritative quota loading and countdown**

Use `useSyncExternalStore(subscribeToAuthChanges, getAuthSnapshot, () => false)`. Fetch quota only when authenticated. Maintain separate `quotaState`, `recommendations`, `pending`, `error`, and `now` state. Tick `now` once per second only while `cooldown_until` is in the future.

```tsx
const authenticated = useSyncExternalStore(subscribeToAuthChanges, getAuthSnapshot, () => false);
const [quota, setQuota] = useState<RecommendationQuota | null>(null);
const [quotaState, setQuotaState] = useState<"idle" | "loading" | "success" | "error">("idle");
const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
const [prompt, setPrompt] = useState("");
const [pending, setPending] = useState(false);
const [error, setError] = useState("");
const [now, setNow] = useState(() => Date.now());

const loadQuota = useCallback(async () => {
  if (!authenticated) return;
  setQuotaState("loading");
  try {
    setQuota(await getRecommendationQuota());
    setNow(Date.now());
    setQuotaState("success");
  } catch {
    setQuotaState("error");
  }
}, [authenticated]);

useEffect(() => { void loadQuota(); }, [loadQuota]);

const cooldownSeconds = quota?.cooldown_until
  ? Math.max(0, Math.ceil((Date.parse(quota.cooldown_until) - now) / 1000))
  : 0;

useEffect(() => {
  if (cooldownSeconds <= 0) return;
  const timer = window.setInterval(() => setNow(Date.now()), 1000);
  return () => window.clearInterval(timer);
}, [cooldownSeconds]);

const disabled = pending || !quota || quota.remaining === 0 || cooldownSeconds > 0;

async function submit(event: FormEvent) {
  event.preventDefault();
  const normalized = prompt.trim();
  if (!normalized || disabled) return;
  setPending(true); setError("");
  try {
    const response = await getRecommendations(normalized);
    setRecommendations(response.recommendations);
    setQuota(response.quota);
    setNow(Date.now());
  } catch (reason) {
    if (reason instanceof ApiError && reason.status === 429 && isQuotaDetail(reason.detail)) {
      setQuota(reason.detail.quota);
      setNow(Date.now());
    }
    setError(reason instanceof Error ? reason.message : "AI search is unavailable.");
  } finally {
    setPending(false);
  }
}
```

When quota loading fails, show an unavailable state with a retry action and keep submit disabled. When exhausted, show the localized `reset_at` time.

Render every state explicitly:

```tsx
if (!authenticated) {
  return (
    <section className="mb-10 rounded-2xl border border-primary/20 bg-primary/5 p-6">
      <p className="font-mono text-xs uppercase tracking-widest text-primary">AI game search</p>
      <h2 className="mt-2 text-2xl font-bold">Personalized picks require an account</h2>
      <p className="mt-2 text-sm text-muted-foreground">Sign in to get up to three AI searches per UTC day.</p>
      <Link to="/login" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground">Sign in</Link>
    </section>
  );
}

return (
  <section className="mb-10 rounded-2xl border border-border bg-surface p-6">
    <p className="font-mono text-xs uppercase tracking-widest text-primary">AI game search</p>
    <h2 className="mt-2 text-2xl font-bold">Describe what you want to play</h2>
    {quota ? <p className="mt-2 text-sm text-muted-foreground">{quota.remaining} of {quota.limit} AI searches remaining today</p> : null}
    {quotaState === "loading" ? <StatePanel kind="loading" title="Loading AI search allowance" /> : null}
    {quotaState === "error" ? <StatePanel kind="error" title="AI search allowance is unavailable" action={{ label: "Retry", onClick: loadQuota }} /> : null}
    {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
    <form onSubmit={submit} className="mt-5 flex gap-3">
      <label className="sr-only" htmlFor="ai-search-prompt">Describe what you want to play</label>
      <input id="ai-search-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} className="flex-1 rounded-xl border border-border bg-background px-4 py-3" />
      <button type="submit" disabled={disabled} className="rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-50">
        {pending ? "Finding games…" : cooldownSeconds > 0 ? `Try again in ${cooldownSeconds}s` : quota?.remaining === 0 ? `Resets ${new Date(quota.reset_at).toLocaleString()}` : "Find games"}
      </button>
    </form>
    {pending ? <div aria-label="Loading recommendations" className="mt-6 grid grid-cols-2 gap-5 lg:grid-cols-4">{[0, 1, 2, 3].map((key) => <div key={key} className="aspect-[3/4] animate-pulse rounded-xl bg-surface-2" />)}</div> : null}
    {!pending && recommendations.length ? <div className="mt-6 grid grid-cols-2 gap-5 lg:grid-cols-4">{recommendations.map((item) => <RecommendationCard key={`${item.title}-${item.reason}`} item={item} />)}</div> : null}
  </section>
);
```

- [ ] **Step 5: Implement catalog-native recommendation cards**

Implement the card as a bounded presentational unit:

```tsx
function RecommendationCard({ item }: { item: RecommendationItem }) {
  const content = (
    <>
      <GameCover title={item.game?.name ?? item.title} src={item.game?.background_image} className="aspect-[3/4] w-full" />
      <div className="p-4">
        <span className="font-mono text-[10px] uppercase tracking-widest text-primary">AI pick</span>
        <h3 className="mt-2 font-bold">{item.game?.name ?? item.title}</h3>
        {item.game?.released ? <p className="mt-1 text-xs text-muted-foreground">{item.game.released}</p> : null}
        {item.game?.platforms.length ? <p className="mt-1 text-xs text-muted-foreground">{item.game.platforms.join(" · ")}</p> : null}
        <p className="mt-3 text-sm text-muted-foreground">{item.reason}</p>
        <div className="mt-3 flex flex-wrap gap-1">{item.tags.map((tag) => <Chip key={tag}>{tag}</Chip>)}</div>
      </div>
    </>
  );
  return item.game ? (
    <Link
      to="/games/$gameId"
      params={{ gameId: String(item.game.id) }}
      aria-label={`View ${item.game.name}`}
      className="overflow-hidden rounded-xl border border-border bg-surface transition hover:border-white/20"
    >
      {content}
    </Link>
  ) : (
    <article className="overflow-hidden rounded-xl border border-border bg-surface">
      {content}
      <a className="m-4 inline-flex text-sm font-bold text-primary" href={`/search?q=${encodeURIComponent(item.title)}`}>
        Search catalog for {item.title}
      </a>
    </article>
  );
}
```

- [ ] **Step 6: Replace prototype search behavior with URL-backed catalog results and mount AI search**

Declare search validation and controlled submission in `web/src/routes/search.tsx`:

```tsx
type SearchParams = { q?: string };
export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === "string" && search.q.trim() ? search.q.trim() : undefined,
  }),
  component: SearchPage,
});
```

Replace the mock-data body with controlled query state and real API states:

```tsx
function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [input, setInput] = useState(q ?? "");
  const [state, setState] = useState<
    { status: "idle" | "loading" | "error" | "success"; games: SearchGame[]; message?: string }
  >({ status: q ? "loading" : "idle", games: [] });

  useEffect(() => {
    setInput(q ?? "");
    if (!q) {
      setState({ status: "idle", games: [] });
      return;
    }
    let active = true;
    setState({ status: "loading", games: [] });
    void searchGames(q).then(
      ({ results }) => active && setState({ status: "success", games: results }),
      () => active && setState({ status: "error", games: [], message: "Catalog search is unavailable." }),
    );
    return () => { active = false; };
  }, [q]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = input.trim();
    void navigate({ to: "/search", search: next ? { q: next } : {} });
  }

  return (
    <AppShell>
      <AiRecommendationSearch />
      <SectionHeader title="Search the catalog" hint="Search by game title." />
      <form onSubmit={submit} className="mb-6 flex gap-3">
        <label className="sr-only" htmlFor="catalog-search">Game title</label>
        <input id="catalog-search" value={input} onChange={(event) => setInput(event.target.value)} className="flex-1 rounded-xl border border-border bg-surface px-4 py-3" />
        <button type="submit" className="rounded-xl bg-primary px-5 font-bold text-primary-foreground">Search</button>
      </form>
      {state.status === "loading" ? <StatePanel kind="loading" title="Searching games" /> : null}
      {state.status === "error" ? <StatePanel kind="error" title="Could not search games" detail={state.message} /> : null}
      {state.status === "success" && state.games.length === 0 ? <StatePanel kind="empty" title="No games found" /> : null}
      {state.status === "success" && state.games.length > 0 ? (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {state.games.map((game) => game.id ? (
            <Link key={game.id} to="/games/$gameId" params={{ gameId: String(game.id) }} aria-label={`View ${game.name ?? "game"}`}>
              <GameCover title={game.name ?? "Untitled game"} src={game.background_image} className="aspect-[3/4] w-full" />
              <h2 className="mt-3 font-bold">{game.name ?? "Untitled game"}</h2>
            </Link>
          ) : (
            <article key={game.steam_appid ?? game.name}>
              <GameCover title={game.name ?? "Untitled game"} src={game.background_image} className="aspect-[3/4] w-full" />
              <h2 className="mt-3 font-bold">{game.name ?? "Untitled game"}</h2>
              {game.url ? <a href={game.url} target="_blank" rel="noreferrer">View on Steam</a> : null}
            </article>
          ))}
        </div>
      ) : null}
    </AppShell>
  );
}
```

Remove the `games`/`mockData` import from this route.

- [ ] **Step 7: Verify search integration GREEN**

Run: `rtk npm --prefix web test -- --run src/features/discovery/AiRecommendationSearch.test.tsx src/routes/search.test.tsx src/components/GameCover.test.tsx`

Expected: PASS.

Run: `rtk npm --prefix web run lint`

Expected: PASS.

Run: `rtk npm --prefix web run build`

Expected: PASS.

- [ ] **Step 8: Commit the AI search interface**

Run: `rtk git add web/src/features/discovery/AiRecommendationSearch.tsx web/src/features/discovery/AiRecommendationSearch.test.tsx web/src/routes/search.tsx web/src/routes/search.test.tsx web/src/routeTree.gen.ts`

Run: `rtk git commit -m "feat: make AI game search actionable"`

### Task 8: Full verification, review, push, and pull request

**Files:**
- Verify all files changed in Tasks 1-7.
- Do not modify or stage unrelated working-tree files.

**Interfaces:**
- Consumes: the complete backend and frontend implementation.
- Produces: verified branch `codex/ai-search-hardening` and a reviewable pull request.

- [ ] **Step 1: Run all backend tests**

Run: `rtk pytest -q`

Expected: PASS with no failures.

- [ ] **Step 2: Run all frontend tests**

Run: `rtk npm --prefix web test -- --run`

Expected: PASS with no failures.

- [ ] **Step 3: Run frontend lint and production build**

Run: `rtk npm --prefix web run lint`

Expected: PASS with no errors.

Run: `rtk npm --prefix web run build`

Expected: PASS and emit the production Vite build.

- [ ] **Step 4: Inspect only the task diff and working tree**

Run: `rtk git status --short --branch`

Expected: only deliberate task changes are committed; unrelated user files remain untouched and unstaged.

Run: `rtk diff HEAD~7..HEAD -- app alembic/versions tests web/src docs/superpowers`

Expected: the diff contains only AI quota, enrichment, auth-gate dependency, catalog-search fallback, tests, and documentation.

- [ ] **Step 5: Use verification-before-completion and requesting-code-review**

Read and follow `C:\Users\zagir\.codex\skills\verification-before-completion\SKILL.md`, then `C:\Users\zagir\.codex\skills\requesting-code-review\SKILL.md`. Address every confirmed high- or medium-priority issue and rerun the affected verification command.

- [ ] **Step 6: Push and open the pull request**

Run: `rtk git push -u origin codex/ai-search-hardening`

Expected: push succeeds and sets the upstream branch.

Run: `rtk gh pr create --title "feat: harden AI game search" --body "Adds authenticated daily AI quotas, cooldown enforcement, exact catalog enrichment, real covers and links, and a quota-aware search UI. Includes backend/frontend regression coverage."`

Expected: GitHub returns the new pull-request URL.
