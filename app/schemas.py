from pydantic import BaseModel, ConfigDict, Field, model_validator
from datetime import datetime
from typing import Any, Literal, Optional
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
    display_name: str
    created_at: datetime
    google_linked: bool = False


class UserProfileRead(UserRead):
    bio: str | None = None
    platforms: list[str] = Field(default_factory=list)
    favorite_genres: list[str] = Field(default_factory=list)


class UserProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=3, max_length=64, pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]*$")
    bio: str | None = Field(default=None, max_length=1000)
    platforms: list[str] | None = Field(default=None, max_length=20)
    favorite_genres: list[str] | None = Field(default=None, max_length=20)


class DataBlock(BaseModel):
    status: Literal["ready", "empty", "not_connected", "error"]
    data: Any = None
    message: str | None = None


class DashboardRead(BaseModel):
    user: DataBlock
    library: DataBlock
    recommendations: DataBlock
    deals: DataBlock
    steam: DataBlock
    social: DataBlock
    activity: DataBlock


class ProfileSummaryRead(BaseModel):
    account: DataBlock
    profile: DataBlock
    services: DataBlock
    library: DataBlock
    favorites: DataBlock
    wishlist: DataBlock
    recently_played: DataBlock


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


class PublicUserRead(BaseModel):
    id: uuid.UUID
    display_name: str
    bio: str | None = None
    avatar: str | None = None


class FriendRequestCreate(BaseModel):
    recipient_id: uuid.UUID
    message: str | None = Field(default=None, max_length=280)


class FriendRequestRead(BaseModel):
    id: uuid.UUID
    sender: PublicUserRead
    recipient: PublicUserRead
    message: str | None = None
    created_at: datetime


class FriendshipRead(BaseModel):
    user: PublicUserRead
    created_at: datetime


class ConversationCreate(BaseModel):
    recipient_id: uuid.UUID


class ConversationRead(BaseModel):
    id: uuid.UUID
    participant: PublicUserRead
    updated_at: datetime
    unread_count: int = 0
    last_message: str | None = None


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class MessageRead(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    body: str
    created_at: datetime
    read_at: datetime | None = None


class GameInviteCreate(BaseModel):
    recipient_id: uuid.UUID
    game_name: str = Field(min_length=1, max_length=255)
    game_id: int | None = None
    note: str | None = Field(default=None, max_length=280)


class GameInviteRead(BaseModel):
    id: uuid.UUID
    sender: PublicUserRead
    recipient: PublicUserRead
    game_name: str
    game_id: int | None = None
    note: str | None = None
    status: str
    created_at: datetime
    responded_at: datetime | None = None


class InviteResponseUpdate(BaseModel):
    status: Literal["accepted", "declined"]


class NotificationRead(BaseModel):
    id: uuid.UUID
    type: str
    payload: dict[str, Any] = Field(default_factory=dict)
    read_at: datetime | None = None
    created_at: datetime


class InviteLinkRead(BaseModel):
    url: str


class CatalogCollectionCreate(BaseModel):
    catalog_game_id: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=255)
    cover_url: str | None = Field(default=None, max_length=1000)


class CatalogCollectionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    cover_url: str | None = Field(default=None, max_length=1000)


class CatalogCollectionRead(BaseModel):
    id: uuid.UUID
    catalog_game_id: int
    title: str
    cover_url: str | None = None
    created_at: datetime
    updated_at: datetime | None = None


class PriceAlertCreate(BaseModel):
    wishlist_catalog_game_id: int = Field(ge=1)
    target_price: float | None = Field(default=None, gt=0)
    target_discount: int | None = Field(default=None, ge=1, le=100)
    delivery_channels: list[Literal["in_app", "telegram"]] = Field(default_factory=lambda: ["in_app"], min_length=1, max_length=2)

    @model_validator(mode="after")
    def require_target(self):
        if self.target_price is None and self.target_discount is None:
            raise ValueError("Set a target price or discount")
        return self


class PriceAlertUpdate(BaseModel):
    target_price: float | None = Field(default=None, gt=0)
    target_discount: int | None = Field(default=None, ge=1, le=100)
    delivery_channels: list[Literal["in_app", "telegram"]] | None = Field(default=None, min_length=1, max_length=2)

    @model_validator(mode="after")
    def require_target_when_replacing(self):
        if self.target_price is None and self.target_discount is None and self.delivery_channels is None:
            raise ValueError("Provide at least one alert setting")
        return self


class PriceAlertRead(BaseModel):
    id: uuid.UUID
    wishlist_catalog_game_id: int
    target_price: float | None = None
    target_discount: int | None = None
    delivery_channels: list[str] = Field(default_factory=list)
    last_delivered_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
