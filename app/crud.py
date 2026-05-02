import uuid
from app.database import Game


def list_games(db):
    return db.query(Game).all()


def create_game(db, data):
    game = Game(**data)
    db.add(game)
    db.commit()
    db.refresh(game)
    return game

def update_game(db, game_id: uuid.UUID, data):
    game = db.query(Game).filter(Game.id == game_id).first()
    if game is None:
        return None
    if "title" in data:
        game.title = data["title"]
    if "notes" in data:
        game.notes = data["notes"]
    db.commit()
    db.refresh(game)
    return game



def get_game(db, game_id: uuid.UUID):
    game = db.query(Game).filter(Game.id == game_id).first()
    if game is None:
        return None
    return game


def delete_game(db, game_id: uuid.UUID):
    game = db.query(Game).filter(Game.id == game_id).first()
    if game is None:
        return False
    db.delete(game)
    db.commit()
    return True