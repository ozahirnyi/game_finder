from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
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


class LibraryGameRead(BaseModel):
    id: str
    source: Literal["manual", "psn", "steam"]
    external_id: str | None = None
    catalog_game_id: int | None = None
    link_state: Literal["linked", "raw"] | None = None
    catalog_lookup_state: Literal["review", "no_match", "skipped"] | None = None
    detail_game_id: str | None = None
    title: str
    cover_url: str | None = None
    playtime_forever: int | None = None


class LibraryOverviewRead(BaseModel):
    games: list[LibraryGameRead] = Field(default_factory=list)
    steam_available: bool = False
    steam_error: str | None = None
    raw_count: int = 0
    quarantined_count: int = 0
    pending_catalog_count: int = 0


class SteamLibraryResolveRead(BaseModel):
    game_id: int


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
    public_nickname: str | None = None


Visibility = Literal["private", "friends", "public"]


class UserProfileRead(UserRead):
    bio: str | None = None
    platforms: list[str] = Field(default_factory=list)
    favorite_genres: list[str] = Field(default_factory=list)
    library_visibility: Visibility = "public"
    favorites_visibility: Visibility = "public"
    wishlist_visibility: Visibility = "public"
    steam_visibility: Visibility = "public"


class UserProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=3, max_length=64, pattern=r"^[A-Za-z0-9][A-Za-z0-9 _-]*$")
    bio: str | None = Field(default=None, max_length=1000)
    platforms: list[str] | None = Field(default=None, max_length=20)
    favorite_genres: list[str] | None = Field(default=None, max_length=20)
    library_visibility: Visibility | None = None
    favorites_visibility: Visibility | None = None
    wishlist_visibility: Visibility | None = None
    steam_visibility: Visibility | None = None


class DataBlock(BaseModel):
    status: Literal["ready", "empty", "not_connected", "error"]
    data: Any = None
    message: str | None = None


class PublicDataBlock(BaseModel):
    status: Literal["ready", "empty", "hidden"]
    data: Any = None
    message: str | None = None


class PublicLibraryGameRead(BaseModel):
    id: uuid.UUID
    title: str
    source: str
    cover_url: str | None = None
    playtime_forever: int | None = None
    detail_game_id: str | None = None


class PublicSteamAccountRead(BaseModel):
    linked: bool
    persona_name: str | None = None
    avatar: str | None = None
    profile_url: str | None = None


class PublicProfileRead(BaseModel):
    public_id: str
    nickname: str
    avatar: str | None = None
    relationship: str
    library: PublicDataBlock
    favorites: PublicDataBlock
    wishlist: PublicDataBlock
    steam: PublicDataBlock


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


class OnboardingSummaryRead(BaseModel):
    steam_linked: bool
    psn_library_games: int
    wishlist_games: int
    price_alerts: int
    friends: int


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


class SocialFriendRequestCreate(BaseModel):
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
    igdb_id: int | None = None
    cover_url: str | None = None


class RecommendationResponse(BaseModel):
    recommendations: list[RecommendationItem] = Field(default_factory=list)
    cache_expires_at: datetime | None = None


class GameSearchItem(BaseModel):
    id: int | None = None
    name: str | None = None
    released: str | None = None
    background_image: str | None = None
    source: str | None = None
    steam_appid: int | None = None
    url: str | None = None
    rating: float | None = None
    genres: list[str] = Field(default_factory=list)
    platforms: list[str] = Field(default_factory=list)
    current: dict | None = None


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
    public_id: str | None = None
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


class PsnImportPreviewItem(BaseModel):
    source_title: str
    status: Literal["matched", "needs_mapping", "suggested_skip", "catalog_unavailable"]
    recommended_action: Literal["catalog", "raw", "skip"]
    igdb_id: int | None = None
    title: str | None = None
    reason: str | None = None
    suggestions: list[dict] = Field(default_factory=list)
    candidate_token: str


class PsnImportPreview(BaseModel):
    items: list[PsnImportPreviewItem] = Field(default_factory=list)
    games: list[str] = Field(default_factory=list)
    total: int = 0
    confirmed_total: int = 0
    message: str | None = None


class PsnImportSelection(BaseModel):
    candidate_token: str = Field(min_length=1, max_length=4096)
    action: Literal["catalog", "raw"]
    catalog_id: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def require_catalog_id_for_catalog_action(self):
        if self.action == "catalog" and self.catalog_id is None:
            raise ValueError("catalog_id is required for catalog imports")
        if self.action == "raw" and self.catalog_id is not None:
            raise ValueError("catalog_id is not valid for RAW imports")
        return self


class PsnImportConfirmRequest(BaseModel):
    selections: list[PsnImportSelection] = Field(min_length=1, max_length=500)


class PsnImportResult(BaseModel):
    created: int = 0
    updated: int = 0
    skipped: int = 0
    total: int = 0


class PsnLibraryRepairItem(BaseModel):
    game_id: uuid.UUID
    title: str
    link_state: Literal["linked", "raw", "quarantined"]
    catalog_game_id: int | None = None
    suggestion: Literal["linked", "auto_link", "review", "quarantine", "unavailable"]
    suggestions: list[dict] = Field(default_factory=list)
    reason: str | None = None


class PsnLibraryRepairPreview(BaseModel):
    items: list[PsnLibraryRepairItem] = Field(default_factory=list)
    raw_count: int = 0
    quarantined_count: int = 0


class PsnLibraryRepairDecision(BaseModel):
    game_id: uuid.UUID
    action: Literal["link", "keep_raw", "quarantine", "restore", "delete"]
    catalog_id: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validate_catalog_action(self):
        if self.action == "link" and self.catalog_id is None:
            raise ValueError("catalog_id is required when linking")
        if self.action != "link" and self.catalog_id is not None:
            raise ValueError("catalog_id is only valid when linking")
        return self


class PsnLibraryRepairApplyRequest(BaseModel):
    decisions: list[PsnLibraryRepairDecision] = Field(min_length=1, max_length=500)


class PsnCatalogEnrichmentResult(BaseModel):
    attempted: int = 0
    linked: int = 0
    review: int = 0
    quarantined: int = 0
    remaining: int = 0


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

class PriceHistoryPoint(BaseModel):
    timestamp: str | None = None
    shop: str | None = None
    price: PriceMoney | None = None
    regular: PriceMoney | None = None


class GamePriceHistory(BaseModel):
    itad_id: str
    title: str
    url: str | None = None
    current: PriceDeal | None = None
    history_low_all: PriceMoney | None = None
    history_low_1y: PriceMoney | None = None
    history_low_3m: PriceMoney | None = None
    deals: list[PriceDeal] = Field(default_factory=list)
    history: list[PriceHistoryPoint] = Field(default_factory=list)


class SteamStoreGameDetail(BaseModel):
    appid: int
    name: str
    background_image: str | None = None
    description_raw: str | None = None
    genres: list[str] = Field(default_factory=list)
    platforms: list[str] = Field(default_factory=lambda: ["PC"])
    released: str | None = None
    rating: float | None = None
    catalog_game_id: int | None = None
    current: PriceDeal | None = None
    url: str | None = None


class HomeDealItem(BaseModel):
    id: int | None = None
    steam_appid: int | None = None
    name: str
    released: str | None = None
    background_image: str | None = None
    url: str | None = None
    current: PriceDeal | None = None
    history_low_all: PriceMoney | None = None


class HomeDealResponse(BaseModel):
    results: list[HomeDealItem] = Field(default_factory=list)
    cached_at: datetime | None = None


class GenreDealSection(BaseModel):
    genre: str
    results: list[HomeDealItem] = Field(default_factory=list)


class GenreDealResponse(BaseModel):
    popular: list[HomeDealItem] = Field(default_factory=list)
    sections: list[GenreDealSection] = Field(default_factory=list)


class PublicUserRead(BaseModel):
    id: uuid.UUID
    public_id: str
    display_name: str
    steam_persona_name: str | None = None
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


class SharedGameRead(BaseModel):
    source: str
    external_id: str
    title: str
    cover_url: str | None = None


class SharedLibraryRead(BaseModel):
    status: Literal["ready", "empty", "private", "disconnected", "error"]
    data: list[SharedGameRead] = Field(default_factory=list)
    message: str | None = None


class FriendSocialSummaryRead(BaseModel):
    shared_games: int
    compatibility_percent: int
    wishlist_count: int | None = None


class FriendActivityRead(BaseModel):
    type: Literal["message", "game_invite"]
    text: str
    created_at: datetime


class FriendProfileRead(BaseModel):
    user: PublicUserRead
    library: PublicDataBlock


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
    source: str | None = Field(default=None, min_length=1, max_length=32)
    external_id: str | None = Field(default=None, min_length=1, max_length=255)
    note: str | None = Field(default=None, max_length=280)


class GameInviteRead(BaseModel):
    id: uuid.UUID
    sender: PublicUserRead
    recipient: PublicUserRead
    game_name: str
    game_id: int | None = None
    source: str | None = None
    external_id: str | None = None
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
    source: str = "catalog"
    external_id: str
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
