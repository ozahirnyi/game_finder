import uuid
import re
from app.database import Game, User


def list_games(db, current_user):
    return (
        db.query(Game)
        .filter(Game.owner_id == current_user)
        .order_by(Game.source.asc(), Game.created_at.desc(), Game.playtime_forever.desc().nullslast())
        .all()
    )


def create_game(db, data, current_user):
    game = Game(**data, source="manual", owner_id=current_user)
    db.add(game)
    db.commit()
    db.refresh(game)
    return game


def update_game(db, game_id: uuid.UUID, data, current_user):
    game = (db.query(Game).filter(Game.id == game_id,Game.owner_id == current_user).first())
    if game is None:
        return None
    if "title" in data:
        game.title = data["title"]
    if "notes" in data:
        game.notes = data["notes"]
    db.commit()
    db.refresh(game)
    return game


def get_game(db, game_id: uuid.UUID, current_user):
    game = (db.query(Game).filter(Game.id == game_id,Game.owner_id == current_user).first())
    return game


def delete_game(db, game_id: uuid.UUID, current_user):
    game = (db.query(Game).filter(Game.id == game_id,Game.owner_id == current_user).first())
    if game is None:
        return False
    db.delete(game)
    db.commit()
    return True


def get_user_by_email(db, email: str):
    return db.query(User).filter(User.email == email.strip().lower()).first()


def build_display_name(db, email: str) -> str:
    stem = email.split("@", 1)[0].strip().lower()
    stem = re.sub(r"[^a-z0-9_-]+", "-", stem).strip("-_") or "player"
    stem = stem[:48]
    candidate = stem
    suffix = 2
    while db.query(User.id).filter(User.display_name == candidate).first():
        candidate = f"{stem[:59]}-{suffix}"
        suffix += 1
    return candidate


def create_user(db, email: str, password_hash: str | None, **extra):
    normalized_email = email.strip().lower()
    user = User(
        email=normalized_email,
        password_hash=password_hash,
        display_name=extra.pop("display_name", None) or build_display_name(db, normalized_email),
        **extra,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
