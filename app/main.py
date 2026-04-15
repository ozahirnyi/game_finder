from fastapi import FastAPI, Depends, HTTPException
from app.schemas import GameCreate, GameRead, GameUpdate
from app.store import (
    create_game as store_create_game,
    get_game as store_get_game,
    update_game as store_update_game,
    delete_game as store_delete_game,
    list_games,
)
from app.store import get_store

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/games", response_model=list[GameRead])
def games(store: dict[str, dict] = Depends(get_store)):
    return list_games(store)


@app.post("/games", status_code=201, response_model=GameRead)
def create_game(game: GameCreate, store: dict[str, dict] = Depends(get_store)):
    return store_create_game(store, game.model_dump())


@app.patch("/games/{id}", response_model=GameRead)
def update_game(id: str, game: GameUpdate, store: dict[str, dict] = Depends(get_store)):
    updated = store_update_game(store, id, game.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Game not found")
    return updated


@app.get("/games/{id}", response_model=GameRead)
def get_game(id: str, store: dict[str, dict] = Depends(get_store)):
    game = store_get_game(store, id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game

@app.delete("/games/{id}", status_code=204)
def delete_game(id: str, store: dict[str, dict] = Depends(get_store)):
    ok = store_delete_game(store, id)
    if not ok:
        raise HTTPException(status_code=404, detail="Game not found")
    return
