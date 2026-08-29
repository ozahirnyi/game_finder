"""Shared PSN transaction classification and catalog resolution."""

from dataclasses import dataclass
from typing import Awaitable, Callable

from app.integrations.igdb import IGDBError, fetch_igdb_games, fetch_igdb_games_batch
from app.psn_classification import (
    KNOWN_NON_GAME_PSN_PRODUCT_IDENTITIES,
    KNOWN_NON_GAME_PSN_STORE_CATEGORY_IDENTITIES,
    _is_explicit_product_identity,
    normalize_psn_product_identity,
)
from app.psn_export import PsnExportCandidate


@dataclass(frozen=True)
class PsnClassification:
    kind: str  # eligible, needs_review, suggested_skip
    reason: str | None = None


@dataclass(frozen=True)
class CatalogResolution:
    kind: str  # matched, ambiguous, no_match, unavailable
    results: list[dict]


def classify_psn_candidate(candidate: PsnExportCandidate) -> PsnClassification:
    """Classify self-title evidence without allowing related rows to veto it."""
    title = normalize_psn_product_identity(candidate.title)
    if title in KNOWN_NON_GAME_PSN_PRODUCT_IDENTITIES:
        return PsnClassification("suggested_skip", "Known PlayStation app, service, or system theme.")
    if title in KNOWN_NON_GAME_PSN_STORE_CATEGORY_IDENTITIES:
        return PsnClassification("suggested_skip", "Known PlayStation non-game storefront category.")
    products = [normalize_psn_product_identity(value) for value in candidate.product_names]
    is_base_purchase = any(
        transaction.casefold() == "product purchase" and product == title
        for transaction, product in zip(candidate.transaction_types, products)
    )
    entitlement_only = bool(products) and all(
        _is_explicit_product_identity(product, title) for product in products
    )
    if entitlement_only and not is_base_purchase:
        return PsnClassification("needs_review", "Only related entitlement evidence was found.")
    return PsnClassification("eligible")


def _exact_matches(title: str, results: list[dict]) -> list[dict]:
    key = normalize_psn_product_identity(title)
    return [game for game in results if game.get("id") and normalize_psn_product_identity(str(game.get("name") or "")) == key]


async def resolve_psn_catalog_titles(titles: list[str], *, max_fallback_titles: int = 20) -> dict[str, CatalogResolution]:
    """Resolve titles with bounded per-title recovery when a batch is incomplete."""
    unique = list(dict.fromkeys(title for title in titles if title))
    try:
        catalog = await fetch_igdb_games_batch(unique)
    except IGDBError:
        catalog = {}
    unresolved = [title for title in unique if not isinstance(catalog.get(title), list)]
    for title in unresolved[:max_fallback_titles]:
        try:
            catalog[title] = (await fetch_igdb_games(title))["results"]
        except (IGDBError, KeyError, TypeError):
            catalog[title] = None
    outcome: dict[str, CatalogResolution] = {}
    for title in unique:
        results = catalog.get(title)
        if not isinstance(results, list):
            outcome[title] = CatalogResolution("unavailable", [])
            continue
        exact = _exact_matches(title, results)
        outcome[title] = CatalogResolution(
            "matched" if len(exact) == 1 else "ambiguous" if len(exact) > 1 else "no_match",
            results,
        )
    return outcome
