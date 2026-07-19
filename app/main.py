import asyncio
import os
import uuid
import contextlib
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode
from sqlalchemy.orm import Session
from fastapi import FastAPI, Depends, HTTPException, Request, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.openai_client import get_recommendation
from app.cache import build_cache_key, get_json_cached
from app.integrations.rawg import (
    fetch_rawg_game_detail,
    fetch_rawg_games,
    fetch_rawg_trending_games,
    fetch_rawg_upcoming_games,
    RAWGError,
)
from app.prices import fetch_game_price_history
from app.psn_export import normalize_title, parse_psn_export, psn_external_id
from app.steam_store import fetch_steam_store_deals
from app.auth import hash_password, verify_password, create_access_token, get_current_user
from app.database import get_db, User, Game, OAuthIdentity, OAuthAuthorizationTransaction, FriendRequest, Friendship, Conversation, Message, GameInvite, Notification, Favorite, WishlistItem, PriceAlert, engine, wait_for_db
from app.schemas import GameCreate, GameRead, GameUpdate, UserCreate, UserRead, RecommendationRequest, PsnImportConfirmRequest, PsnImportPreview, PsnImportResult, \
    RecommendationResponse, GameCatalogDetail, GameSearchResponse, SteamAccountRead, SteamLibraryRead, SteamLibrarySyncRead, SteamLoginUrl, \
    SteamRecommendationRequest, GamePriceHistory, TelegramAccountRead, TelegramLinkRead, SteamSocialRead, \
    HomeDealResponse, GoogleStatusRead, OAuthLoginUrl, OAuthExchangeRequest, DataBlock, DashboardRead, ProfileSummaryRead, UserProfileRead, UserProfileUpdate, \
    PublicUserRead, FriendRequestCreate, FriendRequestRead, FriendshipRead, ConversationCreate, ConversationRead, MessageCreate, MessageRead, GameInviteCreate, GameInviteRead, InviteResponseUpdate, NotificationRead, InviteLinkRead, \
    CatalogCollectionCreate, CatalogCollectionUpdate, CatalogCollectionRead, PriceAlertCreate, PriceAlertUpdate, PriceAlertRead
from app.steam import (
    build_steam_login_url,
    create_steam_state,
    decode_steam_state,
    fetch_steam_friends,
    fetch_owned_games,
    fetch_steam_profile,
    verify_steam_openid,
)
from app.crud import list_games, update_game, create_game, get_game, delete_game, get_user_by_email, create_user, build_display_name
from app.telegram import (
    build_telegram_link_url,
    create_telegram_link_token,
    get_telegram_webhook_secret,
    parse_start_token,
    send_telegram_message,
    telegram_configured,
    telegram_linked_at,
)
from app.price_alerts import price_alert_watcher_loop, price_alerts_enabled
from app.google_auth import (
    build_google_authorization_url,
    exchange_google_code,
    google_configured,
    normalize_email,
    random_token,
    utcnow,
    verify_google_id_token,
)


def get_allowed_origins() -> list[str]:
    origins = {"http://localhost:3000"}
    for env_name in ("FRONTEND_ORIGIN", "FRONTEND_ORIGINS"):
        raw = os.getenv(env_name, "")
        for origin in raw.split(","):
            origin = origin.strip().rstrip("/")
            if origin:
                origins.add(origin)
    return sorted(origins)


def get_frontend_url() -> str:
    frontend_url = os.getenv("FRONTEND_PUBLIC_URL", "").strip().rstrip("/")
    if frontend_url:
        return frontend_url
    for origin in get_allowed_origins():
        if not origin.startswith("http://localhost"):
            return origin
    return "http://localhost:3000"


def get_backend_public_url(request: Request) -> str:
    backend_url = os.getenv("BACKEND_PUBLIC_URL", "").strip().rstrip("/")
    if backend_url:
        return backend_url
    railway_domain = os.getenv("RAILWAY_PUBLIC_DOMAIN", "").strip().rstrip("/")
    if railway_domain:
        if railway_domain.startswith(("http://", "https://")):
            return railway_domain
        return f"https://{railway_domain}"
    return str(request.base_url).rstrip("/")


@asynccontextmanager
async def lifespan(app: FastAPI):
    wait_for_db(engine)
    price_alert_task = None
    if price_alerts_enabled():
        price_alert_task = asyncio.create_task(price_alert_watcher_loop())
    try:
        yield
    finally:
        if price_alert_task:
            price_alert_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await price_alert_task


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


def steam_account_response(user: User) -> SteamAccountRead:
    return SteamAccountRead(
        linked=bool(user.steam_id),
        steam_id=user.steam_id,
        persona_name=user.steam_persona_name,
        avatar=user.steam_avatar,
        country_code=getattr(user, "steam_country_code", None),
        linked_at=user.steam_linked_at,
    )


def user_response(user: User, google_linked: bool | None = None, db: Session | None = None) -> UserRead:
    if google_linked is None:
        google_linked = bool(db and db.query(OAuthIdentity).filter(OAuthIdentity.user_id == user.id, OAuthIdentity.provider == "google").first())
    display_name = getattr(user, "display_name", None) or user.email.split("@", 1)[0]
    return UserRead(id=user.id, email=user.email, display_name=display_name, created_at=user.created_at, google_linked=google_linked)


def user_profile_response(user: User, google_linked: bool | None = None, db: Session | None = None) -> UserProfileRead:
    base = user_response(user, google_linked=google_linked, db=db)
    platforms = list(getattr(user, "platforms", None) or [])
    if getattr(user, "steam_id", None) and "Steam" not in platforms:
        platforms.append("Steam")
    return UserProfileRead(
        **base.model_dump(),
        bio=getattr(user, "bio", None),
        platforms=platforms,
        favorite_genres=list(getattr(user, "favorite_genres", None) or []),
    )


def public_user_response(user: User) -> PublicUserRead:
    return PublicUserRead(
        id=user.id,
        display_name=getattr(user, "display_name", None) or user.email.split("@", 1)[0],
        bio=getattr(user, "bio", None),
        avatar=getattr(user, "steam_avatar", None),
    )


def user_pair(first_id: uuid.UUID, second_id: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    return (first_id, second_id) if str(first_id) < str(second_id) else (second_id, first_id)


def are_friends(db: Session, first_id: uuid.UUID, second_id: uuid.UUID) -> bool:
    low_id, high_id = user_pair(first_id, second_id)
    return bool(db.query(Friendship.id).filter(Friendship.user_low_id == low_id, Friendship.user_high_id == high_id).first())


def create_notification(db: Session, user_id: uuid.UUID, notification_type: str, payload: dict) -> Notification:
    notification = Notification(user_id=user_id, type=notification_type, payload=payload)
    db.add(notification)
    return notification


def friend_request_response(db: Session, request: FriendRequest) -> FriendRequestRead:
    sender = db.query(User).filter(User.id == request.sender_id).first()
    recipient = db.query(User).filter(User.id == request.recipient_id).first()
    return FriendRequestRead(
        id=request.id,
        sender=public_user_response(sender),
        recipient=public_user_response(recipient),
        message=request.message,
        created_at=request.created_at,
    )


def game_invite_response(db: Session, invite: GameInvite) -> GameInviteRead:
    sender = db.query(User).filter(User.id == invite.sender_id).first()
    recipient = db.query(User).filter(User.id == invite.recipient_id).first()
    return GameInviteRead(
        id=invite.id,
        sender=public_user_response(sender),
        recipient=public_user_response(recipient),
        game_name=invite.game_name,
        game_id=invite.game_id,
        note=invite.note,
        status=invite.status,
        created_at=invite.created_at,
        responded_at=invite.responded_at,
    )


def collection_response(item: Favorite | WishlistItem) -> CatalogCollectionRead:
    return CatalogCollectionRead(
        id=item.id,
        catalog_game_id=item.catalog_game_id,
        title=item.title,
        cover_url=item.cover_url,
        created_at=item.created_at,
        updated_at=getattr(item, "updated_at", None),
    )


def price_alert_response(alert: PriceAlert, item: WishlistItem) -> PriceAlertRead:
    return PriceAlertRead(
        id=alert.id,
        wishlist_catalog_game_id=item.catalog_game_id,
        target_price=alert.target_price,
        target_discount=alert.target_discount,
        delivery_channels=list(alert.delivery_channels or []),
        last_delivered_at=alert.last_delivered_at,
        created_at=alert.created_at,
        updated_at=alert.updated_at,
    )


def favorites_block(db: Session, user_id: uuid.UUID) -> DataBlock:
    favorites = db.query(Favorite).filter(Favorite.user_id == user_id).order_by(Favorite.created_at.desc()).all()
    data = {"items": [collection_response(item).model_dump(mode="json") for item in favorites], "total": len(favorites)}
    return DataBlock(status="ready" if favorites else "empty", data=data, message=None if favorites else "No favorites have been saved yet.")


def wishlist_block(db: Session, user_id: uuid.UUID) -> DataBlock:
    items = db.query(WishlistItem).filter(WishlistItem.user_id == user_id).order_by(WishlistItem.created_at.desc()).all()
    alerts = db.query(PriceAlert).filter(PriceAlert.user_id == user_id).all()
    alert_by_item = {alert.wishlist_item_id: alert for alert in alerts}
    data = {
        "items": [
            {**collection_response(item).model_dump(mode="json"), "alert": price_alert_response(alert_by_item[item.id], item).model_dump(mode="json") if item.id in alert_by_item else None}
            for item in items
        ],
        "total": len(items),
        "active_alerts": len(alerts),
    }
    return DataBlock(status="ready" if items else "empty", data=data, message=None if items else "No wishlist games have been saved yet.")


def social_block(db: Session, user_id: uuid.UUID) -> DataBlock:
    try:
        friend_count = db.query(Friendship).filter((Friendship.user_low_id == user_id) | (Friendship.user_high_id == user_id)).count()
        unread_notifications = db.query(Notification).filter(Notification.user_id == user_id, Notification.read_at.is_(None)).count()
        incoming_requests = db.query(FriendRequest).filter(FriendRequest.recipient_id == user_id).count()
    except AttributeError:
        # Lightweight dependency stubs used by API contract consumers may only expose list operations.
        return DataBlock(status="not_connected", data=[])
    data = {"friend_count": friend_count, "unread_notifications": unread_notifications, "incoming_requests": incoming_requests}
    return DataBlock(status="ready" if friend_count or unread_notifications or incoming_requests else "empty", data=data)


def library_block(db: Session, user_id: uuid.UUID) -> DataBlock:
    games = list_games(db, user_id)
    if not games:
        return DataBlock(
            status="empty",
            data={
                "games": [],
                "total": 0,
                "total_games": 0,
                "total_playtime_minutes": 0,
                "total_playtime_hours": 0,
                "manual_games": 0,
                "psn_games": 0,
            },
        )
    total_playtime = sum(int(game.playtime_forever or 0) for game in games)
    return DataBlock(
        status="ready",
        data={
            "games": [GameRead.model_validate(game).model_dump(mode="json") for game in games],
            "total": len(games),
            "total_games": len(games),
            "total_playtime_minutes": total_playtime,
            "total_playtime_hours": round(total_playtime / 60, 1),
            "manual_games": sum(game.source == "manual" for game in games),
            "psn_games": sum(game.source == "psn" for game in games),
        },
    )


def empty_block(message: str | None = None) -> DataBlock:
    return DataBlock(status="empty", data=[], message=message)


def google_frontend_redirect(**params: str) -> RedirectResponse:
    return RedirectResponse(f"{get_frontend_url()}/auth/callback?{urlencode(params)}", status_code=303)


def steam_sign_in_email(steam_id: str) -> str:
    """Stable schema identity for Steam-only users; Steam supplies no verified email."""
    return f"steam-{steam_id}@steam.invalid"


def create_steam_sign_in_transaction(db: Session, request: Request) -> SteamLoginUrl:
    state = random_token()
    db.add(OAuthAuthorizationTransaction(
        state=state, code_verifier="unused", nonce="unused", mode="steam_login",
        expires_at=utcnow() + timedelta(minutes=10),
    ))
    db.commit()
    backend_url = get_backend_public_url(request)
    return SteamLoginUrl(url=build_steam_login_url(f"{backend_url}/auth/steam/callback?state={state}", backend_url))


def telegram_account_response(user: User) -> TelegramAccountRead:
    return TelegramAccountRead(
        linked=bool(user.telegram_chat_id),
        configured=telegram_configured(),
        username=user.telegram_username,
        linked_at=user.telegram_linked_at,
    )


def notify_saved_game(user: User, game_title: str) -> None:
    chat_id = getattr(user, "telegram_chat_id", None)
    if not chat_id:
        return
    try:
        send_telegram_message(
            chat_id,
            f"{game_title} was added to your Game Finder alerts. I will use this chat for future price and release alerts.",
        )
    except Exception:
        print("Telegram notification failed")


def steam_frontend_redirect(**params: str) -> RedirectResponse:
    return RedirectResponse(f"{get_frontend_url()}/steam?{urlencode(params)}", status_code=303)


def build_steam_recommendation_prompt(games: list[dict], extra_prompt: str | None = None) -> str:
    top_games = games[:10]
    if not top_games:
        raise HTTPException(status_code=409, detail="Steam library has no playable history yet")

    game_lines = []
    for index, game in enumerate(top_games, start=1):
        minutes = int(game.get("playtime_forever") or 0)
        hours = round(minutes / 60, 1)
        game_lines.append(f"{index}. {game.get('name')} - {hours} hours played")

    request = (extra_prompt or "").strip()
    if not request:
        request = "Recommend games I am likely to enjoy next based on my most played Steam games."

    return "\n".join(
        [
            request,
            "",
            "My most played Steam games:",
            *game_lines,
            "",
            "Use the playtime as the strongest preference signal.",
            "Avoid recommending games that are already in this Steam list.",
        ]
    )


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(get_frontend_url(), status_code=307)


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return RedirectResponse(f"{get_frontend_url()}/favicon.ico", status_code=307)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/games", response_model=list[GameRead])
def list_game_route(db: Session = Depends(get_db),current_user: User = Depends(get_current_user)):
    return list_games(db, current_user.id)


@app.post("/games", status_code=201, response_model=GameRead)
def create_game_route(game: GameCreate,db: Session = Depends(get_db),current_user: User = Depends(get_current_user)):
    created = create_game(db, game.model_dump(), current_user.id)
    notify_saved_game(current_user, created.title)
    return created


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


@app.post("/psn/import/preview", response_model=PsnImportPreview)
async def preview_psn_import(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Parse a user-provided PSN data export without persisting the source file."""
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Upload the Excel file received from PlayStation (.xlsx)")
    content = await file.read()
    games = parse_psn_export(content)
    return PsnImportPreview(
        games=games,
        total=len(games),
        message="Review the games below before importing them into your library.",
    )


@app.post("/psn/import/confirm", response_model=PsnImportResult)
def confirm_psn_import(
    data: PsnImportConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    unique_games: dict[str, str] = {}
    for candidate in data.games:
        title = normalize_title(candidate)
        if title:
            unique_games.setdefault(title.casefold(), title)
    if not unique_games:
        raise HTTPException(status_code=400, detail="Choose at least one valid game to import")

    existing = {
        game.external_id: game
        for game in db.query(Game)
        .filter(Game.owner_id == current_user.id, Game.source == "psn")
        .all()
    }
    now = datetime.now(timezone.utc)
    created = updated = skipped = 0
    try:
        for title in unique_games.values():
            external_id = psn_external_id(title)
            imported = existing.get(external_id)
            if imported is None:
                db.add(
                    Game(
                        owner_id=current_user.id,
                        source="psn",
                        external_id=external_id,
                        title=title,
                        info="Imported from your PlayStation data export",
                        synced_at=now,
                    )
                )
                created += 1
            elif imported.title != title:
                imported.title = title
                imported.synced_at = now
                updated += 1
            else:
                skipped += 1
        db.commit()
    except Exception:
        db.rollback()
        raise
    return PsnImportResult(created=created, updated=updated, skipped=skipped, total=len(unique_games))


@app.post("/auth/register", response_model=UserRead)
def register(user: UserCreate, db: Session = Depends(get_db)):
    email = normalize_email(user.email)
    existing_user = get_user_by_email(db, email)
    if existing_user:
        raise HTTPException(status_code=409, detail="User already exists")
    try:
        hashed_password = hash_password(user.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Password hashing failed")
    new_user = create_user(db, email, hashed_password)
    return user_response(new_user, google_linked=False)


@app.post("/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    email = normalize_email(form_data.username)
    password = form_data.password
    db_user = get_user_by_email(db, email)
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not db_user.password_hash or not verify_password(password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(db_user.id)
    return {"access_token": token, "token_type": "bearer"}


@app.get("/auth/me", response_model=UserRead)
def current_user_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return user_response(current_user, db=db)


@app.get("/profile", response_model=UserProfileRead)
def get_user_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return user_profile_response(current_user, db=db)


@app.patch("/profile", response_model=UserProfileRead)
def update_user_profile(
    data: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updates = data.model_dump(exclude_unset=True)
    display_name = updates.get("display_name")
    if display_name and display_name != current_user.display_name:
        if db.query(User.id).filter(User.display_name == display_name).first():
            raise HTTPException(status_code=409, detail="Display name is already taken")
    for field, value in updates.items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return user_profile_response(current_user, db=db)


@app.get("/users/search", response_model=list[PublicUserRead])
def search_users(
    q: str = Query(min_length=2, max_length=64),
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    users = (
        db.query(User)
        .filter(User.id != current_user.id, User.display_name.ilike(f"%{q.strip()}%"))
        .order_by(User.display_name.asc())
        .limit(limit)
        .all()
    )
    return [public_user_response(user) for user in users]


@app.get("/friends/requests", response_model=list[FriendRequestRead])
def list_outgoing_friend_requests(
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    requests = (
        db.query(FriendRequest)
        .filter(FriendRequest.sender_id == current_user.id)
        .order_by(FriendRequest.created_at.desc())
        .offset(offset).limit(limit).all()
    )
    return [friend_request_response(db, request) for request in requests]


@app.get("/friends/requests/incoming", response_model=list[FriendRequestRead])
def list_incoming_friend_requests(
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    requests = (
        db.query(FriendRequest)
        .filter(FriendRequest.recipient_id == current_user.id)
        .order_by(FriendRequest.created_at.desc())
        .offset(offset).limit(limit).all()
    )
    return [friend_request_response(db, request) for request in requests]


@app.post("/friends/requests", status_code=201, response_model=FriendRequestRead)
def create_friend_request(
    data: FriendRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.recipient_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot add yourself as a friend")
    recipient = db.query(User).filter(User.id == data.recipient_id).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="User not found")
    if are_friends(db, current_user.id, recipient.id):
        raise HTTPException(status_code=409, detail="You are already friends")
    reverse = db.query(FriendRequest).filter(FriendRequest.sender_id == recipient.id, FriendRequest.recipient_id == current_user.id).first()
    if reverse:
        raise HTTPException(status_code=409, detail="This user already sent you a friend request")
    existing = db.query(FriendRequest).filter(FriendRequest.sender_id == current_user.id, FriendRequest.recipient_id == recipient.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Friend request already sent")
    request = FriendRequest(sender_id=current_user.id, recipient_id=recipient.id, message=data.message)
    db.add(request)
    db.flush()
    create_notification(db, recipient.id, "friend_request", {"request_id": str(request.id), "from": current_user.display_name})
    db.commit()
    db.refresh(request)
    return friend_request_response(db, request)


@app.post("/friends/requests/{request_id}/accept", response_model=FriendshipRead)
def accept_friend_request(
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request = db.query(FriendRequest).filter(FriendRequest.id == request_id, FriendRequest.recipient_id == current_user.id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Friend request not found")
    low_id, high_id = user_pair(request.sender_id, request.recipient_id)
    friendship = Friendship(user_low_id=low_id, user_high_id=high_id)
    db.add(friendship)
    sender = db.query(User).filter(User.id == request.sender_id).first()
    create_notification(db, sender.id, "friend_request_accepted", {"by": current_user.display_name})
    db.delete(request)
    db.commit()
    db.refresh(friendship)
    return FriendshipRead(user=public_user_response(sender), created_at=friendship.created_at)


@app.delete("/friends/requests/{request_id}", status_code=204)
def delete_friend_request(
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request = db.query(FriendRequest).filter(
        FriendRequest.id == request_id,
        (FriendRequest.sender_id == current_user.id) | (FriendRequest.recipient_id == current_user.id),
    ).first()
    if not request:
        raise HTTPException(status_code=404, detail="Friend request not found")
    db.delete(request)
    db.commit()


@app.get("/friends", response_model=list[FriendshipRead])
def list_friends(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    friendships = (
        db.query(Friendship)
        .filter((Friendship.user_low_id == current_user.id) | (Friendship.user_high_id == current_user.id))
        .order_by(Friendship.created_at.desc()).offset(offset).limit(limit).all()
    )
    result = []
    for friendship in friendships:
        friend_id = friendship.user_high_id if friendship.user_low_id == current_user.id else friendship.user_low_id
        friend = db.query(User).filter(User.id == friend_id).first()
        result.append(FriendshipRead(user=public_user_response(friend), created_at=friendship.created_at))
    return result


@app.delete("/friends/{user_id}", status_code=204)
def delete_friend(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    low_id, high_id = user_pair(current_user.id, user_id)
    friendship = db.query(Friendship).filter(Friendship.user_low_id == low_id, Friendship.user_high_id == high_id).first()
    if not friendship:
        raise HTTPException(status_code=404, detail="Friendship not found")
    db.delete(friendship)
    db.commit()


@app.get("/conversations", response_model=list[ConversationRead])
def list_conversations(
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversations = (
        db.query(Conversation)
        .filter((Conversation.user_low_id == current_user.id) | (Conversation.user_high_id == current_user.id))
        .order_by(Conversation.updated_at.desc()).offset(offset).limit(limit).all()
    )
    result = []
    for conversation in conversations:
        participant_id = conversation.user_high_id if conversation.user_low_id == current_user.id else conversation.user_low_id
        participant = db.query(User).filter(User.id == participant_id).first()
        last_message = db.query(Message).filter(Message.conversation_id == conversation.id).order_by(Message.created_at.desc()).first()
        unread_count = db.query(Message).filter(Message.conversation_id == conversation.id, Message.sender_id != current_user.id, Message.read_at.is_(None)).count()
        result.append(ConversationRead(id=conversation.id, participant=public_user_response(participant), updated_at=conversation.updated_at, unread_count=unread_count, last_message=last_message.body if last_message else None))
    return result


@app.post("/conversations", status_code=201, response_model=ConversationRead)
def create_conversation(
    data: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.recipient_id == current_user.id or not are_friends(db, current_user.id, data.recipient_id):
        raise HTTPException(status_code=403, detail="You can only message GameFinder friends")
    low_id, high_id = user_pair(current_user.id, data.recipient_id)
    conversation = db.query(Conversation).filter(Conversation.user_low_id == low_id, Conversation.user_high_id == high_id).first()
    if conversation:
        return ConversationRead(id=conversation.id, participant=public_user_response(db.query(User).filter(User.id == data.recipient_id).first()), updated_at=conversation.updated_at)
    conversation = Conversation(user_low_id=low_id, user_high_id=high_id)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return ConversationRead(id=conversation.id, participant=public_user_response(db.query(User).filter(User.id == data.recipient_id).first()), updated_at=conversation.updated_at)


def get_conversation_for_user(db: Session, conversation_id: uuid.UUID, user_id: uuid.UUID) -> Conversation:
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        (Conversation.user_low_id == user_id) | (Conversation.user_high_id == user_id),
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@app.get("/conversations/{conversation_id}/messages", response_model=list[MessageRead])
def list_messages(
    conversation_id: uuid.UUID,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_conversation_for_user(db, conversation_id, current_user.id)
    messages = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.created_at.desc()).offset(offset).limit(limit).all()
    now = datetime.now(timezone.utc)
    for message in messages:
        if message.sender_id != current_user.id and message.read_at is None:
            message.read_at = now
    db.commit()
    return [MessageRead(id=message.id, conversation_id=message.conversation_id, sender_id=message.sender_id, body=message.body, created_at=message.created_at, read_at=message.read_at) for message in reversed(messages)]


@app.post("/conversations/{conversation_id}/messages", status_code=201, response_model=MessageRead)
def create_message(
    conversation_id: uuid.UUID,
    data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = get_conversation_for_user(db, conversation_id, current_user.id)
    message = Message(conversation_id=conversation.id, sender_id=current_user.id, body=data.body.strip())
    conversation.updated_at = datetime.now(timezone.utc)
    recipient_id = conversation.user_high_id if conversation.user_low_id == current_user.id else conversation.user_low_id
    db.add(message)
    create_notification(db, recipient_id, "message", {"conversation_id": str(conversation.id), "from": current_user.display_name, "preview": message.body[:120]})
    db.commit()
    db.refresh(message)
    return MessageRead(id=message.id, conversation_id=message.conversation_id, sender_id=message.sender_id, body=message.body, created_at=message.created_at, read_at=message.read_at)


@app.get("/game-invites", response_model=list[GameInviteRead])
def list_game_invites(
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invites = db.query(GameInvite).filter(
        (GameInvite.sender_id == current_user.id) | (GameInvite.recipient_id == current_user.id)
    ).order_by(GameInvite.created_at.desc()).offset(offset).limit(limit).all()
    return [game_invite_response(db, invite) for invite in invites]


@app.post("/game-invites", status_code=201, response_model=GameInviteRead)
def create_game_invite(
    data: GameInviteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.recipient_id == current_user.id or not are_friends(db, current_user.id, data.recipient_id):
        raise HTTPException(status_code=403, detail="You can only invite GameFinder friends")
    recipient = db.query(User).filter(User.id == data.recipient_id).first()
    invite = GameInvite(sender_id=current_user.id, recipient_id=recipient.id, game_id=data.game_id, game_name=data.game_name.strip(), note=data.note)
    db.add(invite)
    db.flush()
    create_notification(db, recipient.id, "game_invite", {"invite_id": str(invite.id), "from": current_user.display_name, "game_name": invite.game_name})
    db.commit()
    db.refresh(invite)
    return game_invite_response(db, invite)


@app.post("/game-invites/{invite_id}/response", response_model=GameInviteRead)
def respond_to_game_invite(
    invite_id: uuid.UUID,
    data: InviteResponseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invite = db.query(GameInvite).filter(GameInvite.id == invite_id, GameInvite.recipient_id == current_user.id).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Game invite not found")
    if invite.status != "pending":
        raise HTTPException(status_code=409, detail="Game invite has already been answered")
    invite.status = data.status
    invite.responded_at = datetime.now(timezone.utc)
    create_notification(db, invite.sender_id, "game_invite_response", {"invite_id": str(invite.id), "by": current_user.display_name, "status": data.status})
    db.commit()
    db.refresh(invite)
    return game_invite_response(db, invite)


@app.get("/notifications", response_model=list[NotificationRead])
def list_notifications(
    unread_only: bool = False,
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.read_at.is_(None))
    notifications = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()
    return [NotificationRead(id=item.id, type=item.type, payload=item.payload or {}, read_at=item.read_at, created_at=item.created_at) for item in notifications]


@app.post("/notifications/{notification_id}/read", response_model=NotificationRead)
def mark_notification_read(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == current_user.id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notification)
    return NotificationRead(id=notification.id, type=notification.type, payload=notification.payload or {}, read_at=notification.read_at, created_at=notification.created_at)


@app.post("/notifications/read-all", status_code=204)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(Notification).filter(Notification.user_id == current_user.id, Notification.read_at.is_(None)).update({Notification.read_at: datetime.now(timezone.utc)}, synchronize_session=False)
    db.commit()


@app.get("/social/invite-link", response_model=InviteLinkRead)
def get_social_invite_link(request: Request, current_user: User = Depends(get_current_user)):
    return InviteLinkRead(url=f"{get_frontend_url()}/friends?add={current_user.display_name}")


@app.get("/favorites", response_model=list[CatalogCollectionRead])
def list_favorites(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = db.query(Favorite).filter(Favorite.user_id == current_user.id).order_by(Favorite.created_at.desc()).offset(offset).limit(limit).all()
    return [collection_response(item) for item in items]


@app.post("/favorites", status_code=201, response_model=CatalogCollectionRead)
def add_favorite(
    data: CatalogCollectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(Favorite).filter(Favorite.user_id == current_user.id, Favorite.catalog_game_id == data.catalog_game_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Game is already in favorites")
    item = Favorite(user_id=current_user.id, **data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return collection_response(item)


@app.delete("/favorites/{catalog_game_id}", status_code=204)
def remove_favorite(
    catalog_game_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(Favorite).filter(Favorite.user_id == current_user.id, Favorite.catalog_game_id == catalog_game_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Favorite not found")
    db.delete(item)
    db.commit()


@app.get("/wishlist", response_model=list[CatalogCollectionRead])
def list_wishlist(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = db.query(WishlistItem).filter(WishlistItem.user_id == current_user.id).order_by(WishlistItem.created_at.desc()).offset(offset).limit(limit).all()
    return [collection_response(item) for item in items]


@app.post("/wishlist", status_code=201, response_model=CatalogCollectionRead)
def add_wishlist_item(
    data: CatalogCollectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(WishlistItem).filter(WishlistItem.user_id == current_user.id, WishlistItem.catalog_game_id == data.catalog_game_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Game is already in wishlist")
    item = WishlistItem(user_id=current_user.id, **data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return collection_response(item)


def get_owned_wishlist_item(db: Session, user_id: uuid.UUID, catalog_game_id: int) -> WishlistItem:
    item = db.query(WishlistItem).filter(WishlistItem.user_id == user_id, WishlistItem.catalog_game_id == catalog_game_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Wishlist item not found")
    return item


@app.patch("/wishlist/{catalog_game_id}", response_model=CatalogCollectionRead)
def update_wishlist_item(
    catalog_game_id: int,
    data: CatalogCollectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = get_owned_wishlist_item(db, current_user.id, catalog_game_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return collection_response(item)


@app.delete("/wishlist/{catalog_game_id}", status_code=204)
def remove_wishlist_item(
    catalog_game_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = get_owned_wishlist_item(db, current_user.id, catalog_game_id)
    db.delete(item)
    db.commit()


@app.get("/price-alerts", response_model=list[PriceAlertRead])
def list_price_alerts(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alerts = db.query(PriceAlert).filter(PriceAlert.user_id == current_user.id).order_by(PriceAlert.created_at.desc()).offset(offset).limit(limit).all()
    items = {item.id: item for item in db.query(WishlistItem).filter(WishlistItem.user_id == current_user.id).all()}
    return [price_alert_response(alert, items[alert.wishlist_item_id]) for alert in alerts if alert.wishlist_item_id in items]


@app.post("/price-alerts", status_code=201, response_model=PriceAlertRead)
def create_price_alert(
    data: PriceAlertCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = get_owned_wishlist_item(db, current_user.id, data.wishlist_catalog_game_id)
    existing = db.query(PriceAlert).filter(PriceAlert.wishlist_item_id == item.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="This wishlist game already has a price alert")
    if "telegram" in data.delivery_channels and not current_user.telegram_chat_id:
        raise HTTPException(status_code=400, detail="Connect Telegram before enabling Telegram delivery")
    alert = PriceAlert(
        wishlist_item_id=item.id,
        user_id=current_user.id,
        target_price=data.target_price,
        target_discount=data.target_discount,
        delivery_channels=list(data.delivery_channels),
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return price_alert_response(alert, item)


@app.patch("/price-alerts/{alert_id}", response_model=PriceAlertRead)
def update_price_alert(
    alert_id: uuid.UUID,
    data: PriceAlertUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = db.query(PriceAlert).filter(PriceAlert.id == alert_id, PriceAlert.user_id == current_user.id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Price alert not found")
    updates = data.model_dump(exclude_unset=True)
    channels = updates.get("delivery_channels", alert.delivery_channels)
    if "telegram" in channels and not current_user.telegram_chat_id:
        raise HTTPException(status_code=400, detail="Connect Telegram before enabling Telegram delivery")
    for field, value in updates.items():
        setattr(alert, field, value)
    if alert.target_price is None and alert.target_discount is None:
        raise HTTPException(status_code=422, detail="Set a target price or discount")
    item = db.query(WishlistItem).filter(WishlistItem.id == alert.wishlist_item_id, WishlistItem.user_id == current_user.id).first()
    db.commit()
    db.refresh(alert)
    return price_alert_response(alert, item)


@app.delete("/price-alerts/{alert_id}", status_code=204)
def delete_price_alert(
    alert_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = db.query(PriceAlert).filter(PriceAlert.id == alert_id, PriceAlert.user_id == current_user.id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Price alert not found")
    db.delete(alert)
    db.commit()


@app.get("/profile/summary", response_model=ProfileSummaryRead)
async def profile_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = user_profile_response(current_user, db=db)
    profile_complete = bool(profile.bio or profile.platforms or profile.favorite_genres)
    google_linked = bool(
        db.query(OAuthIdentity)
        .filter(OAuthIdentity.user_id == current_user.id, OAuthIdentity.provider == "google")
        .first()
    )
    services = {
        "steam": steam_account_response(current_user).model_dump(mode="json"),
        "google": {"linked": google_linked},
        "telegram": telegram_account_response(current_user).model_dump(mode="json"),
    }
    library = library_block(db, current_user.id)
    if current_user.steam_id:
        try:
            steam_games = await fetch_owned_games(current_user.steam_id)
            if steam_games:
                library_data = dict(library.data)
                steam_minutes = sum(int(game.get("playtime_forever") or 0) for game in steam_games)
                library_data["total_games"] += len(steam_games)
                library_data["total_playtime_minutes"] += steam_minutes
                library_data["total_playtime_hours"] = round(library_data["total_playtime_minutes"] / 60, 1)
                library = DataBlock(status="ready", data=library_data)
        except Exception:
            pass
    return ProfileSummaryRead(
        account=DataBlock(status="ready", data=profile.model_dump(mode="json")),
        profile=DataBlock(status="ready" if profile_complete else "empty", data=profile.model_dump(mode="json")),
        services=DataBlock(status="ready", data=services),
        library=library,
        favorites=favorites_block(db, current_user.id),
        wishlist=wishlist_block(db, current_user.id),
        recently_played=empty_block("No recently played games are available yet."),
    )


@app.get("/dashboard", response_model=DashboardRead)
async def dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        deals = await fetch_steam_store_deals(country=current_user.steam_country_code or "US", page_size=6)
        deals_block = DataBlock(status="ready" if deals else "empty", data={"results": deals})
    except Exception:
        deals_block = DataBlock(status="error", data=[], message="Deals are temporarily unavailable.")

    steam = steam_account_response(current_user)
    steam_data = {"steam": steam.model_dump(mode="json"), "games": []}
    if not steam.linked:
        steam_block = DataBlock(status="not_connected", data=steam_data)
    else:
        try:
            steam_games = await fetch_owned_games(current_user.steam_id)
            steam_block = DataBlock(status="ready" if steam_games else "empty", data={"steam": steam.model_dump(mode="json"), "games": steam_games})
        except Exception:
            steam_block = DataBlock(status="error", data=steam_data, message="Steam library is temporarily unavailable.")
    library = library_block(db, current_user.id)
    if steam_block.status == "ready" and steam_games:
        library_data = dict(library.data)
        steam_minutes = sum(int(game.get("playtime_forever") or 0) for game in steam_games)
        library_data["total_games"] += len(steam_games)
        library_data["total_playtime_minutes"] += steam_minutes
        library_data["total_playtime_hours"] = round(library_data["total_playtime_minutes"] / 60, 1)
        library = DataBlock(status="ready", data=library_data)
    return DashboardRead(
        user=DataBlock(status="ready", data=user_profile_response(current_user, db=db).model_dump(mode="json")),
        library=library,
        recommendations=empty_block("Add games or connect Steam to get recommendations."),
        deals=deals_block,
        steam=steam_block,
        social=social_block(db, current_user.id),
        activity=empty_block("No recent activity yet."),
    )


def create_google_transaction(db: Session, mode: str, user_id: uuid.UUID | None = None) -> OAuthLoginUrl:
    if not google_configured():
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")
    state, verifier, nonce = random_token(), random_token(), random_token()
    db.add(OAuthAuthorizationTransaction(
        state=state,
        code_verifier=verifier,
        nonce=nonce,
        mode=mode,
        user_id=user_id,
        expires_at=utcnow() + timedelta(minutes=10),
    ))
    db.commit()
    return OAuthLoginUrl(url=build_google_authorization_url(state, verifier, nonce))


@app.get("/auth/google/status", response_model=GoogleStatusRead)
def google_status():
    return GoogleStatusRead(configured=google_configured())


@app.get("/auth/google/login-url", response_model=OAuthLoginUrl)
def google_login_url(db: Session = Depends(get_db)):
    return create_google_transaction(db, "login")


@app.post("/auth/google/link-url", response_model=OAuthLoginUrl)
def google_link_url(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return create_google_transaction(db, "link", current_user.id)


@app.get("/auth/google/callback", include_in_schema=False)
async def google_callback(code: str | None = None, state: str | None = None, error: str | None = None, db: Session = Depends(get_db)):
    if error or not code or not state:
        return google_frontend_redirect(provider="google", error="authorization_failed")
    transaction = db.query(OAuthAuthorizationTransaction).filter(OAuthAuthorizationTransaction.state == state).first()
    if not transaction or transaction.expires_at <= utcnow() or transaction.result_user_id:
        if transaction:
            db.delete(transaction)
            db.commit()
        return google_frontend_redirect(provider="google", error="invalid_state")
    # Consume state before contacting Google so it cannot be replayed.
    mode, linked_user_id, verifier, nonce = transaction.mode, transaction.user_id, transaction.code_verifier, transaction.nonce
    db.delete(transaction)
    db.commit()
    try:
        token_data = await exchange_google_code(code, verifier)
        claims = await verify_google_id_token(token_data.get("id_token", ""), nonce)
        subject, email = claims["sub"], normalize_email(claims["email"])
        identity = db.query(OAuthIdentity).filter(OAuthIdentity.provider == "google", OAuthIdentity.provider_subject == subject).first()
        if mode == "link":
            user = db.query(User).filter(User.id == linked_user_id).first()
            if not user:
                raise ValueError("Account no longer exists")
            if identity and identity.user_id != user.id:
                return google_frontend_redirect(provider="google", error="account_already_linked")
            if not identity:
                db.add(OAuthIdentity(user_id=user.id, provider="google", provider_subject=subject, email=email))
        elif identity:
            user = db.query(User).filter(User.id == identity.user_id).first()
            if not user:
                raise ValueError("Account no longer exists")
        else:
            user = get_user_by_email(db, email)
            if not user:
                user = User(email=email, password_hash=None, display_name=build_display_name(db, email))
                db.add(user)
                db.flush()
            db.add(OAuthIdentity(user_id=user.id, provider="google", provider_subject=subject, email=email))
        db.commit()
        exchange_code = random_token()
        db.add(OAuthAuthorizationTransaction(
            state=random_token(), code_verifier="consumed", nonce="consumed", mode="result",
            exchange_code=exchange_code, result_user_id=user.id, expires_at=utcnow() + timedelta(seconds=60),
        ))
        db.commit()
        return google_frontend_redirect(provider="google", exchange_code=exchange_code)
    except Exception:
        db.rollback()
        return google_frontend_redirect(provider="google", error="authentication_failed")


@app.post("/auth/google/exchange")
def google_exchange(data: OAuthExchangeRequest, db: Session = Depends(get_db)):
    transaction = db.query(OAuthAuthorizationTransaction).filter(
        OAuthAuthorizationTransaction.exchange_code == data.exchange_code,
        OAuthAuthorizationTransaction.mode == "result",
    ).first()
    if not transaction or transaction.expires_at <= utcnow() or not transaction.result_user_id:
        if transaction:
            db.delete(transaction)
            db.commit()
        raise HTTPException(status_code=401, detail="Invalid or expired Google sign-in result")
    user_id = transaction.result_user_id
    db.delete(transaction)
    db.commit()
    return {"access_token": create_access_token(user_id), "token_type": "bearer"}


@app.get("/auth/steam/login-url", response_model=SteamLoginUrl)
def steam_sign_in_url(request: Request, db: Session = Depends(get_db)):
    return create_steam_sign_in_transaction(db, request)


@app.get("/auth/steam/callback", include_in_schema=False)
async def steam_sign_in_callback(request: Request, state: str | None = None, db: Session = Depends(get_db)):
    if not state:
        return google_frontend_redirect(provider="steam", error="authorization_failed")
    transaction = db.query(OAuthAuthorizationTransaction).filter(OAuthAuthorizationTransaction.state == state).first()
    if not transaction or transaction.mode != "steam_login" or transaction.expires_at <= utcnow():
        if transaction:
            db.delete(transaction)
            db.commit()
        return google_frontend_redirect(provider="steam", error="invalid_state")

    # Consume the state before the remote verification call, preventing replay.
    db.delete(transaction)
    db.commit()
    try:
        steam_id = await verify_steam_openid(dict(request.query_params))
        user = db.query(User).filter(User.steam_id == steam_id).first()
        if not user:
            profile = await fetch_steam_profile(steam_id)
            user = User(
                email=steam_sign_in_email(steam_id), password_hash=None, display_name=build_display_name(db, steam_sign_in_email(steam_id)), steam_id=steam_id,
                steam_persona_name=profile["persona_name"], steam_avatar=profile["avatar"],
                steam_country_code=profile["country_code"], steam_linked_at=datetime.now(timezone.utc),
            )
            db.add(user)
            db.flush()
        exchange_code = random_token()
        db.add(OAuthAuthorizationTransaction(
            state=random_token(), code_verifier="consumed", nonce="consumed", mode="result",
            exchange_code=exchange_code, result_user_id=user.id, expires_at=utcnow() + timedelta(seconds=60),
        ))
        db.commit()
        return google_frontend_redirect(provider="steam", exchange_code=exchange_code)
    except Exception:
        db.rollback()
        return google_frontend_redirect(provider="steam", error="authentication_failed")


@app.post("/auth/steam/exchange")
def steam_sign_in_exchange(data: OAuthExchangeRequest, db: Session = Depends(get_db)):
    return google_exchange(data, db)


@app.get("/telegram/me", response_model=TelegramAccountRead)
def get_telegram_account(current_user: User = Depends(get_current_user)):
    return telegram_account_response(current_user)


@app.post("/telegram/link-url", response_model=TelegramLinkRead)
def telegram_link_url(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not telegram_configured():
        return TelegramLinkRead(
            configured=False,
            message="Telegram bot is not configured yet. Set TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME.",
        )

    if not current_user.telegram_link_token:
        current_user.telegram_link_token = create_telegram_link_token()
        db.commit()
        db.refresh(current_user)

    return TelegramLinkRead(configured=True, url=build_telegram_link_url(current_user.telegram_link_token))


@app.delete("/telegram/me", response_model=TelegramAccountRead)
def unlink_telegram_account(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_user.telegram_chat_id = None
    current_user.telegram_username = None
    current_user.telegram_linked_at = None
    db.commit()
    db.refresh(current_user)
    return telegram_account_response(current_user)


@app.post("/telegram/test-alert")
def send_telegram_test_alert(current_user: User = Depends(get_current_user)):
    if not current_user.telegram_chat_id:
        raise HTTPException(status_code=409, detail="Connect Telegram first")
    ok = send_telegram_message(
        current_user.telegram_chat_id,
        "Game Finder alerts are connected. Future favorites can use this chat for price and release updates.",
    )
    if not ok:
        raise HTTPException(status_code=502, detail="Telegram did not accept the message")
    return {"status": "sent"}


@app.post("/telegram/webhook/{secret}", include_in_schema=False)
def telegram_webhook(secret: str, update: dict, db: Session = Depends(get_db)):
    expected_secret = get_telegram_webhook_secret()
    if expected_secret and secret != expected_secret:
        raise HTTPException(status_code=403, detail="Invalid Telegram webhook secret")

    link_token, chat_id, username = parse_start_token(update)
    user = db.query(User).filter(User.telegram_link_token == link_token).first()
    if not user:
        raise HTTPException(status_code=404, detail="Telegram link token not found")

    linked_user = db.query(User).filter(User.telegram_chat_id == chat_id, User.id != user.id).first()
    if linked_user:
        raise HTTPException(status_code=409, detail="This Telegram chat is already linked")

    user.telegram_chat_id = chat_id
    user.telegram_username = username
    user.telegram_linked_at = telegram_linked_at()
    db.commit()
    send_telegram_message(chat_id, "Telegram alerts are connected to your Game Finder account.")
    return {"status": "linked"}


@app.get("/steam/login-url", response_model=SteamLoginUrl)
def steam_login_url(request: Request, current_user: User = Depends(get_current_user)):
    state = create_steam_state(str(current_user.id))
    backend_url = get_backend_public_url(request)
    callback_url = f"{backend_url}/steam/callback?state={state}"
    realm = f"{backend_url}/"
    return SteamLoginUrl(url=build_steam_login_url(callback_url, realm))


@app.get("/steam/callback", include_in_schema=False)
async def steam_callback(request: Request, state: str, db: Session = Depends(get_db)):
    try:
        user_id = uuid.UUID(decode_steam_state(state))
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        steam_id = await verify_steam_openid(dict(request.query_params))
        linked_user = db.query(User).filter(User.steam_id == steam_id, User.id != user.id).first()
        if linked_user:
            raise HTTPException(status_code=409, detail="This Steam account is already linked")

        profile = await fetch_steam_profile(steam_id)
        user.steam_id = steam_id
        user.steam_persona_name = profile["persona_name"]
        user.steam_avatar = profile["avatar"]
        user.steam_country_code = profile["country_code"]
        user.steam_linked_at = datetime.now(timezone.utc)
        db.commit()
    except HTTPException as exc:
        return steam_frontend_redirect(error=str(exc.detail))
    except Exception:
        db.rollback()
        return steam_frontend_redirect(error="Could not link Steam account")
    return steam_frontend_redirect(linked="1")


@app.get("/steam/me", response_model=SteamAccountRead)
async def get_steam_account(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.steam_id and not current_user.steam_country_code:
        profile = await fetch_steam_profile(current_user.steam_id)
        if profile.get("country_code"):
            current_user.steam_country_code = profile["country_code"]
            db.commit()
            db.refresh(current_user)
    return steam_account_response(current_user)


@app.delete("/steam/me", response_model=SteamAccountRead)
def unlink_steam_account(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(Game).filter(Game.owner_id == current_user.id, Game.source == "steam").delete(synchronize_session=False)
    current_user.steam_id = None
    current_user.steam_persona_name = None
    current_user.steam_avatar = None
    current_user.steam_country_code = None
    current_user.steam_linked_at = None
    db.commit()
    db.refresh(current_user)
    return steam_account_response(current_user)


@app.get("/steam/library", response_model=SteamLibraryRead)
async def get_steam_library(current_user: User = Depends(get_current_user)):
    if not current_user.steam_id:
        raise HTTPException(status_code=409, detail="Connect Steam first")
    games = await fetch_owned_games(current_user.steam_id)
    return SteamLibraryRead(steam=steam_account_response(current_user), games=games)


@app.post("/steam/library/sync", response_model=SteamLibrarySyncRead)
async def sync_steam_library(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Refresh Steam-only data and remove legacy Steam imports from saved games."""
    if not current_user.steam_id:
        raise HTTPException(status_code=409, detail="Connect Steam first")

    # Fetch first: a private library or Steam outage must never erase the last successful import.
    steam_games = await fetch_owned_games(current_user.steam_id)
    legacy_imports = (
        db.query(Game)
        .filter(Game.owner_id == current_user.id, Game.source == "steam")
        .all()
    )
    try:
        for imported_game in legacy_imports:
            db.delete(imported_game)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return SteamLibrarySyncRead(
        steam=steam_account_response(current_user),
        games=steam_games,
        removed=len(legacy_imports),
        synced_at=datetime.now(timezone.utc),
    )


def build_steam_social_response(user: User, own_games: list[dict], friends: list[dict], friend_libraries: list[list[dict] | None]):
    own_game_map = {int(game["appid"]): game for game in own_games if game.get("appid") is not None}
    friend_game_totals: dict[int, dict] = {}
    friend_items = []
    public_libraries = 0
    private_libraries = 0

    for friend, library in zip(friends, friend_libraries):
        if library is None:
            private_libraries += 1
            friend_items.append(
                {
                    **friend,
                    "library_public": False,
                    "games_count": 0,
                    "common_games_count": 0,
                    "taste_match_percent": 0,
                    "common_games": [],
                    "top_games": [],
                }
            )
            continue

        public_libraries += 1
        friend_game_map = {int(game["appid"]): game for game in library if game.get("appid") is not None}
        common_app_ids = set(own_game_map).intersection(friend_game_map)
        common_games = sorted(
            [own_game_map[appid] for appid in common_app_ids],
            key=lambda game: game.get("playtime_forever") or 0,
            reverse=True,
        )[:5]
        denominator = max(1, min(len(own_game_map), len(friend_game_map)))
        taste_match = min(100, round((len(common_app_ids) / denominator) * 100))

        for game in library[:20]:
            appid = game.get("appid")
            if appid is None:
                continue
            item = friend_game_totals.setdefault(
                int(appid),
                {
                    "appid": int(appid),
                    "name": game.get("name") or f"Steam app {appid}",
                    "friends": 0,
                    "total_playtime_forever": 0,
                    "img_icon_url": game.get("img_icon_url"),
                },
            )
            if not item.get("img_icon_url") and game.get("img_icon_url"):
                item["img_icon_url"] = game.get("img_icon_url")
            item["friends"] += 1
            item["total_playtime_forever"] += int(game.get("playtime_forever") or 0)

        friend_items.append(
            {
                **friend,
                "library_public": True,
                "games_count": len(friend_game_map),
                "common_games_count": len(common_app_ids),
                "taste_match_percent": taste_match,
                "common_games": common_games,
                "top_games": library[:5],
            }
        )

    friend_items.sort(key=lambda item: (item["taste_match_percent"], item["common_games_count"]), reverse=True)
    top_friend_games = sorted(
        friend_game_totals.values(),
        key=lambda item: (item["friends"], item["total_playtime_forever"]),
        reverse=True,
    )[:10]

    return SteamSocialRead(
        steam=steam_account_response(user),
        friends=friend_items,
        top_friend_games=top_friend_games,
        public_libraries=public_libraries,
        private_libraries=private_libraries,
    )


@app.get("/steam/social", response_model=SteamSocialRead)
async def get_steam_social(current_user: User = Depends(get_current_user), friends_limit: int = 12):
    if not current_user.steam_id:
        raise HTTPException(status_code=409, detail="Connect Steam first")
    if friends_limit < 1 or friends_limit > 24:
        raise HTTPException(status_code=400, detail="friends_limit must be between 1 and 24")

    own_games = await fetch_owned_games(current_user.steam_id)
    friends = await fetch_steam_friends(current_user.steam_id, limit=friends_limit)

    async def load_friend_library(friend):
        try:
            return await fetch_owned_games(friend["steam_id"])
        except HTTPException:
            return None

    friend_libraries = await asyncio.gather(*(load_friend_library(friend) for friend in friends))
    return build_steam_social_response(current_user, own_games, friends, friend_libraries)


@app.post("/steam/recommendations", response_model=RecommendationResponse)
@limiter.limit("5/minute")
async def steam_recommendations(
    request: Request,
    data: SteamRecommendationRequest,
    current_user: User = Depends(get_current_user),
):
    if not current_user.steam_id:
        raise HTTPException(status_code=409, detail="Connect Steam first")
    games = await fetch_owned_games(current_user.steam_id)
    prompt = build_steam_recommendation_prompt(games, data.prompt)
    liked_app_ids = [int(game["appid"]) for game in games[:10] if game.get("appid") is not None]
    result = await asyncio.to_thread(get_recommendation, prompt, liked_app_ids)
    return result


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


@app.get("/catalog/upcoming-games", response_model=GameSearchResponse)
@limiter.limit("30/minute")
async def upcoming_games(request: Request, page: int = 1, page_size: int = 8):
    if page < 1:
        raise HTTPException(status_code=400, detail="page must be >= 1")
    if page_size < 1 or page_size > 20:
        raise HTTPException(status_code=400, detail="page_size must be between 1 and 20")
    key = build_cache_key("upcoming_games", page=page, page_size=page_size)

    async def fetch():
        return await fetch_rawg_upcoming_games(page=page, page_size=page_size)

    try:
        return await get_json_cached(key, CACHE_TTL, fetch)
    except RAWGError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))


@app.get("/catalog/trending-games", response_model=GameSearchResponse)
@limiter.limit("30/minute")
async def trending_games(request: Request, page: int = 1, page_size: int = 8):
    if page < 1:
        raise HTTPException(status_code=400, detail="page must be >= 1")
    if page_size < 1 or page_size > 20:
        raise HTTPException(status_code=400, detail="page_size must be between 1 and 20")
    key = build_cache_key("trending_games", page=page, page_size=page_size)

    async def fetch():
        return await fetch_rawg_trending_games(page=page, page_size=page_size)

    try:
        return await get_json_cached(key, CACHE_TTL, fetch)
    except RAWGError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))


@app.get("/prices/games/{rawg_id}", response_model=GamePriceHistory)
async def game_price_history(rawg_id: int, country: str = "US"):
    if rawg_id < 1:
        raise HTTPException(status_code=400, detail="rawg_id must be >= 1")
    normalized_country = country.strip().upper()
    if len(normalized_country) != 2:
        raise HTTPException(status_code=400, detail="country must be a 2-letter code")

    detail_key = build_cache_key("catalog_game", rawg_id=rawg_id)

    async def fetch_detail():
        return await fetch_rawg_game_detail(rawg_id)

    try:
        game = await get_json_cached(detail_key, CACHE_TTL, fetch_detail)
    except RAWGError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))

    title = (game.get("name") or "").strip()
    if not title:
        raise HTTPException(status_code=404, detail="Game title not available")

    price_key = build_cache_key("price_history", title=title, country=normalized_country)

    async def fetch_price():
        return await fetch_game_price_history(title, country=normalized_country)

    return await get_json_cached(price_key, CACHE_TTL, fetch_price)


@app.get("/prices/deals", response_model=HomeDealResponse)
async def homepage_deals(country: str = "US", page_size: int = 6):
    normalized_country = country.strip().upper()
    if len(normalized_country) != 2:
        raise HTTPException(status_code=400, detail="country must be a 2-letter code")
    if page_size < 1 or page_size > 12:
        raise HTTPException(status_code=400, detail="page_size must be between 1 and 12")

    key = build_cache_key("steam_store_deals", country=normalized_country, page_size=page_size)

    async def fetch():
        steam_deals = await fetch_steam_store_deals(country=normalized_country, page_size=page_size)

        async def attach_rawg_id(deal: dict):
            try:
                rawg = await fetch_rawg_games(deal["name"], page=1)
                match = next((game for game in rawg.get("results", []) if game.get("id")), None)
            except RAWGError:
                match = None
            return {
                "id": match.get("id") if match else None,
                "name": deal["name"],
                "released": match.get("released") if match else None,
                "background_image": deal.get("background_image") or (match.get("background_image") if match else None),
                "url": deal.get("url"),
                "current": deal.get("current"),
                "history_low_all": deal.get("history_low_all"),
            }

        return {"results": await asyncio.gather(*(attach_rawg_id(deal) for deal in steam_deals))}

    return await get_json_cached(key, CACHE_TTL, fetch)


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
