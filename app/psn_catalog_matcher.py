"""Deterministic PSN purchase evidence normalization for catalog retrieval."""

from __future__ import annotations

from dataclasses import dataclass
import re
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
