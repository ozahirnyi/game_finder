import uuid
from datetime import datetime, timezone

store = {}

def get_store():
    return store


def list_games(store: dict) -> list[dict]:
    return list(store.values())


def create_game(store: dict, data: dict) -> dict:
    game_id = str(uuid.uuid4())
    data["id"] = game_id
    data["created_at"] = datetime.now(timezone.utc)
    store[game_id] = data
    return data


def update_game(store: dict, game_id: str, data: dict) -> dict | None:
    game = store.get(game_id)
    if not game:
        return None
    game.update(data)
    return game


def get_game(store: dict, game_id: str) -> dict | None:
    return store.get(game_id)


def delete_game(store: dict, game_id: str) -> bool:
    if game_id not in store:
        return False
    del store[game_id]
    return True
