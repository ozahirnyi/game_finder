from fastapi import FastAPI, Depends, HTTPException
import uuid
from datetime import datetime
from app.schemas import GameCreate, GameRead, GameUpdate
from app.store import get_store
app = FastAPI()
@app.get("/health")
def health():
    return {"status": "ok"}
@app.get("/games", response_model=list[GameRead])
def games(store: dict = Depends(get_store)):
    return list(store.values())
@app.post("/games", status_code=201, response_model=GameRead)
def create_game(game: GameCreate, store = Depends(get_store)):
    game_id = str(uuid.uuid4())
    game_data = game.model_dump()
    game_data["id"] = game_id
    game_data["created_at"] = datetime.utcnow()
    store[game_id] = game_data
    return game_data
@app.patch("/games/{id}", response_model=GameRead)
def update_game(id: str, game: GameUpdate, store = Depends(get_store)):
    if id not in store:
        raise HTTPException(status_code=404, detail="Game not found")
    update_data = game.model_dump(exclude_unset=True, exclude={"id"})
    store[id].update(update_data)
    return store[id]
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