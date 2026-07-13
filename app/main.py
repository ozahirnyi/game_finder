import asyncio
import os
import uuid
import contextlib
import re
import hashlib
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode
from sqlalchemy.orm import Session
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from fastapi import FastAPI, Depends, HTTPException, Request, UploadFile, File, Header
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
from app.auth import hash_password, verify_password, create_access_token, get_current_user, decode_access_token, get_user_by_id
from app.database import get_db, User, Game, OAuthIdentity, OAuthAuthorizationTransaction, FriendshipRequest, Friendship, FriendshipInvite, PsnContact, ManualActivity, SteamSocialSnapshot, engine, wait_for_db
from app.schemas import GameCreate, GameRead, GameUpdate, UserCreate, UserRead, RecommendationRequest, PsnImportConfirmRequest, PsnImportPreview, PsnImportResult, \
    RecommendationResponse, GameCatalogDetail, GameSearchResponse, SteamAccountRead, SteamLibraryRead, SteamLibrarySyncRead, SteamLoginUrl, \
    SteamRecommendationRequest, GamePriceHistory, TelegramAccountRead, TelegramLinkRead, SteamSocialRead, \
    HomeDealResponse, GoogleStatusRead, OAuthLoginUrl, OAuthExchangeRequest
from app.steam import (
    build_steam_login_url,
    create_steam_state,
    decode_steam_state,
    fetch_steam_friends,
    fetch_steam_social_contacts,
    fetch_owned_games,
    fetch_steam_profile,
    verify_steam_openid,
)
from app.crud import list_games, update_game, create_game, get_game, delete_game, get_user_by_email, create_user
from app.schemas import ProfileSettingsRead, ProfileSettingsUpdate, PublicProfileRead, Visibility, FriendshipRequestCreate, FriendshipRequestRespond, FriendshipRequestRead, FriendshipRead, InviteRead, InviteResolveRead, PsnContactCreate, PsnContactRead, ManualActivityUpdate, FriendCard, FriendsContactsRead, ContactSourceStatus
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
    return UserRead(id=user.id, email=user.email, created_at=user.created_at, google_linked=google_linked)


def normalize_public_nickname(nickname: str) -> str:
    normalized = " ".join(nickname.strip().casefold().split())
    if not 3 <= len(normalized) <= 32 or not re.fullmatch(r"[a-z0-9][a-z0-9 _-]*", normalized):
        raise HTTPException(status_code=422, detail="Nickname must be 3-32 characters using letters, numbers, spaces, underscores, or hyphens")
    return normalized


def get_user_by_public_nickname(db: Session, nickname: str) -> User | None:
    return db.query(User).filter(User.public_nickname == nickname).first()


def profile_social_data(db: Session, user: User) -> dict[str, object]:
    platforms = ["steam"] if user.steam_id else []
    recent_games = (
        db.query(Game)
        .filter(Game.owner_id == user.id)
        .order_by(Game.created_at.desc())
        .limit(5)
        .all()
    )
    return {"platforms": platforms, "current_game": None, "recent_games": [game.title for game in recent_games]}


def canonical_friend_pair(first: uuid.UUID, second: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    return tuple(sorted((first, second), key=lambda value: value.hex))


def users_are_friends(db: Session, owner_id: uuid.UUID, viewer_id: uuid.UUID) -> bool:
    if owner_id == viewer_id:
        return False
    low_id, high_id = canonical_friend_pair(owner_id, viewer_id)
    return db.query(Friendship).filter(
        Friendship.user_low_id == low_id, Friendship.user_high_id == high_id
    ).first() is not None


def invite_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def psn_profile_url(online_id: str) -> str:
    return f"https://psnprofiles.com/{online_id}"


def can_view_profile_field(db: Session, owner: User, viewer: User | None, visibility: Visibility | str) -> bool:
    if viewer and viewer.id == owner.id:
        return True
    if visibility == Visibility.everyone or visibility == Visibility.everyone.value:
        return True
    if visibility == Visibility.friends or visibility == Visibility.friends.value:
        return bool(viewer and users_are_friends(db, owner.id, viewer.id))
    return False


def refresh_steam_snapshot(db: Session, user: User, contacts: list[dict] | None, error: str | None = None) -> SteamSocialSnapshot:
    snapshot = db.query(SteamSocialSnapshot).filter(SteamSocialSnapshot.owner_id == user.id).first()
    if not snapshot:
        snapshot = SteamSocialSnapshot(owner_id=user.id, contacts=[])
        db.add(snapshot)
    if contacts is not None:
        snapshot.contacts = contacts
        snapshot.refreshed_at = datetime.now(timezone.utc)
        snapshot.last_error = None
    else:
        snapshot.last_error = (error or "Steam is unavailable")[:255]
    db.commit()
    return snapshot


def build_contacts_response(db: Session, current_user: User) -> FriendsContactsRead:
    friendships = db.query(Friendship).filter(
        or_(Friendship.user_low_id == current_user.id, Friendship.user_high_id == current_user.id)
    ).all()
    friend_ids = [friendship.user_high_id if friendship.user_low_id == current_user.id else friendship.user_low_id for friendship in friendships]
    site_friends = db.query(User).filter(User.id.in_(friend_ids)).all() if friend_ids else []
    activities = {
        activity.owner_id: activity
        for activity in db.query(ManualActivity).filter(ManualActivity.owner_id.in_(friend_ids)).all()
    } if friend_ids else {}
    snapshot = db.query(SteamSocialSnapshot).filter(SteamSocialSnapshot.owner_id == current_user.id).first()
    steam_by_id = {str(item.get("steam_id")): item for item in (snapshot.contacts if snapshot else []) if item.get("steam_id")}
    cards: list[FriendCard] = []
    matched_steam_ids: set[str] = set()
    for friend in site_friends:
        steam = steam_by_id.get(str(friend.steam_id)) if friend.steam_id else None
        if steam and friend.steam_id:
            matched_steam_ids.add(str(friend.steam_id))
        manual = activities.get(friend.id)
        platforms_visible = can_view_profile_field(db, friend, current_user, friend.platforms_visibility)
        current_game = manual.current_game if manual else (steam or {}).get("current_game")
        recent_games = manual.recent_games if manual else (steam or {}).get("recent_games", [])
        cards.append(FriendCard(
            id=f"site:{friend.id}", source="site", nickname=friend.public_nickname,
            steam_id=friend.steam_id if platforms_visible else None,
            avatar=((steam or {}).get("avatar") or friend.steam_avatar) if platforms_visible else None,
            current_game=current_game if can_view_profile_field(db, friend, current_user, friend.current_game_visibility) else None,
            recent_games=recent_games if can_view_profile_field(db, friend, current_user, friend.recent_games_visibility) else [],
        ))
    for contact in db.query(PsnContact).filter(PsnContact.owner_id == current_user.id).order_by(PsnContact.created_at.desc()).all():
        cards.append(FriendCard(id=f"psn:{contact.id}", source="psn", nickname=contact.online_id, profile_url=psn_profile_url(contact.online_id)))
    for steam_id, steam in steam_by_id.items():
        if steam_id not in matched_steam_ids:
            cards.append(FriendCard(id=f"steam:{steam_id}", source="steam", nickname=steam.get("persona_name"), steam_id=steam_id, avatar=steam.get("avatar"), current_game=steam.get("current_game"), recent_games=steam.get("recent_games") or []))
    steam_status = ContactSourceStatus(available=not bool(snapshot and snapshot.last_error), error=snapshot.last_error if snapshot else None)
    return FriendsContactsRead(contacts=cards, sources={"site": ContactSourceStatus(), "psn": ContactSourceStatus(), "steam": steam_status})


def get_optional_current_user(
    authorization: str | None = Header(default=None), db: Session = Depends(get_db)
) -> User | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        payload = decode_access_token(authorization.split(" ", 1)[1])
        user_id = uuid.UUID(payload["sub"])
    except (HTTPException, KeyError, ValueError):
        return None
    return get_user_by_id(db, user_id)


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


def profile_settings_response(user: User) -> ProfileSettingsRead:
    return ProfileSettingsRead(
        nickname=user.public_nickname,
        platforms_visibility=user.platforms_visibility,
        current_game_visibility=user.current_game_visibility,
        recent_games_visibility=user.recent_games_visibility,
    )


@app.get("/profile/me", response_model=ProfileSettingsRead)
def get_profile_settings(current_user: User = Depends(get_current_user)):
    return profile_settings_response(current_user)


@app.patch("/profile/me", response_model=ProfileSettingsRead)
def update_profile_settings(
    settings: ProfileSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updates = settings.model_dump(exclude_unset=True)
    if "nickname" in updates:
        nickname = normalize_public_nickname(updates["nickname"] or "")
        existing = get_user_by_public_nickname(db, nickname)
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=409, detail="Nickname is already in use")
        current_user.public_nickname = nickname
    for field in ("platforms_visibility", "current_game_visibility", "recent_games_visibility"):
        if field in updates:
            setattr(current_user, field, updates[field].value)
    db.commit()
    return profile_settings_response(current_user)


def friendship_request_response(db: Session, request: FriendshipRequest) -> FriendshipRequestRead:
    requester = db.query(User).filter(User.id == request.requester_id).first()
    recipient = db.query(User).filter(User.id == request.recipient_id).first()
    return FriendshipRequestRead(
        id=request.id,
        requester_nickname=requester.public_nickname or "",
        recipient_nickname=recipient.public_nickname or "",
        status=request.status,
        created_at=request.created_at,
    )


@app.post("/friends/requests", status_code=201, response_model=FriendshipRequestRead)
def create_friendship_request(
    data: FriendshipRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipient = get_user_by_public_nickname(db, normalize_public_nickname(data.nickname))
    if not recipient:
        raise HTTPException(status_code=404, detail="Profile not found")
    if recipient.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot add yourself")
    existing = db.query(FriendshipRequest).filter(
        or_(
            (FriendshipRequest.requester_id == current_user.id) & (FriendshipRequest.recipient_id == recipient.id),
            (FriendshipRequest.requester_id == recipient.id) & (FriendshipRequest.recipient_id == current_user.id),
        )
    ).first()
    if existing or users_are_friends(db, current_user.id, recipient.id):
        raise HTTPException(status_code=409, detail="A friendship request or friendship already exists")
    request = FriendshipRequest(requester_id=current_user.id, recipient_id=recipient.id, status="pending")
    db.add(request)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A friendship request or friendship already exists")
    return friendship_request_response(db, request)


@app.get("/friends/requests", response_model=list[FriendshipRequestRead])
def list_friendship_requests(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    requests = db.query(FriendshipRequest).filter(
        FriendshipRequest.status == "pending",
        or_(FriendshipRequest.requester_id == current_user.id, FriendshipRequest.recipient_id == current_user.id),
    ).order_by(FriendshipRequest.created_at.desc()).all()
    return [friendship_request_response(db, request) for request in requests]


@app.post("/friends/requests/{request_id}/respond", response_model=FriendshipRequestRead)
def respond_to_friendship_request(
    request_id: uuid.UUID,
    data: FriendshipRequestRespond,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request = db.query(FriendshipRequest).filter(FriendshipRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Friendship request not found")
    if request.recipient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the recipient can respond")
    if request.status != "pending":
        raise HTTPException(status_code=409, detail="Friendship request is no longer pending")
    request.status = data.action
    if data.action == "accepted":
        low_id, high_id = canonical_friend_pair(request.requester_id, request.recipient_id)
        if not db.query(Friendship).filter(Friendship.user_low_id == low_id, Friendship.user_high_id == high_id).first():
            db.add(Friendship(user_low_id=low_id, user_high_id=high_id))
    db.commit()
    return friendship_request_response(db, request)


@app.post("/friends/requests/{request_id}/cancel", response_model=FriendshipRequestRead)
def cancel_friendship_request(request_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    request = db.query(FriendshipRequest).filter(FriendshipRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Friendship request not found")
    if request.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the requester can cancel")
    if request.status != "pending":
        raise HTTPException(status_code=409, detail="Friendship request is no longer pending")
    request.status = "cancelled"
    db.commit()
    return friendship_request_response(db, request)


@app.get("/friends", response_model=list[FriendshipRead])
def list_friends(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pairs = db.query(Friendship).filter(or_(Friendship.user_low_id == current_user.id, Friendship.user_high_id == current_user.id)).all()
    result = []
    for friendship in pairs:
        friend_id = friendship.user_high_id if friendship.user_low_id == current_user.id else friendship.user_low_id
        friend = db.query(User).filter(User.id == friend_id).first()
        result.append(FriendshipRead(user_id=friend_id, nickname=friend.public_nickname or "", created_at=friendship.created_at))
    return result


@app.delete("/friends/{friend_id}", status_code=204)
def delete_friendship(friend_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    low_id, high_id = canonical_friend_pair(current_user.id, friend_id)
    friendship = db.query(Friendship).filter(Friendship.user_low_id == low_id, Friendship.user_high_id == high_id).first()
    if not friendship:
        raise HTTPException(status_code=404, detail="Friendship not found")
    db.delete(friendship)
    db.commit()


@app.post("/friends/invites", response_model=InviteRead)
def rotate_friendship_invite(request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    token = secrets.token_urlsafe(32)
    digest = invite_digest(token)
    invite = db.query(FriendshipInvite).filter(FriendshipInvite.owner_id == current_user.id).first()
    now = datetime.now(timezone.utc)
    if invite:
        invite.token_digest = digest
        invite.rotated_at = now
    else:
        db.add(FriendshipInvite(owner_id=current_user.id, token_digest=digest, created_at=now, rotated_at=now))
    db.commit()
    return InviteRead(token=token, url=f"{get_frontend_url()}/friends/invite/{token}")


def resolve_invite(db: Session, token: str) -> FriendshipInvite:
    invite = db.query(FriendshipInvite).filter(FriendshipInvite.token_digest == invite_digest(token)).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    return invite


@app.get("/friends/invites/{token}", response_model=InviteResolveRead)
def resolve_friendship_invite(token: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    invite = resolve_invite(db, token)
    owner = db.query(User).filter(User.id == invite.owner_id).first()
    return InviteResolveRead(owner_nickname=owner.public_nickname or "")


@app.post("/friends/invites/{token}/accept", response_model=FriendshipRead)
def accept_friendship_invite(token: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    invite = resolve_invite(db, token)
    if invite.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot accept your own invite")
    if users_are_friends(db, invite.owner_id, current_user.id):
        raise HTTPException(status_code=409, detail="Friendship already exists")
    low_id, high_id = canonical_friend_pair(invite.owner_id, current_user.id)
    friendship = Friendship(user_low_id=low_id, user_high_id=high_id)
    db.add(friendship)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Friendship already exists")
    owner = db.query(User).filter(User.id == invite.owner_id).first()
    return FriendshipRead(user_id=owner.id, nickname=owner.public_nickname or "", created_at=friendship.created_at)


def psn_contact_response(contact: PsnContact) -> PsnContactRead:
    return PsnContactRead(id=contact.id, online_id=contact.online_id, profile_url=psn_profile_url(contact.online_id), created_at=contact.created_at)


@app.post("/friends/psn-contacts", status_code=201, response_model=PsnContactRead)
def create_psn_contact(data: PsnContactCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    normalized = data.online_id.casefold()
    if db.query(PsnContact).filter(PsnContact.owner_id == current_user.id, PsnContact.normalized_online_id == normalized).first():
        raise HTTPException(status_code=409, detail="PSN contact already exists")
    contact = PsnContact(owner_id=current_user.id, online_id=data.online_id, normalized_online_id=normalized)
    db.add(contact)
    db.commit()
    return psn_contact_response(contact)


@app.get("/friends/psn-contacts", response_model=list[PsnContactRead])
def list_psn_contacts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    contacts = db.query(PsnContact).filter(PsnContact.owner_id == current_user.id).order_by(PsnContact.created_at.desc()).all()
    return [psn_contact_response(contact) for contact in contacts]


@app.patch("/friends/psn-contacts/{contact_id}", response_model=PsnContactRead)
def update_psn_contact(
    contact_id: uuid.UUID,
    data: PsnContactCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = db.query(PsnContact).filter(PsnContact.id == contact_id, PsnContact.owner_id == current_user.id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="PSN contact not found")
    normalized = data.online_id.casefold()
    duplicate = db.query(PsnContact).filter(
        PsnContact.owner_id == current_user.id,
        PsnContact.normalized_online_id == normalized,
        PsnContact.id != contact.id,
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="PSN contact already exists")
    contact.online_id = data.online_id
    contact.normalized_online_id = normalized
    db.commit()
    return psn_contact_response(contact)


@app.delete("/friends/psn-contacts/{contact_id}", status_code=204)
def delete_psn_contact(contact_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    contact = db.query(PsnContact).filter(PsnContact.id == contact_id, PsnContact.owner_id == current_user.id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="PSN contact not found")
    db.delete(contact)
    db.commit()


@app.get("/activity/manual", response_model=ManualActivityUpdate)
def get_manual_activity(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    activity = db.query(ManualActivity).filter(ManualActivity.owner_id == current_user.id).first()
    if not activity:
        return ManualActivityUpdate()
    return ManualActivityUpdate(current_game=activity.current_game, recent_games=activity.recent_games)


@app.patch("/activity/manual", response_model=ManualActivityUpdate)
def update_manual_activity(
    data: ManualActivityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    activity = db.query(ManualActivity).filter(ManualActivity.owner_id == current_user.id).first()
    if not activity:
        activity = ManualActivity(owner_id=current_user.id, current_game=data.current_game, recent_games=data.recent_games)
        db.add(activity)
    else:
        activity.current_game = data.current_game
        activity.recent_games = data.recent_games
    db.commit()
    return ManualActivityUpdate(current_game=activity.current_game, recent_games=activity.recent_games)


@app.delete("/activity/manual", status_code=204)
def delete_manual_activity(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    activity = db.query(ManualActivity).filter(ManualActivity.owner_id == current_user.id).first()
    if activity:
        db.delete(activity)
        db.commit()


@app.get("/friends/contacts", response_model=FriendsContactsRead)
def get_friends_contacts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return build_contacts_response(db, current_user)


@app.post("/friends/steam/sync", response_model=FriendsContactsRead)
async def sync_steam_contacts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.steam_id:
        raise HTTPException(status_code=409, detail="Connect Steam first")
    try:
        contacts = await fetch_steam_social_contacts(current_user.steam_id)
        refresh_steam_snapshot(db, current_user, contacts)
    except HTTPException as exc:
        refresh_steam_snapshot(db, current_user, None, str(exc.detail))
    except Exception:
        refresh_steam_snapshot(db, current_user, None, "Steam refresh failed")
    return build_contacts_response(db, current_user)


@app.get("/profiles/{nickname}", response_model=PublicProfileRead)
def get_public_profile(
    nickname: str,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_optional_current_user),
):
    profile = get_user_by_public_nickname(db, normalize_public_nickname(nickname))
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    data = profile_social_data(db, profile)
    return PublicProfileRead(
        nickname=profile.public_nickname,
        platforms=data["platforms"] if can_view_profile_field(db, profile, viewer, profile.platforms_visibility) else [],
        current_game=data["current_game"] if can_view_profile_field(db, profile, viewer, profile.current_game_visibility) else None,
        recent_games=data["recent_games"] if can_view_profile_field(db, profile, viewer, profile.recent_games_visibility) else [],
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
                user = User(email=email, password_hash=None)
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
                email=steam_sign_in_email(steam_id), password_hash=None, steam_id=steam_id,
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
