from fastapi import FastAPI, Depends, HTTPException
import uuid

from app.schemas import GameCreate, GameRead, GameUpdate
from store import get_store

app = FastAPI()
@app.get("/health")
def health():
    return {"status": "ok"}
@app.get("/games", response_model=list[GameRead])
def games(store = Depends(get_store)):
    return list(store.values())

@app.post("/games", status_code=201, response_model=GameRead)
def create_game(game: GameCreate, store = Depends(get_store)):
    game_id = str(uuid.uuid4())
    existing_game = game.model_dump()
    existing_game["id"] = game_id
    store[game_id] = existing_game
    return existing_game

@app.patch("/games/{id}", response_model=GameRead)
def update_game(id: str, game: GameUpdate, store = Depends(get_store)):
    if id not in store:
        raise HTTPException(status_code=404, detail="Game not found")
    game_data = store[id]
    update_data = game.model_dump(exclude_unset=True)
    game_data.update(update_data)
    return game_data

@app.get("/games/{id}", response_model=GameRead)
def get_game(id: str, store = Depends(get_store)):
    if id not in store:
        raise HTTPException(status_code=404, detail="Game not found")
    return store[id]

@app.delete("/games/{id}", status_code=204)
def delete_game(id: str, store = Depends(get_store)):
    if id not in store:
        raise HTTPException(status_code=404, detail="Game not found")
    del store[id]