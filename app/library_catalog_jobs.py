"""Read-only catalog review snapshots and bounded, resumable worker deliveries."""

import uuid

from sqlalchemy import or_

from app.catalog_title_translation import translate_library_titles
from app.database import Game
from app.integrations.igdb import (
    fetch_igdb_games, fetch_igdb_localized_games, fetch_igdb_matching_games_batch,
)
from app.library_catalog_matching import preview_library_catalog_matches

MATCH_JOB_OPERATION = "library_catalog_matching"
MATCH_JOB_BATCH_SIZE = 10


def eligible_matching_games(db, owner_id, source=None, include_linked=False):
    query = db.query(Game).filter(
        Game.owner_id == owner_id,
        Game.source.in_(("psn", "manual")),
        or_(Game.link_state.is_(None), Game.link_state != "quarantined"),
    )
    if source:
        query = query.filter(Game.source == source)
    if not include_linked:
        query = query.filter(Game.catalog_game_id.is_(None))
    return query


def initial_matching_progress(payload):
    total = len(payload["game_ids"])
    return {"items": [], "total": total, "processed": 0, "matched": 0,
            "remaining": total, "include_linked": payload["include_linked"],
            "source": payload["source"]}


async def process_matching_job(db, job):
    """One delivery checks at most ten snapshot IDs, never links library entries."""
    payload = job.payload
    previous = job.result or initial_matching_progress(payload)
    start = previous["processed"]
    batch_ids = payload["game_ids"][start:start + MATCH_JOB_BATCH_SIZE]
    query = eligible_matching_games(db, job.owner_id, payload["source"], payload["include_linked"])
    rows = {str(row.id): row for row in query.filter(
        Game.id.in_([uuid.UUID(value) for value in batch_ids])
    ).all()} if batch_ids else {}
    games = [rows[value] for value in batch_ids if value in rows]
    items = await preview_library_catalog_matches(
        games, batch_fetcher=fetch_igdb_matching_games_batch,
        single_fetcher=fetch_igdb_games, localization_fetcher=fetch_igdb_localized_games,
        translation_fetcher=translate_library_titles,
    ) if games else []
    processed = start + len(batch_ids)
    return {**previous, "items": [*previous["items"], *items], "processed": processed,
            "remaining": len(payload["game_ids"]) - processed,
            "matched": previous["matched"] + sum(bool(item["suggestions"]) for item in items)}
