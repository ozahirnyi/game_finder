"""Owner-scoped, atomic PSN catalog enrichment batches shared by API and workers."""

from __future__ import annotations

import uuid

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import Game
from app.psn_catalog_matcher import PSN_CATALOG_MATCHER_VERSION, PsnCatalogEvidence
from app.psn_catalog_service import PsnCatalogUnavailable, resolve_psn_catalog_evidence
from app.psn_classification import psn_repair_quarantine_reason
from app.psn_export import normalize_title
from app.schemas import PsnCatalogEnrichmentResult


PSN_CANDIDATE_EVIDENCE_LIMIT = 8
PSN_CATALOG_ENRICHMENT_BATCH_SIZE = 8


class PsnInvalidCatalogGame(ValueError):
    """The selected catalog detail cannot be linked to the requested ID."""


def _pending_psn_catalog_query(db: Session, owner_id: uuid.UUID):
    return db.query(Game).filter(
        Game.owner_id == owner_id,
        Game.source == "psn",
        or_(Game.link_state.is_(None), Game.link_state.notin_({"linked", "quarantined"})),
        or_(Game.catalog_lookup_state.is_(None), Game.catalog_lookup_state != "skipped"),
        or_(Game.catalog_lookup_version.is_(None), Game.catalog_lookup_version < PSN_CATALOG_MATCHER_VERSION),
    )


def _stable_psn_evidence_values(*sources: tuple[str, ...] | list[str] | None) -> tuple[str, ...]:
    values: list[str] = []
    seen: set[str] = set()
    for source in sources:
        for value in source or ():
            if isinstance(value, str) and value not in seen:
                seen.add(value)
                values.append(value)
    return tuple(values)


def _merge_psn_catalog_evidence(
    existing: PsnCatalogEvidence, incoming: PsnCatalogEvidence
) -> PsnCatalogEvidence:
    return PsnCatalogEvidence(
        incoming.title,
        aliases=_stable_psn_evidence_values(existing.aliases, incoming.aliases)[:PSN_CANDIDATE_EVIDENCE_LIMIT],
        platforms=_stable_psn_evidence_values(existing.platforms, incoming.platforms)[:PSN_CANDIDATE_EVIDENCE_LIMIT],
    )


def _psn_game_catalog_evidence(game: Game) -> PsnCatalogEvidence:
    return PsnCatalogEvidence(
        game.title,
        aliases=tuple(game.psn_search_aliases or ()),
        platforms=tuple(game.psn_source_platforms or ()),
    )


def _merge_game_psn_catalog_evidence(game: Game, incoming: PsnCatalogEvidence) -> bool:
    merged = _merge_psn_catalog_evidence(_psn_game_catalog_evidence(game), incoming)
    aliases = list(merged.aliases)
    platforms = list(merged.platforms)
    changed = game.psn_search_aliases != aliases or game.psn_source_platforms != platforms
    game.psn_search_aliases = aliases
    game.psn_source_platforms = platforms
    return changed


def _psn_linked_game_payload(detail: dict, catalog_id: int) -> tuple[str, str | None]:
    title = normalize_title(detail.get("name"))
    if not title or int(detail.get("id") or catalog_id) != catalog_id:
        raise PsnInvalidCatalogGame("Choose a valid catalog game")
    cover = detail.get("background_image")
    return title, cover if isinstance(cover, str) and cover.startswith(("http://", "https://")) else None


def _link_psn_game_to_catalog(db: Session, game: Game, catalog_id: int, detail: dict) -> None:
    title, cover = _psn_linked_game_payload(detail, catalog_id)
    duplicate = db.query(Game).filter(
        Game.owner_id == game.owner_id,
        Game.source == "psn",
        Game.catalog_game_id == catalog_id,
        Game.id != game.id,
    ).first()
    target = duplicate or game
    if duplicate:
        duplicate.created_at = min(duplicate.created_at, game.created_at)
        duplicate.notes = duplicate.notes or game.notes
        duplicate.info = duplicate.info or game.info
        duplicate.playtime_forever = max(
            duplicate.playtime_forever or 0,
            game.playtime_forever or 0,
        ) or None
        _merge_game_psn_catalog_evidence(duplicate, _psn_game_catalog_evidence(game))
        db.delete(game)
    target.catalog_game_id = catalog_id
    target.link_state = "linked"
    target.catalog_lookup_state = None
    target.catalog_lookup_version = PSN_CATALOG_MATCHER_VERSION
    target.title = title
    target.img_icon_url = cover or target.img_icon_url


async def enrich_pending_psn_catalog_batch(
    db: Session, owner_id: uuid.UUID, *, batch_fetcher, single_fetcher
) -> PsnCatalogEnrichmentResult:
    """Resolve and persist one ordered batch, leaving provider failures retryable."""
    try:
        games = (
            _pending_psn_catalog_query(db, owner_id)
            .order_by(Game.created_at, Game.id)
            .limit(PSN_CATALOG_ENRICHMENT_BATCH_SIZE)
            .all()
        )
        if not games:
            return PsnCatalogEnrichmentResult()

        quarantine = {game.id for game in games if psn_repair_quarantine_reason(game.title)}
        evidence = {
            str(game.id): _psn_game_catalog_evidence(game)
            for game in games
            if game.id not in quarantine
        }
        decisions = await resolve_psn_catalog_evidence(
            evidence, batch_fetcher=batch_fetcher, single_fetcher=single_fetcher
        )

        linked = review = quarantined = 0
        for game in games:
            if game.id in quarantine:
                game.link_state = "quarantined"
                quarantined += 1
                continue
            decision = decisions.get(str(game.id))
            if decision is None:
                raise PsnCatalogUnavailable
            if decision.state == "linked" and decision.match:
                _link_psn_game_to_catalog(db, game, int(decision.match["id"]), decision.match)
                linked += 1
                continue
            game.catalog_lookup_state = decision.state
            game.catalog_lookup_version = PSN_CATALOG_MATCHER_VERSION
            review += 1
        db.commit()
        remaining = _pending_psn_catalog_query(db, owner_id).count()
        return PsnCatalogEnrichmentResult(
            attempted=len(games), linked=linked, review=review,
            quarantined=quarantined, remaining=remaining,
        )
    except Exception:
        db.rollback()
        raise
