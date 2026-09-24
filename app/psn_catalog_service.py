"""Bounded, atomic catalog matching for PSN import evidence."""

from __future__ import annotations

from collections import Counter
import logging
from typing import Mapping

from app.psn_catalog_matcher import (
    PSN_CATALOG_MATCHER_VERSION,
    PsnCatalogDecision,
    PsnCatalogEvidence,
    build_psn_query_variants,
    choose_psn_catalog_match,
)
from app.psn_resolution import resolve_psn_catalog_titles
from app.integrations.igdb import IGDBError, fetch_igdb_games_batch, fetch_igdb_localized_games


logger = logging.getLogger(__name__)


class PsnCatalogUnavailable(RuntimeError):
    """Raised when provider evidence is incomplete for a logical import batch."""


async def resolve_psn_catalog_evidence(
    items: Mapping[str, PsnCatalogEvidence], *, batch_fetcher=None, single_fetcher=None,
    localization_fetcher=None,
) -> dict[str, PsnCatalogDecision]:
    """Resolve all row evidence together, without partially applying provider results."""
    variants = {
        key: build_psn_query_variants(evidence)
        for key, evidence in items.items()
    }
    queries = list(dict.fromkeys(
        query for values in variants.values() for query in values
    ))
    resolutions = await resolve_psn_catalog_titles(
        queries,
        max_fallback_titles=len(queries),
        batch_fetcher=batch_fetcher,
        single_fetcher=single_fetcher,
    )
    if any(
        resolutions.get(query) is None or resolutions[query].kind == "unavailable"
        for query in queries
    ):
        logger.warning(
            "PSN matcher provider unavailable matcher_version=%s query_count=%s",
            PSN_CATALOG_MATCHER_VERSION,
            len(queries),
        )
        raise PsnCatalogUnavailable

    decisions = {
        key: choose_psn_catalog_match(
            evidence,
            {query: resolutions[query].results for query in variants[key]},
        )
        for key, evidence in items.items()
    }
    unresolved = {
        key: evidence for key, evidence in items.items()
        if decisions[key].state != "linked"
    }
    if unresolved:
        try:
            localizations = await (localization_fetcher or fetch_igdb_localized_games)(
                [evidence.title for evidence in unresolved.values()]
            )
        except (IGDBError, TypeError, ValueError):
            logger.warning("PSN localized catalog lookup unavailable row_count=%s", len(unresolved))
            localizations = {}
        for key, evidence in unresolved.items():
            localized = localizations.get(evidence.title, [])
            if localized:
                decisions[key] = choose_psn_catalog_match(
                    evidence,
                    {evidence.title: localized},
                )
    log_matcher_summary(decisions, query_count=len(queries))
    return decisions


async def find_psn_catalog_titles(
    title: str, *, batch_fetcher=None, localization_fetcher=None
) -> list[str]:
    """Return bounded canonical provider titles for a manual PSN catalog search."""
    direct = await (batch_fetcher or fetch_igdb_games_batch)([title])
    localized = await (localization_fetcher or fetch_igdb_localized_games)([title])
    candidates = [*(direct.get(title, []) if isinstance(direct, dict) else []), *localized.get(title, [])]
    return list(dict.fromkeys(
        game["name"] for game in candidates
        if isinstance(game, dict) and isinstance(game.get("name"), str) and game["name"].strip()
    ))[:3]


def log_matcher_summary(
    decisions: Mapping[str, PsnCatalogDecision], *, query_count: int
) -> None:
    """Record aggregate matcher telemetry without identifying imported content."""
    states = Counter(decision.state for decision in decisions.values())
    reasons = Counter(decision.reason for decision in decisions.values())
    logger.info(
        "PSN matcher completed matcher_version=%s row_count=%s query_count=%s "
        "linked=%s review=%s no_match=%s reasons=%s",
        PSN_CATALOG_MATCHER_VERSION,
        len(decisions),
        query_count,
        states["linked"],
        states["review"],
        states["no_match"],
        dict(sorted(reasons.items())),
    )
