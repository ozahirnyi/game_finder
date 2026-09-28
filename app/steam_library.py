"""Persistence helpers for Steam-owned game snapshots."""

from datetime import datetime, timezone

from app.database import Game


def persist_steam_library_snapshot(db, owner_id, steam_games: list[dict]) -> dict[str, int]:
    now = datetime.now(timezone.utc)
    existing = (
        db.query(Game)
        .filter(Game.owner_id == owner_id, Game.source == "steam")
        .all()
    )
    by_appid = {str(game.external_id): game for game in existing if game.external_id}
    owned_by_appid: dict[str, dict] = {}
    for steam_game in steam_games:
        try:
            appid = str(int(steam_game.get("appid")))
        except (TypeError, ValueError):
            continue
        owned_by_appid.setdefault(appid, steam_game)

    created = 0
    updated = 0
    for appid, steam_game in owned_by_appid.items():
        game = by_appid.pop(appid, None)
        if game is None:
            game = Game(owner_id=owner_id, source="steam", external_id=appid)
            db.add(game)
            created += 1
        else:
            updated += 1
        game.title = str(steam_game.get("name") or f"Steam app {appid}")[:255]
        game.playtime_forever = max(0, int(steam_game.get("playtime_forever") or 0))
        game.playtime_2weeks = max(0, int(steam_game.get("playtime_2weeks") or 0))
        game.img_icon_url = steam_game.get("img_icon_url")
        game.synced_at = now

    for stale_game in by_appid.values():
        db.delete(stale_game)

    db.flush()
    return {"created": created, "updated": updated, "removed": len(by_appid)}
