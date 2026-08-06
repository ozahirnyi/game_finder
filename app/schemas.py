from pydantic import BaseModel, ConfigDict, Field, model_validator
from datetime import datetime
from typing import Literal, Optional
import uuid


class GameCreate(BaseModel):
    title: str = Field(max_length=255)
    notes: Optional[str] = Field(default=None, max_length=255)
    info: Optional[str] = Field(default=None, max_length=500)


class PriceAlertCreate(BaseModel):
    identity_kind: Literal["rawg", "steam"]
    identity_value: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=255)
    mode: Literal["target_price", "target_discount", "any_discount"]
    threshold: float | None = Field(default=None, gt=0)
    in_app: bool = True
    telegram: bool = False

    @model_validator(mode="after")
    def validate_threshold(self):
        if self.mode == "any_discount" and self.threshold is not None:
            raise ValueError("any_discount must not have a threshold")
        if self.mode != "any_discount" and self.threshold is None:
            raise ValueError("A target price or discount is required")
        if not self.in_app and not self.telegram:
            raise ValueError("Choose at least one delivery channel")
        return self


class WishlistItemCreate(BaseModel):
    identity_kind: Literal["rawg", "steam"]
    identity_value: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=255)


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
    rawg_id: int | None = None
    steam_appid: int | None = None
    steam_url: str | None = None


class RecommendationResponse(BaseModel):
    recommendations: list[RecommendationItem] = Field(default_factory=list)


class GameSearchItem(BaseModel):
    id: int | None = None
    name: str | None = None
    released: str | None = None
    background_image: str | None = None
    source: str | None = None
    steam_appid: int | None = None
    url: str | None = None


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
