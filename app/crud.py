import uuid
from app.database import Game, User


def list_games(db, current_user):
    games = db.query(Game).filter(Game.owner_id == current_user)
    return games.all()


def create_game(db, data, current_user):
    game = Game(**data, owner_id=current_user)
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
    return db.query(User).filter(User.email == email).first()


def create_user(db, email: str, password_hash: str):
    user = User(email=email, password_hash=password_hash)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user