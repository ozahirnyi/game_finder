from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import datetime
from typing import Optional
import uuid


class GameCreate(BaseModel):
    title: str = Field(max_length=255)
    notes: Optional[str] = Field(default=None, max_length=255)
    info: Optional[str] = Field(default=None, max_length=500)


class GameRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    notes: Optional[str] = None
    info: Optional[str] = None
    source: str = "manual"
    external_id: Optional[str] = None
    playtime_forever: Optional[int] = None
    playtime_2weeks: Optional[int] = None
    img_icon_url: Optional[str] = None
    synced_at: Optional[datetime] = None
    created_at: datetime


class GameUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = Field(default=None, max_length=255)


class UserCreate(BaseModel):
    email: str
    password: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    created_at: datetime
    google_linked: bool = False


class UserLogin(BaseModel):
    email: str
    password: str


class SocialProfileUpdate(BaseModel):
    nickname: str = Field(
        min_length=3,
        max_length=32,
        pattern=r"^[A-Za-z0-9_]+$",
        description="3-32 ASCII letters, digits, or underscores",
    )

    @field_validator("nickname", mode="before")
    @classmethod
    def trim_nickname(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class SocialPlayerRead(BaseModel):
    public_id: str
    nickname: str
    avatar: str | None = None


class SocialPlayersPageRead(BaseModel):
    players: list[SocialPlayerRead] = Field(default_factory=list)
    next_cursor: str | None = None


class SocialFriendRead(SocialPlayerRead):
    id: uuid.UUID


class SocialRequestRead(SocialPlayerRead):
    id: uuid.UUID
    status: str
    created_at: datetime


class SocialProfileRead(SocialPlayerRead):
    relationship: str


class SocialMeRead(BaseModel):
    public_id: str
    nickname: str | None = None
    avatar: str | None = None
    friends: list[SocialFriendRead] = Field(default_factory=list)
    incoming_requests: list[SocialRequestRead] = Field(default_factory=list)
    outgoing_requests: list[SocialRequestRead] = Field(default_factory=list)


class SocialCommonGameRead(BaseModel):
    appid: int
    name: str
    img_icon_url: str | None = None


class SocialCommonGamesRead(BaseModel):
    games: list[SocialCommonGameRead] = Field(default_factory=list)


class FriendRequestCreate(BaseModel):
    public_id: str = Field(min_length=1, max_length=32)


class DirectMessageCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)

    @field_validator("text", mode="before")
    @classmethod
    def trim_and_require_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class DirectMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    friendship_id: uuid.UUID
    author_id: uuid.UUID
    text: str
    created_at: datetime


class DirectMessagePageRead(BaseModel):
    messages: list[DirectMessageRead] = Field(default_factory=list)
    next_cursor: uuid.UUID | None = None


class GoogleStatusRead(BaseModel):
    configured: bool


class OAuthLoginUrl(BaseModel):
    url: str


class OAuthExchangeRequest(BaseModel):
    exchange_code: str = Field(min_length=20, max_length=128)


class RecommendationRequest(BaseModel):
    prompt: str
    liked_game_ids: list[int] = Field(default_factory=list)


class RecommendationItem(BaseModel):
    title: str
    reason: str
    tags: list[str] = Field(default_factory=list)


class RecommendationResponse(BaseModel):
    recommendations: list[RecommendationItem] = Field(default_factory=list)


class GameSearchItem(BaseModel):
    id: int | None = None
    name: str | None = None
    released: str | None = None
    background_image: str | None = None


class GameSearchResponse(BaseModel):
    results: list[GameSearchItem]


class GameCatalogDetail(BaseModel):
    id: int
    name: str
    released: str | None = None
    background_image: str | None = None
    description_raw: str | None = None
    rating: float | None = None
    genres: list[str] = Field(default_factory=list)
    platforms: list[str] = Field(default_factory=list)


class SteamLoginUrl(BaseModel):
    url: str


class SteamAccountRead(BaseModel):
    linked: bool
    steam_id: str | None = None
    persona_name: str | None = None
    avatar: str | None = None
    country_code: str | None = None
    linked_at: datetime | None = None


class SteamGameRead(BaseModel):
    appid: int
    name: str
    playtime_forever: int = 0
    playtime_2weeks: int = 0
    img_icon_url: str | None = None


class SteamLibraryRead(BaseModel):
    steam: SteamAccountRead
    games: list[SteamGameRead] = Field(default_factory=list)


class SteamLibrarySyncRead(SteamLibraryRead):
    created: int = 0
    updated: int = 0
    removed: int = 0
    synced_at: datetime | None = None


class SteamFriendGameRead(BaseModel):
    appid: int
    name: str
    friends: int = 0
    total_playtime_forever: int = 0
    img_icon_url: str | None = None


class SteamFriendRead(BaseModel):
    steam_id: str
    persona_name: str | None = None
    avatar: str | None = None
    friend_since: int | None = None
    library_public: bool = False
    games_count: int = 0
    common_games_count: int = 0
    taste_match_percent: int = 0
    common_games: list[SteamGameRead] = Field(default_factory=list)
    top_games: list[SteamGameRead] = Field(default_factory=list)


class SteamSocialRead(BaseModel):
    steam: SteamAccountRead
    friends: list[SteamFriendRead] = Field(default_factory=list)
    friends_total: int = 0
    friends_has_more: bool = False
    top_friend_games: list[SteamFriendGameRead] = Field(default_factory=list)
    public_libraries: int = 0
    private_libraries: int = 0


class SteamRecommendationRequest(BaseModel):
    prompt: str | None = Field(default=None, max_length=500)


class PsnImportPreview(BaseModel):
    games: list[str] = Field(default_factory=list)
    total: int = 0
    message: str | None = None


class PsnImportConfirmRequest(BaseModel):
    games: list[str] = Field(min_length=1, max_length=500)


class PsnImportResult(BaseModel):
    created: int = 0
    updated: int = 0
    skipped: int = 0
    total: int = 0


class TelegramAccountRead(BaseModel):
    linked: bool
    configured: bool
    username: str | None = None
    linked_at: datetime | None = None


class TelegramLinkRead(BaseModel):
    configured: bool
    url: str | None = None
    message: str | None = None


class PriceMoney(BaseModel):
    amount: float
    currency: str


class PriceDeal(BaseModel):
    shop: str | None = None
    price: PriceMoney | None = None
    regular: PriceMoney | None = None
    cut: int | None = None
    url: str | None = None
    timestamp: str | None = None


class GamePriceHistory(BaseModel):
    itad_id: str
    title: str
    url: str | None = None
    current: PriceDeal | None = None
    history_low_all: PriceMoney | None = None
    history_low_1y: PriceMoney | None = None
    history_low_3m: PriceMoney | None = None
    deals: list[PriceDeal] = Field(default_factory=list)


class HomeDealItem(BaseModel):
    id: int | None = None
    name: str
    released: str | None = None
    background_image: str | None = None
    url: str | None = None
    current: PriceDeal | None = None
    history_low_all: PriceMoney | None = None


class HomeDealResponse(BaseModel):
    results: list[HomeDealItem] = Field(default_factory=list)
