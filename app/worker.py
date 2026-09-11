"""ARQ worker for user-initiated work that must not block web workers."""

import asyncio
import os
import uuid
from datetime import datetime, timezone

from arq import Retry
from arq.connections import RedisSettings
from fastapi.encoders import jsonable_encoder

from app.database import BackgroundJob, Game, SessionLocal, User
from app.openai_client import get_recommendation
from app.psn_export import normalize_title, psn_external_id
from app.steam import fetch_owned_games
from app.telegram import send_telegram_message


class BackgroundJobOperationError(RuntimeError):
    """An operation name or validated payload cannot be executed."""


def redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(os.getenv("REDIS_URL", "redis://redis:6379/0"))


def steam_account_payload(user: User) -> dict:
    return {"linked": bool(user.steam_id), "steam_id": user.steam_id,
            "persona_name": user.steam_persona_name, "avatar": user.steam_avatar,
            "country_code": user.steam_country_code, "linked_at": user.steam_linked_at}


def job_owner(db, job: BackgroundJob) -> User:
    owner = db.get(User, job.owner_id)
    if not owner:
        raise BackgroundJobOperationError("The account for this background job no longer exists")
    return owner


def import_psn_games(db, owner_id: uuid.UUID, games: list[str]) -> dict:
    unique_games: dict[str, str] = {}
    for candidate in games:
        title = normalize_title(candidate)
        if title:
            unique_games.setdefault(title.casefold(), title)
    if not unique_games:
        raise BackgroundJobOperationError("The import no longer contains valid games")
    existing = {game.external_id: game for game in db.query(Game).filter(
        Game.owner_id == owner_id, Game.source == "psn").all()}
    now = datetime.now(timezone.utc)
    created = updated = skipped = 0
    for title in unique_games.values():
        external_id = psn_external_id(title)
        imported = existing.get(external_id)
        if imported is None:
            db.add(Game(owner_id=owner_id, source="psn", external_id=external_id, title=title,
                        info="Imported from your PlayStation data export", synced_at=now))
            created += 1
        elif imported.title != title:
            imported.title, imported.synced_at = title, now
            updated += 1
        else:
            skipped += 1
    db.commit()
    return {"created": created, "updated": updated, "skipped": skipped, "total": len(unique_games)}


def steam_recommendation_prompt(games: list[dict], extra_prompt: str) -> str:
    top_games = games[:10]
    if not top_games:
        raise BackgroundJobOperationError("Steam library has no playable history yet")
    request = extra_prompt.strip() or "Recommend games I am likely to enjoy next based on my most played Steam games."
    game_lines = [
        f"{index}. {game.get('name')} - {round(int(game.get('playtime_forever') or 0) / 60, 1)} hours played"
        for index, game in enumerate(top_games, start=1)
    ]
    return "\n".join([request, "", "My most played Steam games:", *game_lines, "",
                      "Use the playtime as the strongest preference signal.",
                      "Avoid recommending games that are already in this Steam list."])


async def execute_background_operation(db, job: BackgroundJob) -> dict:
    """Execute only validated, credential-free data stored on a durable job."""
    if job.operation == "recommendations":
        return await asyncio.to_thread(get_recommendation, job.payload["prompt"], job.payload.get("liked_game_ids", []))
    if job.operation == "telegram_test_alert":
        owner = job_owner(db, job)
        if not owner.telegram_chat_id:
            raise BackgroundJobOperationError("Connect Telegram before sending a test alert")
        sent = await asyncio.to_thread(send_telegram_message, owner.telegram_chat_id,
            "Game Finder alerts are connected. Future favorites can use this chat for price and release updates.")
        if not sent:
            raise RuntimeError("Telegram did not accept the message")
        return {"status": "sent"}
    if job.operation == "psn_import":
        return import_psn_games(db, job.owner_id, job.payload["games"])

    if job.operation not in {"steam_library_sync", "steam_recommendations"}:
        raise BackgroundJobOperationError("Unsupported background operation")
    owner = job_owner(db, job)
    if not owner.steam_id:
        raise BackgroundJobOperationError("Connect Steam before starting this action")
    if job.operation == "steam_library_sync":
        games = await fetch_owned_games(owner.steam_id)
        imported = db.query(Game).filter(Game.owner_id == owner.id, Game.source == "steam").all()
        for game in imported:
            db.delete(game)
        db.commit()
        return {"steam": steam_account_payload(owner), "games": games, "created": 0,
                "updated": 0, "removed": len(imported), "synced_at": datetime.now(timezone.utc)}
    if job.operation == "steam_recommendations":
        games = await fetch_owned_games(owner.steam_id)
        prompt = steam_recommendation_prompt(games, job.payload["prompt"])
        liked_app_ids = [int(game["appid"]) for game in games[:10] if game.get("appid") is not None]
        return await asyncio.to_thread(get_recommendation, prompt, liked_app_ids)
    raise BackgroundJobOperationError("Unsupported background operation")


def mark_job_failed(db, job: BackgroundJob) -> None:
    job.status, job.error = "failed", "The background action could not be completed. Please retry."
    db.commit()


async def run_background_job(ctx: dict, job_id: str) -> None:
    """Claim one durable job and write a safe terminal result for browser polling."""
    db = SessionLocal()
    job = None
    try:
        parsed_job_id = uuid.UUID(job_id)
        claimed = db.query(BackgroundJob).filter(
            BackgroundJob.id == parsed_job_id, BackgroundJob.status == "queued"
        ).update({"status": "running", "updated_at": datetime.now(timezone.utc)}, synchronize_session=False)
        db.commit()
        if not claimed:
            return
        job = db.get(BackgroundJob, parsed_job_id)
        job.result = jsonable_encoder(await execute_background_operation(db, job))
        job.status, job.error = "succeeded", None
        db.commit()
    except BackgroundJobOperationError:
        if job:
            mark_job_failed(db, job)
    except Exception:
        if job:
            if ctx.get("job_try", 1) < 3:
                job.status = "queued"
                db.commit()
                raise Retry(defer=ctx.get("job_try", 1) * 2)
            mark_job_failed(db, job)
    finally:
        db.close()


class WorkerSettings:
    functions = [run_background_job]
    redis_settings = redis_settings()
    try:
        max_jobs = max(1, int(os.getenv("BACKGROUND_JOB_CONCURRENCY", "10")))
    except ValueError:
        max_jobs = 10
    max_tries = 3
