import uuid

from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from app.auth import hash_password, verify_password, create_access_token, get_current_user
from app.database import get_db, User
from app.schemas import GameCreate, GameRead, GameUpdate, UserCreate, UserRead
from app.crud import list_games, update_game, create_game, get_game, delete_game, get_user_by_email, create_user


app = FastAPI()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/games", response_model=list[GameRead])
def list_game_route(db: Session = Depends(get_db),current_user = Depends(get_current_user)):
    return list_games(db, current_user.id)


@app.post("/games", status_code=201, response_model=GameRead)
def create_game_route(game: GameCreate,db: Session = Depends(get_db),current_user = Depends(get_current_user)):
    return create_game(db, game.model_dump(), current_user.id)


@app.patch("/games/{id}", response_model=GameRead)
def update_game_route(id: uuid.UUID,game: GameUpdate,db: Session = Depends(get_db),current_user = Depends(get_current_user)):
    updated = update_game(db, id, game.model_dump(exclude_unset=True), current_user.id)
    if updated is None:
        raise HTTPException(status_code=404, detail="Game not found")
    return updated

@app.get("/games/{id}", response_model=GameRead)
def get_game_route(id: uuid.UUID,db: Session = Depends(get_db),current_user = Depends(get_current_user)):
    game = get_game(db, id, current_user.id)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


@app.delete("/games/{id}", status_code=204)
def delete_game_route(id: uuid.UUID,db: Session = Depends(get_db),current_user = Depends(get_current_user)):
    ok = delete_game(db, id, current_user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Game not found")


@app.post("/auth/register", response_model=UserRead)
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing_user = get_user_by_email(db, user.email)
    if existing_user:
        raise HTTPException(status_code=409, detail="User already exists")
    hashed_password = hash_password(user.password)
    new_user = create_user(db, user.email, hashed_password)
    return new_user


@app.post("/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    email = form_data.username
    password = form_data.password
    db_user = get_user_by_email(db, email)
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(db_user.id)
    return {"access_token": token, "token_type": "bearer"}
