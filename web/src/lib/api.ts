export type UserRead = {
  id: string;
  email: string;
  created_at: string;
  google_linked: boolean;
};

export type GoogleStatus = { configured: boolean };
export type OAuthLoginUrl = { url: string };

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type SearchGame = {
  id: number | null;
  name: string | null;
  released: string | null;
  background_image: string | null;
};

export type SearchResponse = {
  results: SearchGame[];
};

export type CatalogGame = {
  id: number;
  name: string;
  released: string | null;
  background_image: string | null;
  description_raw: string | null;
  rating: number | null;
  genres: string[];
  platforms: string[];
};

export type PriceMoney = {
  amount: number;
  currency: string;
};

export type PriceDeal = {
  shop: string | null;
  price: PriceMoney | null;
  regular: PriceMoney | null;
  cut: number | null;
  url: string | null;
  timestamp: string | null;
};

export type GamePriceHistory = {
  itad_id: string;
  title: string;
  url: string | null;
  current: PriceDeal | null;
  history_low_all: PriceMoney | null;
  history_low_1y: PriceMoney | null;
  history_low_3m: PriceMoney | null;
  deals: PriceDeal[];
};

export type HomeDeal = {
  id: number | null;
  name: string;
  released: string | null;
  background_image: string | null;
  url: string | null;
  current: PriceDeal | null;
  history_low_all: PriceMoney | null;
};

export type HomeDealResponse = {
  results: HomeDeal[];
};

export type SavedGame = {
  id: string;
  title: string;
  notes: string | null;
  info: string | null;
  source: "manual" | "steam" | "psn";
  external_id: string | null;
  playtime_forever: number | null;
  playtime_2weeks: number | null;
  img_icon_url: string | null;
  synced_at: string | null;
  created_at: string;
};

export type PsnImportPreview = {
  games: string[];
  total: number;
  message: string | null;
};

export type PsnImportResult = {
  created: number;
  updated: number;
  skipped: number;
  total: number;
};

export type RecommendationItem = {
  title: string;
  reason: string;
  tags: string[];
};

export type RecommendationResponse = {
  recommendations: RecommendationItem[];
};

export type SteamLoginUrl = {
  url: string;
};

export type SteamAccount = {
  linked: boolean;
  steam_id: string | null;
  persona_name: string | null;
  avatar: string | null;
  country_code: string | null;
  linked_at: string | null;
};

export type SteamGame = {
  appid: number;
  name: string;
  playtime_forever: number;
  playtime_2weeks: number;
  img_icon_url: string | null;
};

export type SteamLibrary = {
  steam: SteamAccount;
  games: SteamGame[];
};

export type SteamLibrarySync = SteamLibrary & {
  created: number;
  updated: number;
  removed: number;
  synced_at: string | null;
};

export type SteamFriendGame = {
  appid: number;
  name: string;
  friends: number;
  total_playtime_forever: number;
  img_icon_url: string | null;
};

export type SteamFriend = {
  steam_id: string;
  persona_name: string | null;
  avatar: string | null;
  friend_since: number | null;
  library_public: boolean;
  games_count: number;
  common_games_count: number;
  taste_match_percent: number;
  common_games: SteamGame[];
  top_games: SteamGame[];
};

export type SteamSocial = {
  steam: SteamAccount;
  friends: SteamFriend[];
  top_friend_games: SteamFriendGame[];
  public_libraries: number;
  private_libraries: number;
};

export type TelegramAccount = {
  linked: boolean;
  configured: boolean;
  username: string | null;
  linked_at: string | null;
};

export type TelegramLink = {
  configured: boolean;
  url: string | null;
  message: string | null;
};

export type PublicUser = { id: string; display_name: string; bio: string | null; avatar: string | null };
export type FriendRequest = { id: string; sender: PublicUser; recipient: PublicUser; message: string | null; created_at: string };
export type Friendship = { user: PublicUser; created_at: string };
export type Conversation = { id: string; participant: PublicUser; updated_at: string; unread_count: number; last_message: string | null };
export type ConversationMessage = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string; read_at: string | null };
export type GameInvite = { id: string; sender: PublicUser; recipient: PublicUser; game_name: string; game_id: number | null; note: string | null; status: "pending" | "accepted" | "declined"; created_at: string; responded_at: string | null };
export type Notification = { id: string; type: string; payload: Record<string, unknown>; read_at: string | null; created_at: string };
export type InviteLink = { url: string };
export type CatalogCollectionItem = { id: string; catalog_game_id: number; title: string; cover_url: string | null; created_at: string; updated_at: string | null };
export type PriceAlert = { id: string; wishlist_catalog_game_id: number; target_price: number | null; target_discount: number | null; delivery_channels: string[]; last_delivered_at: string | null; created_at: string; updated_at: string };

export type BlockStatus = "ready" | "empty" | "not_connected" | "error";
export type DataBlock<T> = { status: BlockStatus; data: T | null; message?: string | null };
export type LibraryStats = { games: SavedGame[]; total_games: number; total_playtime_hours: number; manual_games: number; psn_games: number };
export type UserProfile = { bio: string | null; platforms: string[]; favorite_genres: string[] };
export type DashboardResponse = {
  user: DataBlock<UserRead>;
  library: DataBlock<LibraryStats>;
  recommendations: DataBlock<RecommendationResponse>;
  deals: DataBlock<HomeDealResponse>;
  steam: DataBlock<SteamLibrary | SteamAccount>;
  social: DataBlock<SteamSocial>;
  activity?: DataBlock<unknown[]>;
};
export type ProfileSummaryResponse = {
  account: DataBlock<UserRead | { user: UserRead }>;
  profile: DataBlock<UserProfile>;
  services: DataBlock<{ steam: SteamAccount; telegram: TelegramAccount; google: { linked: boolean }; psn_games: number }>;
  library: DataBlock<LibraryStats>;
  favorites: DataBlock<SavedGame[]>;
  wishlist: DataBlock<SavedGame[]>;
  recently_played: DataBlock<SteamGame[]>;
};

const API_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "https://game-finder.up.railway.app").replace(/\/+$/, "");
const TOKEN_KEY = "game_finder_token";
const AUTH_EVENT = "game-finder-auth";

type RequestOptions = {
  method?: string;
  auth?: boolean;
  body?: unknown;
  formBody?: BodyInit;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

function removeStoredToken() {
  window.localStorage.removeItem(TOKEN_KEY);
  notifyAuthChanged();
}

function isTokenExpired(token: string) {
  const [, payload] = token.split(".");
  if (!payload) {
    return true;
  }

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = window.atob(normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, "="));
    const data = JSON.parse(json) as { exp?: unknown };
    return typeof data.exp === "number" && data.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function getToken() {
  if (typeof window === "undefined") {
    return null;
  }
  const token = window.localStorage.getItem(TOKEN_KEY);
  if (token && isTokenExpired(token)) {
    removeStoredToken();
    return null;
  }
  return token;
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
  notifyAuthChanged();
}

export function clearToken() {
  removeStoredToken();
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export function subscribeToAuthChanges(callback: () => void) {
  window.addEventListener(AUTH_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(AUTH_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function getAuthSnapshot() {
  return isAuthenticated();
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.auth) {
    const token = getToken();
    if (!token) {
      throw new ApiError("Please log in first.", 401);
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.formBody ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    const payload = contentType.includes("application/json") ? await response.json() : null;
    const responseText = payload === null ? await response.text() : "";
    const detail = payload?.detail;
    let message = Array.isArray(detail)
      ? detail.map((item) => item.msg ?? JSON.stringify(item)).join(", ")
      : detail ?? (responseText || `Request failed with status ${response.status}`);
    if (options.auth && response.status === 401) {
      removeStoredToken();
      message = "Your session expired. Please log in again.";
    }
    throw new ApiError(message, response.status);
  }

  return (contentType.includes("application/json") ? await response.json() : null) as T;
}

export function registerUser(email: string, password: string) {
  return request<UserRead>("/auth/register", {
    method: "POST",
    body: { email, password },
  });
}

export function loginUser(email: string, password: string) {
  const formBody = new URLSearchParams();
  formBody.set("username", email);
  formBody.set("password", password);
  return request<TokenResponse>("/auth/login", {
    method: "POST",
    formBody,
  });
}

export function getCurrentUser() {
  return request<UserRead>("/auth/me", { auth: true });
}

export function getDashboard() {
  return request<DashboardResponse>("/dashboard", { auth: true });
}

export function getProfileSummary() {
  return request<ProfileSummaryResponse>("/profile/summary", { auth: true });
}

export function updateProfile(profile: UserProfile) {
  return request<UserProfile>("/profile", { method: "PATCH", auth: true, body: profile });
}

export function getGoogleStatus() {
  return request<GoogleStatus>("/auth/google/status");
}

export function getGoogleLoginUrl() {
  return request<OAuthLoginUrl>("/auth/google/login-url");
}

export function getGoogleLinkUrl() {
  return request<OAuthLoginUrl>("/auth/google/link-url", { method: "POST", auth: true });
}

export function exchangeGoogleCode(exchangeCode: string) {
  return request<TokenResponse>("/auth/google/exchange", { method: "POST", body: { exchange_code: exchangeCode } });
}

export function getSteamSignInUrl() {
  return request<OAuthLoginUrl>("/auth/steam/login-url");
}

export function exchangeSteamCode(exchangeCode: string) {
  return request<TokenResponse>("/auth/steam/exchange", { method: "POST", body: { exchange_code: exchangeCode } });
}

export function searchGames(query: string) {
  return request<SearchResponse>(`/search/games?q=${encodeURIComponent(query)}`);
}

export function getUpcomingGames(pageSize = 8) {
  return request<SearchResponse>(`/catalog/upcoming-games?page_size=${encodeURIComponent(pageSize)}`);
}

export function getTrendingGames(pageSize = 8) {
  return request<SearchResponse>(`/catalog/trending-games?page_size=${encodeURIComponent(pageSize)}`);
}

export function getRecommendations(prompt: string) {
  return request<RecommendationResponse>("/recommendations", {
    method: "POST",
    body: { prompt, liked_game_ids: [] },
  });
}

export function getCatalogGame(id: string) {
  return request<CatalogGame>(`/catalog/games/${encodeURIComponent(id)}`);
}

export function getGamePriceHistory(id: string, country = "US") {
  return request<GamePriceHistory>(`/prices/games/${encodeURIComponent(id)}?country=${encodeURIComponent(country)}`);
}

export function getHomepageDeals(country = "US", pageSize = 6) {
  return request<HomeDealResponse>(
    `/prices/deals?country=${encodeURIComponent(country)}&page_size=${encodeURIComponent(pageSize)}`
  );
}

export function listSavedGames() {
  return request<SavedGame[]>("/games", { auth: true });
}

export function getSavedGame(id: string) {
  return request<SavedGame>(`/games/${id}`, { auth: true });
}

export function createSavedGame(title: string, info?: string, notes = "") {
  return request<SavedGame>("/games", {
    method: "POST",
    auth: true,
    body: { title, notes, info },
  });
}

export function updateSavedGame(id: string, notes: string) {
  return request<SavedGame>(`/games/${id}`, {
    method: "PATCH",
    auth: true,
    body: { notes },
  });
}

export function deleteSavedGame(id: string) {
  return request<void>(`/games/${id}`, {
    method: "DELETE",
    auth: true,
  });
}

export function previewPsnImport(file: File) {
  const formBody = new FormData();
  formBody.set("file", file);
  return request<PsnImportPreview>("/psn/import/preview", {
    method: "POST",
    auth: true,
    formBody,
  });
}

export function confirmPsnImport(games: string[]) {
  return request<PsnImportResult>("/psn/import/confirm", {
    method: "POST",
    auth: true,
    body: { games },
  });
}

export function getSteamLoginUrl() {
  return request<SteamLoginUrl>("/steam/login-url", { auth: true });
}

export function getSteamAccount() {
  return request<SteamAccount>("/steam/me", { auth: true });
}

export function unlinkSteamAccount() {
  return request<SteamAccount>("/steam/me", {
    method: "DELETE",
    auth: true,
  });
}

export function getSteamLibrary() {
  return request<SteamLibrary>("/steam/library", { auth: true });
}

export function syncSteamLibrary() {
  return request<SteamLibrarySync>("/steam/library/sync", { method: "POST", auth: true });
}

export function getSteamSocial(friendsLimit = 12) {
  return request<SteamSocial>(`/steam/social?friends_limit=${encodeURIComponent(friendsLimit)}`, { auth: true });
}

export function getSteamRecommendations(prompt?: string) {
  return request<RecommendationResponse>("/steam/recommendations", {
    method: "POST",
    auth: true,
    body: { prompt: prompt ?? "" },
  });
}

export function getTelegramAccount() {
  return request<TelegramAccount>("/telegram/me", { auth: true });
}

export function getTelegramLinkUrl() {
  return request<TelegramLink>("/telegram/link-url", {
    method: "POST",
    auth: true,
  });
}

export function unlinkTelegramAccount() {
  return request<TelegramAccount>("/telegram/me", {
    method: "DELETE",
    auth: true,
  });
}

export function sendTelegramTestAlert() {
  return request<{ status: string }>("/telegram/test-alert", {
    method: "POST",
    auth: true,
  });
}

export function searchUsers(query: string) {
  return request<PublicUser[]>(`/users/search?q=${encodeURIComponent(query)}`, { auth: true });
}

export function listFriendRequests() {
  return request<FriendRequest[]>("/friends/requests", { auth: true });
}

export function listIncomingFriendRequests() {
  return request<FriendRequest[]>("/friends/requests/incoming", { auth: true });
}

export function createFriendRequest(recipientId: string, message?: string) {
  return request<FriendRequest>("/friends/requests", { method: "POST", auth: true, body: { recipient_id: recipientId, message } });
}

export function acceptFriendRequest(requestId: string) {
  return request<Friendship>(`/friends/requests/${encodeURIComponent(requestId)}/accept`, { method: "POST", auth: true });
}

export function deleteFriendRequest(requestId: string) {
  return request<void>(`/friends/requests/${encodeURIComponent(requestId)}`, { method: "DELETE", auth: true });
}

export function listFriends() {
  return request<Friendship[]>("/friends", { auth: true });
}

export function deleteFriend(userId: string) {
  return request<void>(`/friends/${encodeURIComponent(userId)}`, { method: "DELETE", auth: true });
}

export function listConversations() {
  return request<Conversation[]>("/conversations", { auth: true });
}

export function createConversation(recipientId: string) {
  return request<Conversation>("/conversations", { method: "POST", auth: true, body: { recipient_id: recipientId } });
}

export function listMessages(conversationId: string) {
  return request<ConversationMessage[]>(`/conversations/${encodeURIComponent(conversationId)}/messages`, { auth: true });
}

export function createMessage(conversationId: string, body: string) {
  return request<ConversationMessage>(`/conversations/${encodeURIComponent(conversationId)}/messages`, { method: "POST", auth: true, body: { body } });
}

export function listGameInvites() {
  return request<GameInvite[]>("/game-invites", { auth: true });
}

export function createGameInvite(recipientId: string, gameName: string, gameId?: number, note?: string) {
  return request<GameInvite>("/game-invites", { method: "POST", auth: true, body: { recipient_id: recipientId, game_name: gameName, game_id: gameId, note } });
}

export function respondToGameInvite(inviteId: string, status: "accepted" | "declined") {
  return request<GameInvite>(`/game-invites/${encodeURIComponent(inviteId)}/response`, { method: "POST", auth: true, body: { status } });
}

export function listNotifications(unreadOnly = false) {
  return request<Notification[]>(`/notifications?unread_only=${unreadOnly}`, { auth: true });
}

export function markNotificationRead(notificationId: string) {
  return request<Notification>(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: "POST", auth: true });
}

export function markAllNotificationsRead() {
  return request<void>("/notifications/read-all", { method: "POST", auth: true });
}

export function getSocialInviteLink() {
  return request<InviteLink>("/social/invite-link", { auth: true });
}

export function listFavorites() {
  return request<CatalogCollectionItem[]>("/favorites", { auth: true });
}

export function addFavorite(catalogGameId: number, title: string, coverUrl?: string | null) {
  return request<CatalogCollectionItem>("/favorites", { method: "POST", auth: true, body: { catalog_game_id: catalogGameId, title, cover_url: coverUrl } });
}

export function removeFavorite(catalogGameId: number) {
  return request<void>(`/favorites/${catalogGameId}`, { method: "DELETE", auth: true });
}

export function listWishlist() {
  return request<CatalogCollectionItem[]>("/wishlist", { auth: true });
}

export function addWishlistItem(catalogGameId: number, title: string, coverUrl?: string | null) {
  return request<CatalogCollectionItem>("/wishlist", { method: "POST", auth: true, body: { catalog_game_id: catalogGameId, title, cover_url: coverUrl } });
}

export function updateWishlistItem(catalogGameId: number, title?: string, coverUrl?: string | null) {
  return request<CatalogCollectionItem>(`/wishlist/${catalogGameId}`, { method: "PATCH", auth: true, body: { title, cover_url: coverUrl } });
}

export function removeWishlistItem(catalogGameId: number) {
  return request<void>(`/wishlist/${catalogGameId}`, { method: "DELETE", auth: true });
}

export function listPriceAlerts() {
  return request<PriceAlert[]>("/price-alerts", { auth: true });
}

export function createPriceAlert(catalogGameId: number, targetPrice?: number, targetDiscount?: number, deliveryChannels: string[] = ["in_app"]) {
  return request<PriceAlert>("/price-alerts", { method: "POST", auth: true, body: { wishlist_catalog_game_id: catalogGameId, target_price: targetPrice, target_discount: targetDiscount, delivery_channels: deliveryChannels } });
}

export function deletePriceAlert(alertId: string) {
  return request<void>(`/price-alerts/${encodeURIComponent(alertId)}`, { method: "DELETE", auth: true });
}
