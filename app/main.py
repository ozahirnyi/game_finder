import asyncio
import os
import uuid
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.openai_client import get_recommendation
from app.cache import build_cache_key, get_json_cached
from app.integrations.rawg import fetch_rawg_game_detail, fetch_rawg_games, RAWGError
from app.auth import hash_password, verify_password, create_access_token, get_current_user
from app.database import get_db, User, Base, engine, wait_for_db, ensure_runtime_columns
from app.schemas import GameCreate, GameRead, GameUpdate, UserCreate, UserRead, RecommendationRequest, \
    RecommendationResponse, GameCatalogDetail, GameSearchResponse
from app.crud import list_games, update_game, create_game, get_game, delete_game, get_user_by_email, create_user


def get_allowed_origins() -> list[str]:
    origins = {"http://localhost:3000"}
    for env_name in ("FRONTEND_ORIGIN", "FRONTEND_ORIGINS"):
        raw = os.getenv(env_name, "")
        for origin in raw.split(","):
            origin = origin.strip().rstrip("/")
            if origin:
                origins.add(origin)
    return sorted(origins)


@asynccontextmanager
async def lifespan(app: FastAPI):
    wait_for_db(engine)
    Base.metadata.create_all(bind=engine)
    ensure_runtime_columns()
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
CACHE_TTL = 3600


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/games", response_model=list[GameRead])
def list_game_route(db: Session = Depends(get_db),current_user: User = Depends(get_current_user)):
    return list_games(db, current_user.id)


@app.post("/games", status_code=201, response_model=GameRead)
def create_game_route(game: GameCreate,db: Session = Depends(get_db),current_user: User = Depends(get_current_user)):
    return create_game(db, game.model_dump(), current_user.id)


@app.patch("/games/{id}", response_model=GameRead)
def update_game_route(id: uuid.UUID,game: GameUpdate,db: Session = Depends(get_db),current_user: User = Depends(get_current_user)):
    updated = update_game(db, id, game.model_dump(exclude_unset=True), current_user.id)
    if updated is None:
        raise HTTPException(status_code=404, detail="Game not found")
    return updated


@app.get("/games/{id}", response_model=GameRead)
def get_game_route(id: uuid.UUID,db: Session = Depends(get_db),current_user: User = Depends(get_current_user)):
    game = get_game(db, id, current_user.id)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


@app.delete("/games/{id}", status_code=204)
def delete_game_route(id: uuid.UUID,db: Session = Depends(get_db),current_user: User = Depends(get_current_user)):
    ok = delete_game(db, id, current_user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Game not found")


@app.post("/auth/register", response_model=UserRead)
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing_user = get_user_by_email(db, user.email)
    if existing_user:
        raise HTTPException(status_code=409, detail="User already exists")
    try:
        hashed_password = hash_password(user.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Password hashing failed")
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


@app.get("/search/games",response_model=GameSearchResponse)
@limiter.limit("30/minute")
async def search(request: Request, q: str, page: int = 1):
    q = q.strip().lower()
    if not q:
        raise HTTPException(status_code=400, detail="q cannot be empty")
    if page < 1:
        raise HTTPException(status_code=400, detail="page must be >= 1")
    key = build_cache_key("search", q=q, page=page)
    async def fetch():
        return await fetch_rawg_games(q, page=page)
    try:
        return await get_json_cached(key,CACHE_TTL,fetch)
    except RAWGError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail=str(e))


@app.get("/catalog/games/{rawg_id}", response_model=GameCatalogDetail)
async def catalog_game_detail(rawg_id: int):
    if rawg_id < 1:
        raise HTTPException(status_code=400, detail="rawg_id must be >= 1")
    key = build_cache_key("catalog_game", rawg_id=rawg_id)

    async def fetch():
        return await fetch_rawg_game_detail(rawg_id)

    try:
        return await get_json_cached(key, CACHE_TTL, fetch)
    except RAWGError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))


@app.post("/recommendations",response_model=RecommendationResponse)
@limiter.limit("5/minute")
async def recommendations(request: Request, data: RecommendationRequest):
    if not data.prompt.strip():
        raise HTTPException(status_code=400,detail="prompt cannot be empty")
    result = await asyncio.to_thread(
        get_recommendation,
        data.prompt,
        data.liked_game_ids,)
    return result


@app.exception_handler(RateLimitExceeded)
def rate_limit_handler(request: Request,exc: RateLimitExceeded):
    return JSONResponse(status_code=429,content={"detail": "Too many requests"})
