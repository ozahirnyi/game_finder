import uuid

from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import GameCreate, GameRead, GameUpdate
from app.crud import list_games, update_game, create_game, get_game, delete_game


app = FastAPI()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/games", response_model=list[GameRead])
def list_game_route(db: Session = Depends(get_db)):
    return list_games(db)


@app.post("/games", status_code=201, response_model=GameRead)
def create_game_route(game: GameCreate, db: Session = Depends(get_db)):
    return create_game(db, game.model_dump())


@app.patch("/games/{id}", response_model=GameRead)
def update_game_route(id: uuid.UUID, game: GameUpdate, db: Session = Depends(get_db)):
    updated = update_game(db, id, game.model_dump(exclude_unset=True))
    if updated is None:
        raise HTTPException(status_code=404, detail="Game not found")
    return updated


@app.get("/games/{id}", response_model=GameRead)
def get_game_route(id: uuid.UUID, db: Session = Depends(get_db)):
    game = get_game(db, id)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


@app.delete("/games/{id}", status_code=204)
def delete_game_route(id: uuid.UUID, db: Session = Depends(get_db)):
    ok = delete_game(db, id)
    if not ok:
        raise HTTPException(status_code=404, detail="Game not found")
    return
