import uuid
from datetime import datetime, timezone

store: dict[str, dict] = {}

def get_store() -> dict[str, dict]:
    return store


def list_games(store: dict[str, dict]) -> list[dict]:
    return list(store.values())


def create_game(store: dict[str, dict], data: dict) -> dict:
    game = {**data, "id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc)}
    store[game["id"]] = game
    return game

def update_game(store: dict[str, dict], game_id: str, data: dict) -> dict | None:
    game = store.get(game_id)
    if not game:
        return None
    game.update(data)
    return game


def get_game(store: dict[str, dict], game_id: str) -> dict | None:
    return store.get(game_id)


def delete_game(store: dict[str, dict], game_id: str) -> bool:
    if game_id not in store:
        return False
    del store[game_id]
    return True
