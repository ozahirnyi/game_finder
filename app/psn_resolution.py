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
    transactions = candidate.transactions
    is_base_purchase = any(
        (row.transaction_type or "").casefold() == "product purchase"
        and normalize_psn_product_identity(row.product_name) == title
        for row in transactions
    )
    entitlement_only = bool(transactions) and all(
        _is_explicit_product_identity(normalize_psn_product_identity(row.product_name), title)
        for row in transactions
    )
    if entitlement_only and not is_base_purchase:
        return PsnClassification("needs_review", "Only related entitlement evidence was found.")
    return PsnClassification("eligible")


def _exact_matches(title: str, results: list[dict]) -> list[dict]:
    key = normalize_psn_product_identity(title)
    return [game for game in results if game.get("id") and normalize_psn_product_identity(str(game.get("name") or "")) == key]


async def resolve_psn_catalog_titles(titles: list[str], *, max_fallback_titles: int = 20, batch_fetcher=None, single_fetcher=None) -> dict[str, CatalogResolution]:
    """Resolve titles with bounded per-title recovery when a batch is incomplete."""
    unique = list(dict.fromkeys(title for title in titles if title))
    batch_fetcher = batch_fetcher or fetch_igdb_games_batch
    single_fetcher = single_fetcher or fetch_igdb_games
    catalog: dict[str, list[dict] | None] = {}
    for index in range(0, len(unique), 10):
        batch_titles = unique[index:index + 10]
        try:
            batch = await batch_fetcher(batch_titles)
        except (IGDBError, TypeError, ValueError):
            batch = {}
        if isinstance(batch, dict):
            catalog.update(batch)
    unresolved = [title for title in unique if not isinstance(catalog.get(title), list)]
    for title in unresolved[:max_fallback_titles]:
        try:
            catalog[title] = (await single_fetcher(title))["results"]
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
