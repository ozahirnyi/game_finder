"""Provider-aware identity checks for games in a user's library."""

import uuid

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.database import Game


def owned_library_games(
    db: Session,
    user_id: uuid.UUID,
    *,
    catalog_game_id: int | None = None,
    steam_appid: int | None = None,
) -> list[Game]:
    identities = []
    if steam_appid is not None:
        identities.append(and_(Game.source == "steam", Game.external_id == str(steam_appid)))
    if catalog_game_id is not None:
        identities.append(
            or_(
                and_(Game.source == "catalog", Game.external_id == f"igdb:{catalog_game_id}"),
                and_(
                    Game.source.in_(("manual", "psn")),
                    Game.catalog_game_id == catalog_game_id,
                    or_(Game.source != "psn", Game.link_state == "linked"),
                    or_(Game.link_state.is_(None), Game.link_state != "quarantined"),
                ),
            )
        )
    if not identities:
        return []
    return (
        db.query(Game)
        .filter(Game.owner_id == user_id, or_(*identities))
        .order_by(Game.created_at, Game.id)
        .all()
    )
