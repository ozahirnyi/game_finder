# PSN Catalog Matcher V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reliably link ordinary imported PSN games to the correct PlayStation catalog record while preserving unresolved games for manual selection and rejecting only evidence-backed non-games.

**Architecture:** Add a pure `psn_catalog_matcher` module for evidence normalization, bounded query generation, deterministic scoring, and safe winner selection. Add a small catalog service that batches all generated queries through the existing IGDB resolver, while persistence and endpoint wiring remain in the existing SQLAlchemy/FastAPI flow. Store PSN aliases, source platforms, and matcher version so future imports disambiguate better and old unresolved rows are automatically retried without re-upload.

**Tech Stack:** Python 3, FastAPI, SQLAlchemy, Alembic, Pydantic, pytest, React 19, TypeScript, TanStack Query, Vitest/Testing Library.

## Global Constraints

- No title-specific rules for reported games; examples are fixtures for general behavior only.
- Automatic links require deterministic exact full-title, safe-alias, or cleaned-base identity evidence.
- Generic fuzzy, edit-distance, substring, embedding, or popularity-only matches remain manual-only.
- Explicit source or catalog evidence for apps, themes, subscriptions, DLC/add-ons, packs, mods, updates, demos, betas, test servers, soundtracks, and currencies prevents automatic linking.
- Bundles, remasters, ports, episodes, seasons, and standalone expansions remain eligible catalog records; conflicting edition evidence rejects a candidate.
- Known source platform must be compatible; an explicitly non-PlayStation catalog record is never automatically linked to a PSN row.
- Existing `review` and `no_match` rows retry automatically; linked, quarantined, and explicitly `skipped` rows are not reconsidered.
- Batch size remains eight library rows, query variants are capped at six per row, and provider failures leave the whole batch retryable.
- Steam behavior and identities are unchanged.
- Every shell command in this project starts with `rtk`; implementation uses a fresh `codex/<task>` branch in an isolated worktree.

## File map

- Create `app/psn_catalog_matcher.py`: pure evidence model, title normalization, safe alias extraction, query variants, candidate scoring, and decision selection.
- Create `app/psn_catalog_service.py`: flatten/deduplicate queries, invoke the existing bounded resolver, aggregate candidates, and emit privacy-safe diagnostics.
- Modify `app/psn_classification.py`: expose a public exact-evidence helper used to reject unsafe product aliases without broad substring filtering.
- Modify `app/database.py`: persist PSN aliases, source platforms, and matcher version on `Game`.
- Create `alembic/versions/e4f6a8c0b2d1_add_psn_catalog_matcher_evidence.py`: add the three backward-compatible columns.
- Modify `app/main.py`: transport evidence in signed preview tokens, save it on confirm, remove catalog dependency from preview, run Matcher V2 during enrichment, and compute version-aware pending state.
- Modify `app/schemas.py`: expose the backend-generated cleaned manual-search query.
- Modify `web/src/lib/api.ts`: type the new manual-search query field.
- Modify `web/src/routes/library.tsx`: initialize inline manual search from the cleaned backend query.
- Create `tests/test_psn_catalog_matcher.py`: pure variant and scoring tests.
- Create `tests/test_psn_catalog_service.py`: batching, candidate aggregation, failure, and logging tests.
- Modify `tests/test_psn_resolution.py`: safe alias/non-game evidence tests.
- Modify `tests/integration/backend/test_profile_dashboard_psn_api.py`: token persistence, import independence, matcher versioning, enrichment, platform, and merge tests.
- Modify `tests/test_migration_graph.py`: assert a single Alembic head after the new migration.
- Modify `tests/test_api_contracts.py`: include `catalog_search_query` in the library contract.
- Modify `web/src/routes/-library.test.tsx`: stale-row enrichment and cleaned manual-query UI tests.

---

### Task 1: Deterministic PSN evidence and query variants

**Files:**
- Create: `app/psn_catalog_matcher.py`
- Modify: `app/psn_classification.py`
- Create: `tests/test_psn_catalog_matcher.py`
- Modify: `tests/test_psn_resolution.py`

**Interfaces:**
- Produces: `PsnCatalogEvidence(title: str, aliases: tuple[str, ...], platforms: tuple[str, ...])`.
- Produces: `safe_psn_search_aliases(candidate: PsnExportCandidate) -> tuple[str, ...]`.
- Produces: `normalize_psn_catalog_identity(value: str) -> str`.
- Produces: `build_psn_query_variants(evidence: PsnCatalogEvidence) -> tuple[str, ...]`, capped at five variants per source string and globally deduplicated in stable order.
- Produces: `preferred_psn_catalog_query(evidence: PsnCatalogEvidence) -> str`.

- [ ] **Step 1: Write failing normalization, alias, and variant tests**

Add table-driven tests that require the general transformations and protect normal titles containing words such as `Theme`, `Pack`, or `Test`:

```python
@pytest.mark.parametrize(
    ("source", "expected"),
    [
        ("Apex Legends™", "apex legends"),
        ("DC UNIVERSE ONLINE [SCEE PS4]", "dc universe online"),
        ("Terraria – PlayStation®4 Edition", "terraria"),
        ("EA SPORTS™ FIFA 16", "fifa 16"),
        ("R4: Ridge Racer", "r 4 ridge racer"),
    ],
)
def test_query_variants_include_clean_identity(source, expected):
    evidence = PsnCatalogEvidence(source)
    identities = {normalize_psn_catalog_identity(value) for value in build_psn_query_variants(evidence)}
    assert expected in identities


def test_query_variants_keep_provider_visible_cleanup():
    assert "Apex Legends" in build_psn_query_variants(PsnCatalogEvidence("Apex Legends™"))
    assert "R 4: Ridge Racer" in build_psn_query_variants(PsnCatalogEvidence("R4: Ridge Racer"))
    assert preferred_psn_catalog_query(PsnCatalogEvidence("EA SPORTS™ FIFA 16")) == "FIFA 16"


def test_safe_aliases_keep_game_products_and_drop_entitlements():
    candidate = PsnExportCandidate(
        "Example Game",
        product_names=("Example Game", "Example Game Complete Edition", "Example Game PlayStation Plus Pack"),
    )
    assert safe_psn_search_aliases(candidate) == ("Example Game", "Example Game Complete Edition")


@pytest.mark.parametrize("title", ["Adventure Theme Park", "Pack Your Bags", "Test Drive Adventure"])
def test_variant_cleanup_does_not_classify_generic_words_as_non_games(title):
    assert build_psn_query_variants(PsnCatalogEvidence(title))[0] == title
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `rtk pytest tests/test_psn_catalog_matcher.py tests/test_psn_resolution.py -q`

Expected: FAIL because the matcher module and public alias helper do not exist.

- [ ] **Step 3: Implement pure evidence, normalization, safe aliases, and bounded variants**

Implement immutable evidence and stable variant generation. Keep wrappers as anchored patterns; never delete arbitrary interior words:

```python
PSN_CATALOG_MATCHER_VERSION = 2
MAX_QUERY_VARIANTS_PER_ROW = 6
PSN_PLATFORM_SUFFIX_RE = re.compile(
    r"\s*(?:[-–—:]\s*)?(?:\[(?:SCEE\s+)?PS[345]\]|\(PS[45](?:\s*&\s*PS5)?\)|"
    r"PlayStation\s*[345](?:\s+Edition)?|PS[345](?:\s*&\s*PS5)?)\s*$",
    re.IGNORECASE,
)
PRESENTATION_PREFIX_RE = re.compile(r"^EA\s+SPORTS\s+", re.IGNORECASE)
RETRIEVAL_EDITION_RE = re.compile(
    r"\s*[-–—:]?\s*(?:complete|deluxe|ultimate|game\s+of\s+the\s+year)\s+edition\s*$",
    re.IGNORECASE,
)
PLATFORM_NAMES = {
    "ps 3": "PS3", "playstation 3": "PS3",
    "ps 4": "PS4", "playstation 4": "PS4",
    "ps 5": "PS5", "playstation 5": "PS5",
    "ps vita": "VITA", "playstation vita": "VITA", "vita": "VITA",
}


@dataclass(frozen=True)
class PsnCatalogEvidence:
    title: str
    aliases: tuple[str, ...] = ()
    platforms: tuple[str, ...] = ()


def normalize_psn_catalog_identity(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    value = value.translate(str.maketrans({"™": "", "®": "", "©": ""}))
    value = re.sub(r"(?<=\D)(?=\d)|(?<=\d)(?=\D)", " ", value)
    return " ".join("".join(char if char.isalnum() else " " for char in value.casefold()).split())


def normalize_query_whitespace(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).split())


def normalize_query_punctuation(value: str) -> str:
    value = normalize_query_whitespace(value).translate(str.maketrans({"™": "", "®": "", "©": ""}))
    return re.sub(r"\s*[-–—]\s*", " - ", value).strip(" -")


def normalize_query_boundaries(value: str) -> str:
    return re.sub(r"(?<=\D)(?=\d)|(?<=\d)(?=\D)", " ", value)


def strip_psn_platform_wrapper(value: str) -> str:
    previous = value
    while (cleaned := PSN_PLATFORM_SUFFIX_RE.sub("", previous).strip(" -:()[]")) != previous:
        previous = cleaned
    return previous


def strip_presentation_prefix(value: str) -> str:
    return PRESENTATION_PREFIX_RE.sub("", value).strip()


def strip_retrieval_edition(value: str) -> str:
    return RETRIEVAL_EDITION_RE.sub("", value).strip(" -:")


def normalize_psn_platform(value: str) -> str | None:
    return PLATFORM_NAMES.get(normalize_psn_catalog_identity(value))


def build_psn_query_variants(evidence: PsnCatalogEvidence) -> tuple[str, ...]:
    values = (evidence.title, *evidence.aliases)
    variants: list[str] = []
    for value in values:
        cleaned = normalize_query_punctuation(value)
        candidates = (
            normalize_query_whitespace(value),
            cleaned,
            strip_psn_platform_wrapper(cleaned),
            strip_presentation_prefix(strip_psn_platform_wrapper(cleaned)),
            strip_retrieval_edition(strip_presentation_prefix(strip_psn_platform_wrapper(cleaned))),
            normalize_query_boundaries(
                strip_retrieval_edition(strip_presentation_prefix(strip_psn_platform_wrapper(cleaned)))
            ),
        )
        for candidate in candidates:
            query_key = normalize_query_whitespace(candidate).casefold()
            if candidate and query_key not in {
                normalize_query_whitespace(existing).casefold() for existing in variants
            }:
                variants.append(candidate)
                if len(variants) == MAX_QUERY_VARIANTS_PER_ROW:
                    return tuple(variants)
    return tuple(variants)


def preferred_psn_catalog_query(evidence: PsnCatalogEvidence) -> str:
    variants = build_psn_query_variants(evidence)
    return min(
        variants,
        key=lambda value: (len(normalize_psn_catalog_identity(value).split()), len(value)),
        default=evidence.title,
    )
```

In `app/psn_classification.py`, expose `is_explicit_psn_non_game_product(title, product_name)` as a public wrapper around the existing exact normalized `_is_explicit_product_identity`. Implement alias filtering without broad substring rules:

```python
def is_explicit_psn_non_game_product(title: str, product_name: str) -> bool:
    return _is_explicit_product_identity(
        normalize_psn_product_identity(product_name),
        normalize_psn_product_identity(title),
    )


def safe_psn_search_aliases(candidate: PsnExportCandidate) -> tuple[str, ...]:
    aliases: list[str] = []
    seen: set[str] = set()
    for value in (candidate.title, *candidate.product_names):
        alias = normalize_query_whitespace(value)
        identity = normalize_psn_product_identity(alias)
        unsafe = (
            not identity
            or identity in KNOWN_NON_GAME_PSN_PRODUCT_IDENTITIES
            or identity in KNOWN_NON_GAME_PSN_STORE_CATEGORY_IDENTITIES
            or is_explicit_non_game_self_title(alias)
            or is_explicit_psn_non_game_product(candidate.title, alias)
        )
        if unsafe or identity in seen:
            continue
        seen.add(identity)
        aliases.append(alias)
        if len(aliases) == 8:
            break
    return tuple(aliases)
```

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `rtk pytest tests/test_psn_catalog_matcher.py tests/test_psn_resolution.py -q`

Expected: PASS, including existing classification tests.

- [ ] **Step 5: Commit the query layer**

```bash
rtk git add app/psn_catalog_matcher.py app/psn_classification.py tests/test_psn_catalog_matcher.py tests/test_psn_resolution.py
rtk git commit -m "feat: add deterministic PSN catalog queries"
```

### Task 2: Safe catalog candidate scoring

**Files:**
- Modify: `app/psn_catalog_matcher.py`
- Modify: `tests/test_psn_catalog_matcher.py`

**Interfaces:**
- Produces: `PsnCatalogDecision(state: Literal["linked", "review", "no_match"], match: dict | None, reason: str, evidence: str | None, score: int | None)`.
- Produces: `choose_psn_catalog_match(evidence: PsnCatalogEvidence, results_by_query: Mapping[str, Sequence[dict]]) -> PsnCatalogDecision`.

- [ ] **Step 1: Write failing scoring tests**

Cover unique cleaned equality, a same-title PS4/PC collision, unknown-platform ambiguity, unsafe game types, conflicting editions, deduplication by IGDB ID, and refusal of fuzzy matches:

```python
def test_cleaned_exact_match_links_playstation_release():
    evidence = PsnCatalogEvidence("EA SPORTS™ FIFA 16", platforms=("PS4",))
    decision = choose_psn_catalog_match(evidence, {
        "FIFA 16": [
            {"id": 1, "name": "FIFA 16", "platforms": ["PC"], "game_type": 0},
            {"id": 2, "name": "FIFA 16", "platforms": ["PlayStation 4"], "game_type": 0},
        ],
    })
    assert decision.state == "linked"
    assert decision.match["id"] == 2


def test_fuzzy_result_is_never_auto_linked():
    evidence = PsnCatalogEvidence("Battlefront", platforms=("PS4",))
    decision = choose_psn_catalog_match(evidence, {
        "Battlefront": [{"id": 3, "name": "Star Wars Battlefront", "platforms": ["PlayStation 4"], "game_type": 0}],
    })
    assert decision.state == "review"


def test_unknown_source_platform_keeps_equal_playstation_releases_ambiguous():
    evidence = PsnCatalogEvidence("Example")
    decision = choose_psn_catalog_match(evidence, {
        "Example": [
            {"id": 10, "name": "Example", "platforms": ["PlayStation 4"], "game_type": 0},
            {"id": 11, "name": "Example", "platforms": ["PlayStation 5"], "game_type": 0},
        ],
    })
    assert decision.state == "review"
    assert decision.reason == "ambiguous_top_candidates"


def test_same_catalog_id_returned_by_two_queries_scores_once():
    game = {"id": 12, "name": "Example", "platforms": ["PlayStation 5"], "game_type": 0}
    decision = choose_psn_catalog_match(PsnCatalogEvidence("Example", platforms=("PS5",)), {
        "Example™": [game],
        "Example": [game],
    })
    assert decision.state == "linked"
    assert decision.match["id"] == 12


def test_conflicting_edition_is_not_auto_linked():
    decision = choose_psn_catalog_match(PsnCatalogEvidence("Example Complete Edition"), {
        "Example": [{"id": 13, "name": "Example Ultimate Edition", "platforms": ["PlayStation 5"], "game_type": 0}],
    })
    assert decision.state == "review"


@pytest.mark.parametrize("game_type", [1, 2, 5, 13, 14])
def test_non_independent_catalog_types_are_not_linked(game_type):
    decision = choose_psn_catalog_match(
        PsnCatalogEvidence("Example", platforms=("PS5",)),
        {"Example": [{"id": 4, "name": "Example", "platforms": ["PlayStation 5"], "game_type": game_type}]},
    )
    assert decision.state == "review"
```

- [ ] **Step 2: Run the scoring tests and verify they fail**

Run: `rtk pytest tests/test_psn_catalog_matcher.py -q`

Expected: FAIL because `PsnCatalogDecision` and `choose_psn_catalog_match` are not implemented.

- [ ] **Step 3: Implement deterministic scoring and margin checks**

Use explicit constants and reject conditions:

```python
FULL_TITLE_SCORE = 120
SAFE_ALIAS_SCORE = 115
CLEAN_BASE_SCORE = 100
KNOWN_PLATFORM_SCORE = 25
UNKNOWN_SOURCE_PLAYSTATION_SCORE = 15
MAIN_GAME_SCORE = 20
PLAYABLE_VARIANT_SCORE = 5
MINIMUM_AUTO_LINK_SCORE = 110
MINIMUM_WIN_MARGIN = 10
REJECTED_GAME_TYPES = frozenset({1, 2, 5, 13, 14})
PLAYABLE_VARIANT_TYPES = frozenset({3, 4, 6, 7, 8, 9, 10, 11, 12})
IGDB_GAME_TYPE_VALUES = {
    "main_game": 0, "dlc_addon": 1, "expansion": 2, "bundle": 3,
    "standalone_expansion": 4, "mod": 5, "episode": 6, "season": 7,
    "remake": 8, "remaster": 9, "expanded_game": 10, "port": 11,
    "fork": 12, "pack": 13, "update": 14,
}


@dataclass(frozen=True)
class PsnCatalogDecision:
    state: Literal["linked", "review", "no_match"]
    match: dict | None = None
    reason: str = ""
    evidence: str | None = None
    score: int | None = None


@dataclass(frozen=True)
class ScoredCandidate:
    game: dict
    catalog_id: int
    score: int
    evidence: str
    rejected: bool = False


def deduplicate_candidates_by_id(results_by_query: Mapping[str, Sequence[dict]]) -> list[dict]:
    unique: dict[int, dict] = {}
    for results in results_by_query.values():
        for game in results:
            catalog_id = game.get("id")
            if isinstance(catalog_id, int) and catalog_id > 0:
                unique.setdefault(catalog_id, game)
    return list(unique.values())


def _edition_tokens(value: str) -> frozenset[str]:
    identity = normalize_psn_catalog_identity(value)
    phrases = ("complete edition", "deluxe edition", "ultimate edition", "game of the year")
    return frozenset(phrase for phrase in phrases if phrase in identity)


def _candidate_type(game: dict) -> int | None:
    value = game.get("game_type")
    if isinstance(value, dict):
        value = value.get("type")
    if isinstance(value, str):
        value = IGDB_GAME_TYPE_VALUES.get(value.casefold())
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def score_candidate(evidence: PsnCatalogEvidence, game: dict, queries: Sequence[str]) -> ScoredCandidate:
    catalog_id = int(game["id"])
    candidate_name = str(game.get("name") or "")
    candidate_key = normalize_psn_catalog_identity(candidate_name)
    title_key = normalize_psn_catalog_identity(evidence.title)
    alias_keys = {normalize_psn_catalog_identity(value) for value in evidence.aliases}
    query_keys = {normalize_psn_catalog_identity(value) for value in queries}
    candidate_query_keys = {
        normalize_psn_catalog_identity(value)
        for value in build_psn_query_variants(PsnCatalogEvidence(candidate_name))
    }
    if candidate_key == title_key:
        score, identity_evidence = FULL_TITLE_SCORE, "full_title"
    elif candidate_key in alias_keys:
        score, identity_evidence = SAFE_ALIAS_SCORE, "safe_alias"
    elif query_keys.intersection(candidate_query_keys):
        score, identity_evidence = CLEAN_BASE_SCORE, "clean_base"
    else:
        return ScoredCandidate(game, catalog_id, 0, "non_exact", True)

    game_type = _candidate_type(game)
    if game_type in REJECTED_GAME_TYPES:
        return ScoredCandidate(game, catalog_id, score, "rejected_type", True)
    candidate_platforms = {normalize_psn_catalog_identity(str(value)) for value in game.get("platforms") or ()}
    playstation_platforms = {value for value in candidate_platforms if "playstation" in value}
    if candidate_platforms and not playstation_platforms:
        return ScoredCandidate(game, catalog_id, score, "non_playstation", True)
    expected = {
        normalize_psn_catalog_identity({"PS3": "PlayStation 3", "PS4": "PlayStation 4", "PS5": "PlayStation 5", "VITA": "PlayStation Vita"}[value])
        for raw in evidence.platforms
        if (value := normalize_psn_platform(raw))
    }
    if expected and playstation_platforms and not expected.intersection(playstation_platforms):
        return ScoredCandidate(game, catalog_id, score, "platform_conflict", True)
    score += KNOWN_PLATFORM_SCORE if expected and expected.intersection(playstation_platforms) else UNKNOWN_SOURCE_PLAYSTATION_SCORE if playstation_platforms else 0
    source_editions = frozenset().union(*(_edition_tokens(value) for value in (evidence.title, *evidence.aliases)))
    catalog_editions = _edition_tokens(candidate_name)
    if source_editions and catalog_editions and source_editions.isdisjoint(catalog_editions):
        return ScoredCandidate(game, catalog_id, score, "edition_conflict", True)
    score += MAIN_GAME_SCORE if game_type == 0 else PLAYABLE_VARIANT_SCORE if game_type in PLAYABLE_VARIANT_TYPES else 0
    return ScoredCandidate(game, catalog_id, score, identity_evidence)


def choose_psn_catalog_match(evidence: PsnCatalogEvidence, results_by_query: Mapping[str, Sequence[dict]]) -> PsnCatalogDecision:
    candidates = deduplicate_candidates_by_id(results_by_query)
    scored = [score_candidate(evidence, game, tuple(results_by_query)) for game in candidates]
    accepted = sorted((item for item in scored if not item.rejected), key=lambda item: (-item.score, item.catalog_id))
    if not candidates:
        return PsnCatalogDecision("no_match", reason="no_candidates")
    if not accepted or accepted[0].score < MINIMUM_AUTO_LINK_SCORE:
        return PsnCatalogDecision("review", reason="no_safe_exact_match")
    if len(accepted) > 1 and accepted[0].score - accepted[1].score < MINIMUM_WIN_MARGIN:
        return PsnCatalogDecision("review", reason="ambiguous_top_candidates")
    winner = accepted[0]
    return PsnCatalogDecision("linked", winner.game, "safe_winner", winner.evidence, winner.score)
```

`score_candidate` must require exact normalized equality against the full title, a safe alias, or a generated cleaned/base identity. Reject explicit non-PlayStation platform sets; require exact compatibility with known `PS3`/`PS4`/`PS5`/Vita evidence; reject conflicting non-empty edition token sets. Popularity/search order may only decide identical deterministic scores after identity, platform, and type agree, and must not add score.

- [ ] **Step 4: Run all matcher tests and verify they pass**

Run: `rtk pytest tests/test_psn_catalog_matcher.py -q`

Expected: PASS.

- [ ] **Step 5: Commit candidate scoring**

```bash
rtk git add app/psn_catalog_matcher.py tests/test_psn_catalog_matcher.py
rtk git commit -m "feat: score PSN catalog candidates safely"
```

### Task 3: Batched Matcher V2 catalog service

**Files:**
- Create: `app/psn_catalog_service.py`
- Create: `tests/test_psn_catalog_service.py`
- Modify: `app/psn_resolution.py`

**Interfaces:**
- Consumes: `PsnCatalogEvidence`, `build_psn_query_variants`, `choose_psn_catalog_match`.
- Produces: `PsnCatalogUnavailable(Exception)`.
- Produces: `resolve_psn_catalog_evidence(items: Mapping[str, PsnCatalogEvidence], *, batch_fetcher=None, single_fetcher=None) -> dict[str, PsnCatalogDecision]`.

- [ ] **Step 1: Write failing service tests**

Use `AsyncMock` fetchers to prove variants are flattened once, results from multiple variants are combined, duplicate catalog IDs score once, every query is covered by bounded fallback, and any unavailable query rolls back the logical batch:

```python
def test_service_combines_raw_and_clean_query_results():
    async def batch(titles):
        return {
            title: ([{"id": 2, "name": "FIFA 16", "platforms": ["PlayStation 4"], "game_type": 0}] if title == "FIFA 16" else [])
            for title in titles
        }
    decisions = asyncio.run(resolve_psn_catalog_evidence(
        {"row": PsnCatalogEvidence("EA SPORTS™ FIFA 16", platforms=("PS4",))},
        batch_fetcher=batch,
        single_fetcher=AsyncMock(),
    ))
    assert decisions["row"].match["id"] == 2


def test_service_raises_when_any_attempted_query_is_unavailable():
    batch = AsyncMock(side_effect=IGDBError("down", 502))
    single = AsyncMock(side_effect=IGDBError("down", 502))
    with pytest.raises(PsnCatalogUnavailable):
        asyncio.run(resolve_psn_catalog_evidence(
            {"row": PsnCatalogEvidence("Example")},
            batch_fetcher=batch,
            single_fetcher=single,
        ))


def test_service_logs_aggregate_outcome_without_titles(caplog):
    async def batch(titles):
        return {title: [] for title in titles}

    with caplog.at_level("INFO", logger="app.psn_catalog_service"):
        asyncio.run(resolve_psn_catalog_evidence(
            {"row": PsnCatalogEvidence("Private Imported Title")},
            batch_fetcher=batch,
            single_fetcher=AsyncMock(),
        ))
    assert "matcher_version=2" in caplog.text
    assert "no_match=1" in caplog.text
    assert "Private Imported Title" not in caplog.text
```

- [ ] **Step 2: Run service tests and verify they fail**

Run: `rtk pytest tests/test_psn_catalog_service.py -q`

Expected: FAIL because the catalog service does not exist.

- [ ] **Step 3: Implement flattened bounded resolution and privacy-safe logs**

Implement one service call for a mapping of stable row keys:

```python
class PsnCatalogUnavailable(RuntimeError):
    pass


async def resolve_psn_catalog_evidence(items, *, batch_fetcher=None, single_fetcher=None):
    variants = {key: build_psn_query_variants(value) for key, value in items.items()}
    queries = list(dict.fromkeys(query for values in variants.values() for query in values))
    resolutions = await resolve_psn_catalog_titles(
        queries,
        max_fallback_titles=len(queries),
        batch_fetcher=batch_fetcher,
        single_fetcher=single_fetcher,
    )
    if any(resolutions.get(query) is None or resolutions[query].kind == "unavailable" for query in queries):
        logger.warning("PSN matcher provider unavailable matcher_version=%s query_count=%s", PSN_CATALOG_MATCHER_VERSION, len(queries))
        raise PsnCatalogUnavailable
    decisions = {}
    for key, evidence in items.items():
        by_query = {query: resolutions[query].results for query in variants[key]}
        decisions[key] = choose_psn_catalog_match(evidence, by_query)
    log_matcher_summary(decisions, query_count=len(queries))
    return decisions


def log_matcher_summary(decisions, *, query_count: int) -> None:
    states = Counter(decision.state for decision in decisions.values())
    reasons = Counter(decision.reason for decision in decisions.values())
    logger.info(
        "PSN matcher completed matcher_version=%s row_count=%s query_count=%s linked=%s review=%s no_match=%s reasons=%s",
        PSN_CATALOG_MATCHER_VERSION,
        len(decisions),
        query_count,
        states["linked"],
        states["review"],
        states["no_match"],
        dict(sorted(reasons.items())),
    )
```

Log only matcher version, counts, evidence category, score bucket, and unresolved reason counts. Do not log titles, aliases, uploaded content, JWTs, or authorization data. Keep `resolve_psn_catalog_titles` as provider transport; remove its obsolete exact-match interpretation only if no remaining caller relies on `kind="matched"`.

- [ ] **Step 4: Run service and resolver tests**

Run: `rtk pytest tests/test_psn_catalog_service.py tests/test_psn_resolution.py -q`

Expected: PASS and log assertions contain aggregate counts but no fixture titles.

- [ ] **Step 5: Commit the catalog service**

```bash
rtk git add app/psn_catalog_service.py app/psn_resolution.py tests/test_psn_catalog_service.py tests/test_psn_resolution.py
rtk git commit -m "feat: resolve PSN catalog variants in batches"
```

### Task 4: Persist source evidence and matcher version

**Files:**
- Modify: `app/database.py`
- Create: `alembic/versions/e4f6a8c0b2d1_add_psn_catalog_matcher_evidence.py`
- Modify: `app/main.py`
- Modify: `tests/test_migration_graph.py`
- Modify: `tests/integration/backend/test_profile_dashboard_psn_api.py`

**Interfaces:**
- Adds `Game.psn_search_aliases: list[str] | None` backed by nullable JSON.
- Adds `Game.psn_source_platforms: list[str] | None` backed by nullable JSON.
- Adds `Game.catalog_lookup_version: int | None` backed by nullable integer.
- Changes `_psn_candidate_token(user_id, candidate)` to carry bounded signed evidence.
- Changes `_psn_candidate_from_token(token, user_id) -> PsnCatalogEvidence`, accepting legacy title-only tokens.

- [ ] **Step 1: Write failing migration, token, and persistence tests**

Add assertions that the migration graph has one head, a preview token round-trips safe aliases/platforms, a legacy token still yields title-only evidence, confirm stores evidence on raw rows, and re-import merges evidence without deleting notes/playtime:

```python
def test_confirm_persists_signed_psn_catalog_evidence(
    api_client, db_session, user_factory, auth_as
):
    auth_as(user_factory(email="matcher-v2-import@example.com"))
    content = _xlsx_bytes("Transaction Detail", rows=[
        ["Transaction Date", "Game Name", "Product Name", "Content Type", "Platform", "Transaction Type"],
        ["2026-01-01", "Example Game", "Example Game", "Game", "PS5", "Product Purchase"],
        ["2026-01-02", "Example Game", "Example Game Complete Edition", "Game", "PS4", "Product Purchase"],
    ])
    preview = api_client.post("/psn/import/preview", files={"file": ("export.xlsx", content)}).json()
    token = preview["items"][0]["candidate_token"]
    response = api_client.post("/psn/import/confirm", json={
        "selections": [{"candidate_token": token, "action": "raw"}],
    })
    assert response.status_code == 200
    stored = db_session.query(Game).filter(Game.source == "psn").one()
    assert stored.psn_source_platforms == ["PS5", "PS4"]
    assert stored.psn_search_aliases == ["Example Game", "Example Game Complete Edition"]
    assert stored.catalog_lookup_version is None


def test_legacy_title_only_candidate_token_remains_valid(user_factory, auth_as, app_main):
    from jose import jwt

    user = auth_as(user_factory(email="matcher-v2-legacy@example.com"))
    token = jwt.encode({
        "sub": str(user.id),
        "title": "Legacy Game",
        "hash": app_main._psn_catalog_match_key("Legacy Game"),
    }, app_main.SECRET_KEY, algorithm="HS256")
    assert app_main._psn_candidate_from_token(token, user.id) == PsnCatalogEvidence("Legacy Game")


def test_reimport_merges_psn_evidence_and_preserves_user_data(
    api_client, db_session, user_factory, auth_as
):
    auth_as(user_factory(email="matcher-v2-merge@example.com"))
    first = _xlsx_bytes("Transaction Detail", rows=[
        ["Game Name", "Product Name", "Platform", "Transaction Type"],
        ["Example Game", "Example Game", "PS4", "Product Purchase"],
    ])
    first_item = api_client.post("/psn/import/preview", files={"file": ("first.xlsx", first)}).json()["items"][0]
    api_client.post("/psn/import/confirm", json={"selections": [{"candidate_token": first_item["candidate_token"], "action": "raw"}]})
    stored = db_session.query(Game).filter(Game.source == "psn").one()
    stored.notes = "keep me"
    stored.playtime_forever = 90
    db_session.commit()

    second = _xlsx_bytes("Transaction Detail", rows=[
        ["Game Name", "Product Name", "Platform", "Transaction Type"],
        ["Example Game", "Example Game Complete Edition", "PS5", "Product Purchase"],
    ])
    second_item = api_client.post("/psn/import/preview", files={"file": ("second.xlsx", second)}).json()["items"][0]
    api_client.post("/psn/import/confirm", json={"selections": [{"candidate_token": second_item["candidate_token"], "action": "raw"}]})
    db_session.refresh(stored)
    assert stored.psn_source_platforms == ["PS4", "PS5"]
    assert stored.psn_search_aliases == ["Example Game", "Example Game Complete Edition"]
    assert (stored.notes, stored.playtime_forever) == ("keep me", 90)
```

- [ ] **Step 2: Run migration and integration tests and verify they fail**

Run: `rtk pytest tests/test_migration_graph.py tests/integration/backend/test_profile_dashboard_psn_api.py -q`

Expected: FAIL because the model columns and token evidence do not exist.

- [ ] **Step 3: Add the backward-compatible migration and model columns**

Create revision `e4f6a8c0b2d1` with `down_revision = "d0e1f2a3b4c5"`:

```python
def upgrade() -> None:
    op.add_column("games", sa.Column("psn_search_aliases", sa.JSON(), nullable=True))
    op.add_column("games", sa.Column("psn_source_platforms", sa.JSON(), nullable=True))
    op.add_column("games", sa.Column("catalog_lookup_version", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("games", "catalog_lookup_version")
    op.drop_column("games", "psn_source_platforms")
    op.drop_column("games", "psn_search_aliases")
```

Mirror those nullable types in `Game` and do not backfill linked/quarantined rows.

- [ ] **Step 4: Carry evidence in signed tokens and merge it during confirm**

Build token evidence from `PsnExportCandidate`, cap aliases at eight and platforms at eight, and validate each decoded value with existing title length limits. Legacy tokens without arrays return empty tuples. During confirm, write evidence for both raw and catalog selections; for duplicate/re-import paths, merge stable deduplicated evidence rather than replace it. Raw rows keep `catalog_lookup_state = None` and `catalog_lookup_version = None`; manually catalog-linked rows set `catalog_lookup_version = PSN_CATALOG_MATCHER_VERSION`.

```python
evidence = PsnCatalogEvidence(
    title=candidate.title,
    aliases=safe_psn_search_aliases(candidate),
    platforms=tuple(dict.fromkeys(normalize_psn_platform(value) for value in candidate.platforms if value)),
)
payload = {
    "sub": str(user_id),
    "title": evidence.title,
    "aliases": list(evidence.aliases),
    "platforms": list(evidence.platforms),
    "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
}
```

- [ ] **Step 5: Run migration and integration tests**

Run: `rtk pytest tests/test_migration_graph.py tests/integration/backend/test_profile_dashboard_psn_api.py -q`

Expected: PASS.

- [ ] **Step 6: Commit persistence**

```bash
rtk git add app/database.py app/main.py alembic/versions/e4f6a8c0b2d1_add_psn_catalog_matcher_evidence.py tests/test_migration_graph.py tests/integration/backend/test_profile_dashboard_psn_api.py
rtk git commit -m "feat: persist PSN catalog matching evidence"
```

### Task 5: Version-aware enrichment and import/catalog separation

**Files:**
- Modify: `app/main.py`
- Modify: `app/schemas.py`
- Modify: `tests/integration/backend/test_profile_dashboard_psn_api.py`
- Modify: `tests/test_api_contracts.py`

**Interfaces:**
- Consumes: `resolve_psn_catalog_evidence` and `PSN_CATALOG_MATCHER_VERSION`.
- Adds `LibraryGameRead.catalog_search_query: str | None`.
- Keeps `POST /psn/library-repair/enrich` response shape unchanged.
- Keeps `POST /psn/import/confirm` compatible with `catalog` and `raw` actions.

- [ ] **Step 1: Write failing endpoint tests**

Cover all versioning and import behavior:

```python
def test_existing_review_and_no_match_rows_are_pending_for_matcher_v2(
    api_client, db_session, user_factory, auth_as
):
    user = auth_as(user_factory(email="matcher-v2-pending@example.com"))
    db_session.add_all([
        Game(owner_id=user.id, source="psn", title="One", external_id="psn:manual:one", link_state="raw", catalog_lookup_state="review", catalog_lookup_version=1),
        Game(owner_id=user.id, source="psn", title="Two", external_id="psn:manual:two", link_state="raw", catalog_lookup_state="no_match", catalog_lookup_version=None),
        Game(owner_id=user.id, source="psn", title="Linked", external_id="psn:3", link_state="linked", catalog_game_id=3, catalog_lookup_version=1),
        Game(owner_id=user.id, source="psn", title="Hidden", external_id="psn:manual:hidden", link_state="quarantined", catalog_lookup_version=1),
        Game(owner_id=user.id, source="psn", title="Keep raw", external_id="psn:manual:kept", link_state="raw", catalog_lookup_state="skipped", catalog_lookup_version=None),
    ])
    db_session.commit()
    assert api_client.get("/library/overview").json()["pending_catalog_count"] == 2


def test_enrichment_uses_stored_alias_and_platform(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    user = auth_as(user_factory(email="matcher-v2-alias@example.com"))
    game = Game(
        owner_id=user.id,
        source="psn",
        external_id="psn:manual:fifa",
        title="EA SPORTS™ FIFA 16",
        link_state="raw",
        psn_search_aliases=["FIFA 16"],
        psn_source_platforms=["PS4"],
    )
    db_session.add(game)
    db_session.commit()
    monkeypatch.setattr(app_main, "resolve_psn_catalog_evidence", AsyncMock(return_value={
        str(game.id): PsnCatalogDecision(
            "linked",
            {"id": 2, "name": "FIFA 16", "platforms": ["PlayStation 4"], "game_type": 0},
            "safe_winner",
            "safe_alias",
            150,
        ),
    }))
    response = api_client.post("/psn/library-repair/enrich")
    assert response.status_code == 200
    db_session.refresh(game)
    assert game.catalog_game_id == 2
    assert game.catalog_lookup_version == PSN_CATALOG_MATCHER_VERSION


def test_provider_failure_does_not_advance_matcher_version(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    user = auth_as(user_factory(email="matcher-v2-failure@example.com"))
    game = Game(owner_id=user.id, source="psn", external_id="psn:manual:retry", title="Retry", link_state="raw")
    db_session.add(game)
    db_session.commit()
    monkeypatch.setattr(app_main, "resolve_psn_catalog_evidence", AsyncMock(side_effect=PsnCatalogUnavailable))
    response = api_client.post("/psn/library-repair/enrich")
    assert response.status_code == 502
    db_session.refresh(game)
    assert game.catalog_lookup_version is None


def test_preview_is_independent_of_catalog_provider(
    api_client, user_factory, auth_as, app_main, monkeypatch
):
    auth_as(user_factory(email="matcher-v2-preview@example.com"))
    batch = AsyncMock(side_effect=AssertionError("preview must not call IGDB"))
    single = AsyncMock(side_effect=AssertionError("preview must not call IGDB"))
    monkeypatch.setattr(app_main, "fetch_igdb_games_batch", batch)
    monkeypatch.setattr(app_main, "fetch_igdb_games", single)
    response = api_client.post("/psn/import/preview", files={
        "file": ("export.xlsx", _xlsx_bytes(rows=[["Game Title"], ["Example Game"]])),
    })
    assert response.status_code == 200
    assert response.json()["items"][0]["status"] == "ready"
    assert response.json()["items"][0]["recommended_action"] == "raw"
    batch.assert_not_awaited()
    single.assert_not_awaited()


def test_unresolved_success_records_matcher_version(
    api_client, db_session, user_factory, auth_as, app_main, monkeypatch
):
    user = auth_as(user_factory(email="matcher-v2-review@example.com"))
    game = Game(owner_id=user.id, source="psn", external_id="psn:manual:review", title="Review", link_state="raw")
    db_session.add(game)
    db_session.commit()
    monkeypatch.setattr(app_main, "resolve_psn_catalog_evidence", AsyncMock(return_value={
        str(game.id): PsnCatalogDecision("review", reason="ambiguous_top_candidates"),
    }))
    assert api_client.post("/psn/library-repair/enrich").status_code == 200
    db_session.refresh(game)
    assert game.catalog_lookup_state == "review"
    assert game.catalog_lookup_version == PSN_CATALOG_MATCHER_VERSION
```

The library contract fixture must additionally assert a cleaned `catalog_search_query` for raw PSN rows and `None` for linked PSN, Steam, and manual rows.

- [ ] **Step 2: Run endpoint and contract tests and verify they fail**

Run: `rtk pytest tests/integration/backend/test_profile_dashboard_psn_api.py tests/test_api_contracts.py -q`

Expected: FAIL on pending version semantics, preview independence, and missing cleaned query.

- [ ] **Step 3: Make preview classification-only**

Remove provider resolution from `_psn_preview_items`. Add `ready` to the Pydantic `PsnImportPreviewItem.status` literal. Eligible items use `status="ready"`; `needs_review` items retain that status; both use `recommended_action="raw"`. Explicit non-games remain `recommended_action="skip"`. Keep schema compatibility for existing catalog selections, but perform all automatic catalog linking after confirm through library enrichment.

```python
if classification.kind == "suggested_skip":
    status, action = "suggested_skip", "skip"
elif classification.kind == "needs_review":
    status, action = "needs_mapping", "raw"
else:
    status, action = "ready", "raw"
```

Update the preview message to explain that selected games are added first and catalog artwork/details are matched in the library.

- [ ] **Step 4: Implement version-aware pending selection and Matcher V2 enrichment**

Pending means raw PSN and `(catalog_lookup_version IS NULL OR catalog_lookup_version < 2)`, independent of old `review/no_match` state:

```python
def _pending_psn_catalog_query(db, owner_id):
    return db.query(Game).filter(
        Game.owner_id == owner_id,
        Game.source == "psn",
        or_(Game.link_state.is_(None), Game.link_state.notin_({"linked", "quarantined"})),
        or_(Game.catalog_lookup_state.is_(None), Game.catalog_lookup_state != "skipped"),
        or_(Game.catalog_lookup_version.is_(None), Game.catalog_lookup_version < PSN_CATALOG_MATCHER_VERSION),
    )
```

Convert each batch row to `PsnCatalogEvidence`, keyed by `str(game.id)`, call the service once, and map decisions: safe winner uses `_link_psn_game_to_catalog`; unresolved rows set `review/no_match`; every successfully decided unresolved row stores version `2`. `PsnCatalogUnavailable` becomes HTTP 502 before commit. Quarantine remains first and does not depend on catalog results.

- [ ] **Step 5: Expose the preferred manual query and update API contracts**

Add `catalog_search_query` to `LibraryGameRead` and derive it server-side only for raw PSN rows:

```python
catalog_search_query=(
    preferred_psn_catalog_query(PsnCatalogEvidence(
        game.title,
        tuple(game.psn_search_aliases or ()),
        tuple(game.psn_source_platforms or ()),
    ))
    if source == "psn" and game.link_state == "raw"
    else None
)
```

Compute `pending_catalog_count` with the same version predicate as the enrichment query so the frontend loop terminates. Update exact API contract fixtures with `catalog_search_query`.

- [ ] **Step 6: Run backend endpoint and contract tests**

Run: `rtk pytest tests/integration/backend/test_profile_dashboard_psn_api.py tests/test_api_contracts.py -q`

Expected: PASS.

- [ ] **Step 7: Commit endpoint integration**

```bash
rtk git add app/main.py app/schemas.py tests/integration/backend/test_profile_dashboard_psn_api.py tests/test_api_contracts.py
rtk git commit -m "feat: run versioned PSN catalog enrichment"
```

### Task 6: Cleaned inline manual search and retry UX

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/routes/library.tsx`
- Modify: `web/src/routes/-library.test.tsx`

**Interfaces:**
- Consumes: optional `LibraryOverviewGame.catalog_search_query`.
- Preserves: editable catalog query, five-result limit, manual `link` action, sequential enrichment, and retry button.

- [ ] **Step 1: Write failing frontend tests**

Extend the raw PSN fixture with a noisy title and a cleaned query, then verify the picker initializes from the backend field while still showing the original title. Add a stale-row test where `pending_catalog_count > 0` although `catalog_lookup_state="review"`:

```tsx
it("starts manual catalog search from the cleaned backend query", async () => {
  api.getLibraryOverview.mockResolvedValue({
    games: [{
      id: "raw", source: "psn", title: "EA SPORTS™ FIFA 16", link_state: "raw",
      catalog_lookup_state: "review", catalog_search_query: "FIFA 16",
      detail_game_id: null, catalog_game_id: null, external_id: "psn:manual:fifa", cover_url: null,
    }],
    steam_available: false, steam_error: null, raw_count: 1, quarantined_count: 0,
    pending_catalog_count: 0,
  });
  renderLibrary();
  fireEvent.click(await screen.findByRole("button", { name: "Find in catalog" }));
  expect(screen.getByLabelText("Catalog search for EA SPORTS™ FIFA 16")).toHaveValue("FIFA 16");
});

it("reprocesses a stale review row when backend marks it pending", async () => {
  api.getLibraryOverview.mockResolvedValue({
    games: [{
      id: "stale", source: "psn", title: "Example", link_state: "raw",
      catalog_lookup_state: "review", catalog_search_query: "Example",
      detail_game_id: null, catalog_game_id: null, external_id: "psn:manual:example", cover_url: null,
    }],
    steam_available: false, steam_error: null, raw_count: 1, quarantined_count: 0,
    pending_catalog_count: 1,
  });
  api.enrichPsnLibrary.mockResolvedValue({ attempted: 1, linked: 0, review: 1, quarantined: 0, remaining: 0 });
  renderLibrary();
  await waitFor(() => expect(api.enrichPsnLibrary).toHaveBeenCalledTimes(1));
});
```

- [ ] **Step 2: Run the route test and verify it fails**

Run: `rtk npm test -- --run src/routes/-library.test.tsx` from `web/`.

Expected: FAIL because `catalog_search_query` is not typed or used.

- [ ] **Step 3: Type and use the cleaned query**

Add `"ready"` to the TypeScript `PsnImportPreviewItem.status` union, add the optional field to `LibraryOverviewGame`, and initialize picker state from it:

```tsx
catalog_search_query?: string | null;

const initialQuery = game.catalog_search_query?.trim() || game.title;
const [query, setQuery] = useState(() => initialQuery);
```

Key `PsnCatalogPicker` by ``${game.id}:${game.catalog_search_query ?? ""}`` in `LibraryCard` so a refreshed backend query resets the input without a state-setting effect. Keep the visible label based on `game.title`, leave the input editable, and preserve existing error/no-results/link states. Do not add client-side normalization rules.

- [ ] **Step 4: Run frontend tests, lint, and build**

Run from `web/`:

```bash
rtk npm test -- --run src/routes/-library.test.tsx
rtk npm run lint
rtk npm run build
```

Expected: route tests PASS, lint exits 0, and Vite build succeeds.

- [ ] **Step 5: Commit frontend integration**

```bash
rtk git add web/src/lib/api.ts web/src/routes/library.tsx web/src/routes/-library.test.tsx
rtk git commit -m "feat: seed PSN manual search with cleaned titles"
```

### Task 7: Regression verification and delivery

**Files:**
- Modify only if a verification failure exposes an in-scope defect.

**Interfaces:**
- Verifies all earlier tasks together; introduces no new behavior.

- [ ] **Step 1: Run focused PSN backend coverage**

Run:

```bash
rtk pytest tests/test_psn_catalog_matcher.py tests/test_psn_catalog_service.py tests/test_psn_resolution.py tests/test_psn_export.py tests/integration/backend/test_profile_dashboard_psn_api.py tests/test_api_contracts.py tests/test_migration_graph.py -q
```

Expected: PASS with no skipped newly added matcher tests.

- [ ] **Step 2: Run the full backend suite**

Run: `rtk pytest tests -q`

Expected: PASS. If an unrelated environment-dependent test fails, capture the exact failing test and prove the focused PSN suite remains green; do not weaken assertions.

- [ ] **Step 3: Run the full frontend quality gate**

Run from `web/`:

```bash
rtk npm test
rtk npm run lint
rtk npm run build
```

Expected: all Vitest suites pass, ESLint exits 0, and production build succeeds.

- [ ] **Step 4: Verify migration and diff hygiene**

Run:

```bash
rtk python -m alembic heads
rtk git diff --check origin/main...HEAD
rtk git status --short
```

Expected: one Alembic head (`e4f6a8c0b2d1`), no whitespace errors, and no uncommitted files.

- [ ] **Step 5: Request code review and fix only verified findings**

Use the `requesting-code-review` skill against `origin/main...HEAD`. Review must explicitly check: no title-specific game rules, no fuzzy auto-link, score/margin safety, provider rollback, version-aware retries, source evidence limits, owner scoping, Steam regression, and frontend loop termination.

- [ ] **Step 6: Push and open the required PR**

```bash
rtk git push -u origin codex/psn-catalog-matcher-v2
rtk gh pr create --base main --head codex/psn-catalog-matcher-v2 --title "Fix automatic PSN catalog matching" --body "Implements deterministic cleaned-title matching, PlayStation-aware disambiguation, persisted PSN evidence, versioned reprocessing, and cleaned manual-search fallback."
```

Expected: branch push succeeds and GitHub returns the new pull-request URL. Do not merge until the user explicitly requests it.

## Post-deploy verification

No new import is required for an existing library. After the migration and application deploy:

1. Open **Library** once; stale raw PSN rows automatically enter bounded Matcher V2 enrichment.
2. Confirm the matching banner completes rather than looping or returning 502.
3. Confirm ordinary cleaned-title games receive cover art and catalog links.
4. Confirm unresolved rows remain visible with **Find in catalog**, whose input starts from a cleaned query.
5. Confirm quarantined non-games remain hidden and linked/Steam rows do not change.
6. Check aggregate matcher logs for version `2`, linked/review/no-match counts, and provider failures; logs must not contain imported titles or authorization values.
