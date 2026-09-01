"""Deterministic PSN purchase evidence normalization for catalog retrieval."""

from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Literal, Mapping, Sequence
import unicodedata

from app.psn_classification import (
    KNOWN_NON_GAME_PSN_PRODUCT_IDENTITIES,
    KNOWN_NON_GAME_PSN_STORE_CATEGORY_IDENTITIES,
    is_explicit_non_game_self_title,
    is_explicit_psn_non_game_product,
    normalize_psn_product_identity,
)
from app.psn_export import PsnExportCandidate


PSN_CATALOG_MATCHER_VERSION = 2
MAX_QUERY_VARIANTS_PER_ROW = 6
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
    "main_game": 0,
    "dlc_addon": 1,
    "expansion": 2,
    "bundle": 3,
    "standalone_expansion": 4,
    "mod": 5,
    "episode": 6,
    "season": 7,
    "remake": 8,
    "remaster": 9,
    "expanded_game": 10,
    "port": 11,
    "fork": 12,
    "pack": 13,
    "update": 14,
}
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


def normalize_psn_catalog_identity(value: str) -> str:
    value = value.translate(str.maketrans({"™": "", "®": "", "©": ""}))
    value = unicodedata.normalize("NFKC", value)
    value = re.sub(r"(?<=[^\W\d_])(?=\d)|(?<=\d)(?=[^\W\d_])", " ", value)
    return " ".join("".join(char if char.isalnum() else " " for char in value.casefold()).split())


def normalize_query_whitespace(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).split())


def normalize_query_punctuation(value: str) -> str:
    value = value.translate(str.maketrans({"™": "", "®": "", "©": ""}))
    value = normalize_query_whitespace(value)
    return re.sub(r"\s*[-\u2013\u2014]\s*", " - ", value).strip(" -")


def normalize_query_boundaries(value: str) -> str:
    return re.sub(r"(?<=[^\W\d_])(?=\d)|(?<=\d)(?=[^\W\d_])", " ", value)


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


def safe_psn_search_aliases(candidate: PsnExportCandidate) -> tuple[str, ...]:
    """Keep only explicit game-like PSN product aliases for catalog search."""
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


def build_psn_query_variants(evidence: PsnCatalogEvidence) -> tuple[str, ...]:
    """Build stable, provider-visible variants from titles and safe aliases."""
    variants: list[str] = []
    seen: set[str] = set()
    for value in (evidence.title, *evidence.aliases):
        cleaned = normalize_query_punctuation(value)
        base = strip_psn_platform_wrapper(cleaned)
        presentation_cleaned = strip_presentation_prefix(base)
        retrieval_cleaned = strip_retrieval_edition(presentation_cleaned)
        candidates = (
            normalize_query_whitespace(value),
            cleaned,
            base,
            presentation_cleaned,
            retrieval_cleaned,
            normalize_query_boundaries(retrieval_cleaned),
        )
        for candidate in candidates:
            query_key = normalize_query_whitespace(candidate).casefold()
            if not candidate or query_key in seen:
                continue
            seen.add(query_key)
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


def score_candidate(
    evidence: PsnCatalogEvidence, game: dict, queries: Sequence[str]
) -> ScoredCandidate:
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

    candidate_platforms = {
        normalize_psn_catalog_identity(str(value)) for value in game.get("platforms") or ()
    }
    playstation_platforms = {
        value for value in candidate_platforms if "playstation" in value
    }
    if candidate_platforms and not playstation_platforms:
        return ScoredCandidate(game, catalog_id, score, "non_playstation", True)

    platform_names = {
        "PS3": "PlayStation 3",
        "PS4": "PlayStation 4",
        "PS5": "PlayStation 5",
        "VITA": "PlayStation Vita",
    }
    expected = {
        normalize_psn_catalog_identity(platform_names[value])
        for raw in evidence.platforms
        if (value := normalize_psn_platform(raw))
    }
    if expected and playstation_platforms and not expected.intersection(playstation_platforms):
        return ScoredCandidate(game, catalog_id, score, "platform_conflict", True)
    if expected and expected.intersection(playstation_platforms):
        score += KNOWN_PLATFORM_SCORE
    elif playstation_platforms:
        score += UNKNOWN_SOURCE_PLAYSTATION_SCORE

    source_editions = frozenset().union(
        *(_edition_tokens(value) for value in (evidence.title, *evidence.aliases))
    )
    catalog_editions = _edition_tokens(candidate_name)
    if source_editions and catalog_editions and source_editions.isdisjoint(catalog_editions):
        return ScoredCandidate(game, catalog_id, score, "edition_conflict", True)

    if game_type == 0:
        score += MAIN_GAME_SCORE
    elif game_type in PLAYABLE_VARIANT_TYPES:
        score += PLAYABLE_VARIANT_SCORE
    return ScoredCandidate(game, catalog_id, score, identity_evidence)


def choose_psn_catalog_match(
    evidence: PsnCatalogEvidence, results_by_query: Mapping[str, Sequence[dict]]
) -> PsnCatalogDecision:
    candidates = deduplicate_candidates_by_id(results_by_query)
    scored = [score_candidate(evidence, game, tuple(results_by_query)) for game in candidates]
    accepted = sorted(
        (item for item in scored if not item.rejected),
        key=lambda item: (-item.score, item.catalog_id),
    )
    if not candidates:
        return PsnCatalogDecision("no_match", reason="no_candidates")
    if not accepted or accepted[0].score < MINIMUM_AUTO_LINK_SCORE:
        return PsnCatalogDecision("review", reason="no_safe_exact_match")
    if len(accepted) > 1 and accepted[0].score - accepted[1].score < MINIMUM_WIN_MARGIN:
        return PsnCatalogDecision("review", reason="ambiguous_top_candidates")
    winner = accepted[0]
    return PsnCatalogDecision(
        "linked", winner.game, "safe_winner", winner.evidence, winner.score
    )
