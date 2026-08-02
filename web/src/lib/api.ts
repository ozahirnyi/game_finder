const API_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/$/, "");
const TOKEN_KEY = "game_finder_token";
const AUTH_EVENT = "game-finder-auth";

type RequestOptions = {
  auth?: boolean;
  body?: unknown;
  formBody?: BodyInit;
  method?: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type UserRead = {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
};

export type CatalogGame = {
  id: number;
  name: string;
  released?: string | null;
  background_image?: string | null;
  description_raw?: string | null;
  rating?: number | null;
  genres?: string[];
  platforms?: string[];
};

export type Deal = {
  id?: number | null;
  steam_appid?: number | null;
  name: string;
  background_image?: string | null;
  url?: string | null;
  current?: {
    shop?: string | null;
    url?: string | null;
    price?: Money | null;
    regular?: Money | null;
    cut?: number | null;
  } | null;
};
export type GenreDealResponse = { popular: Deal[]; sections: { genre: string; results: Deal[] }[] };

export type Money = { amount: number; currency: string };

export type LibraryGame = {
  id: string;
  title: string;
  notes?: string | null;
  source: string;
  playtime_forever?: number | null;
  img_icon_url?: string | null;
  cover_url?: string | null;
};

export type LibraryOverviewGame = {
  id: string;
  source: "manual" | "psn" | "steam";
  external_id?: string | null;
  detail_game_id?: string | null;
  title: string;
  cover_url?: string | null;
  playtime_forever?: number | null;
};

export type LibraryOverview = {
  games: LibraryOverviewGame[];
  steam_available: boolean;
  steam_error?: string | null;
};

export type CollectionGame = {
  id: string;
  catalog_game_id: number;
  title: string;
  cover_url?: string | null;
};

export type PriceAlertCreate = {
  wishlist_catalog_game_id: number;
  target_price?: number;
  target_discount?: number;
  delivery_channels: ("in_app" | "telegram")[];
};

export type PriceAlert = PriceAlertCreate & {
  id: string;
  created_at: string;
  updated_at: string;
};

export type GameInviteCreate = {
  recipient_id: string;
  game_name: string;
  game_id?: number;
  note?: string;
};

export type Friend = {
  user: {
    id: string;
    display_name: string;
    steam_persona_name?: string | null;
    bio?: string | null;
    avatar?: string | null;
  };
};

export type FriendRequest = {
  id: string;
  sender: Friend["user"];
  recipient: Friend["user"];
  message?: string | null;
  created_at: string;
};

export type FriendProfile = {
  user: Friend["user"];
  library: {
    status: "ready" | "empty" | "hidden";
    data: LibraryGame[];
    message?: string | null;
  };
};

export type Conversation = { id: string };

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  bio?: string | null;
  platforms: string[];
  favorite_genres: string[];
  library_visibility?: "public" | "friends" | "private";
};

export type ProfileUpdate = Pick<Profile, "display_name" | "bio" | "library_visibility" | "platforms" | "favorite_genres">;
export type RecommendationItem = { title: string; reason: string; tags: string[] };
export type RecommendationResponse = { recommendations: RecommendationItem[] };
export type DashboardBlock<T> = {
  status: "ready" | "empty" | "error" | "not_connected";
  data: T;
  message?: string | null;
};
export type DashboardRecommendation = RecommendationItem & {
  rawg_id?: number | null;
  cover_url?: string | null;
};
export type Dashboard = { recommendations: DashboardBlock<{ recommendations: DashboardRecommendation[] }> };

export type OAuthLoginUrl = { url: string };
export type SteamAccount = {
  linked: boolean;
  steam_id?: string | null;
  persona_name?: string | null;
  avatar?: string | null;
  linked_at?: string | null;
};
export type TelegramAccount = {
  linked: boolean;
  configured: boolean;
  username?: string | null;
  linked_at?: string | null;
};
export type TelegramLink = { configured: boolean; url?: string | null; message?: string | null };
export type SteamLibrarySync = SteamAccount & {
  games?: LibraryGame[];
  synced_at?: string | null;
  created?: number;
  updated?: number;
};
export type SteamSocialFriend = {
  steam_id: string;
  persona_name?: string | null;
  avatar?: string | null;
  library_public: boolean;
  common_games_count: number;
  taste_match_percent: number;
};
export type SteamSocial = {
  friends: SteamSocialFriend[];
  friends_total: number;
  friends_has_more: boolean;
  top_friend_games: { appid: number; name: string; friends: number }[];
};
export type PsnImportPreview = {
  games: string[];
  total: number;
  message?: string | null;
};
export type PsnImportResult = { created: number; updated: number; skipped: number; total: number };
export type Notification = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  read_at?: string | null;
  created_at: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function inBrowser() {
  return typeof window !== "undefined";
}

function notifyAuthChanged() {
  if (inBrowser()) window.dispatchEvent(new Event(AUTH_EVENT));
}

export function getToken() {
  return inBrowser() ? window.localStorage.getItem(TOKEN_KEY) : null;
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
  notifyAuthChanged();
}

export function clearToken() {
  if (inBrowser()) window.localStorage.removeItem(TOKEN_KEY);
  notifyAuthChanged();
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
  return Boolean(getToken());
}

async function toApiError(response: Response, authenticated: boolean) {
  const payload = await response.json().catch(() => null);
  const message = payload?.detail ?? `Request failed with status ${response.status}`;
  if (authenticated && response.status === 401) clearToken();
  return new ApiError(message, response.status);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const token = options.auth ? getToken() : null;
  if (options.auth && !token) throw new ApiError("Please sign in first.", 401);
  const contentType =
    options.formBody instanceof URLSearchParams
      ? "application/x-www-form-urlencoded"
      : options.formBody instanceof FormData
        ? null
        : options.body !== undefined
          ? "application/json"
          : null;

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(contentType ? { "Content-Type": contentType } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body:
      options.formBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });
  if (!response.ok) throw await toApiError(response, options.auth === true);
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}

export function registerUser(email: string, password: string) {
  return apiRequest<UserRead>("/auth/register", { method: "POST", body: { email, password } });
}

export function loginUser(email: string, password: string) {
  const formBody = new URLSearchParams({ username: email, password });
  return apiRequest<TokenResponse>("/auth/login", { method: "POST", formBody });
}

export function getGoogleLoginUrl() {
  return apiRequest<OAuthLoginUrl>("/auth/google/login-url");
}

export function getGoogleLinkUrl() {
  return apiRequest<OAuthLoginUrl>("/auth/google/link-url", { auth: true, method: "POST" });
}

export function exchangeGoogleCode(exchange_code: string) {
  return apiRequest<TokenResponse>("/auth/google/exchange", {
    method: "POST",
    body: { exchange_code },
  });
}

export function getSteamSignInUrl() {
  return apiRequest<OAuthLoginUrl>("/auth/steam/login-url");
}

export function exchangeSteamCode(exchange_code: string) {
  return apiRequest<TokenResponse>("/auth/steam/exchange", {
    method: "POST",
    body: { exchange_code },
  });
}

export function getSteamLinkUrl() {
  return apiRequest<OAuthLoginUrl>("/steam/login-url", { auth: true });
}

export function getSteamAccount() {
  return apiRequest<SteamAccount>("/steam/me", { auth: true });
}

export function syncSteamLibrary() {
  return apiRequest<SteamLibrarySync>("/steam/library/sync", { auth: true, method: "POST" });
}

export function getSteamSocial(friends_limit = 12, friends_offset = 0) {
  return apiRequest<SteamSocial>(
    `/steam/social?friends_limit=${friends_limit}&friends_offset=${friends_offset}`,
    { auth: true },
  );
}

export function unlinkSteamAccount() {
  return apiRequest<SteamAccount>("/steam/me", { auth: true, method: "DELETE" });
}

export function getTelegramAccount() {
  return apiRequest<TelegramAccount>("/telegram/me", { auth: true });
}

export function getTelegramLinkUrl() {
  return apiRequest<TelegramLink>("/telegram/link-url", { auth: true, method: "POST" });
}

export function unlinkTelegramAccount() {
  return apiRequest<TelegramAccount>("/telegram/me", { auth: true, method: "DELETE" });
}

export function previewPsnImport(file: File) {
  const form = new FormData();
  form.set("file", file);
  return apiRequest<PsnImportPreview>("/psn/import/preview", {
    auth: true,
    method: "POST",
    formBody: form,
  });
}

export function confirmPsnImport(games: string[]) {
  return apiRequest<PsnImportResult>("/psn/import/confirm", {
    auth: true,
    method: "POST",
    body: { games },
  });
}

export function searchGames(query: string) {
  return apiRequest<{ results: CatalogGame[] }>(`/search/games?q=${encodeURIComponent(query)}`);
}

export function getRecommendations(prompt: string) {
  return apiRequest<RecommendationResponse>("/recommendations", {
    method: "POST",
    body: { prompt, liked_game_ids: [] },
  });
}

export function getTrendingGames() {
  return apiRequest<{ results: CatalogGame[] }>("/catalog/trending-games?page_size=12");
}

export function getDashboard() {
  return apiRequest<Dashboard>("/dashboard", { auth: true });
}

export function getCatalogGame(id: string | number) {
  return apiRequest<CatalogGame>(`/catalog/games/${id}`);
}

export function getSteamGameByTitle(title: string) {
  return apiRequest<{ appid: number; name: string; background_image?: string | null; description_raw?: string | null; genres: string[]; platforms: string[]; current?: Deal["current"]; url?: string | null }>(`/steam/games/resolve?title=${encodeURIComponent(title)}`);
}

export function getDeals(country: string) {
  return apiRequest<{ results: Deal[] }>(
    `/prices/deals?country=${encodeURIComponent(country)}&page_size=12`,
  );
}

export function getGenreDeals() {
  return apiRequest<GenreDealResponse>("/prices/genre-deals");
}

export function getPriceHistory(id: string | number, country = "US") {
  return apiRequest<{
    current?: Deal["current"];
    deals: Deal["current"][];
    history_low_all?: Money | null;
  }>(`/prices/games/${id}?country=${encodeURIComponent(country)}`);
}

export function getProfile() {
  return apiRequest<Profile>("/profile", { auth: true });
}

export function updateProfile(data: ProfileUpdate) {
  return apiRequest<Profile>("/profile", { auth: true, method: "PATCH", body: data });
}

export function getLibrary() {
  return apiRequest<LibraryGame[]>("/games", { auth: true });
}

export function getLibraryOverview() {
  return apiRequest<LibraryOverview>("/library/overview", { auth: true });
}

export function getWishlist() {
  return apiRequest<CollectionGame[]>("/wishlist", { auth: true });
}

export function addWishlist(game: CatalogGame) {
  return apiRequest<CollectionGame>("/wishlist", {
    auth: true,
    method: "POST",
    body: { catalog_game_id: game.id, title: game.name, cover_url: game.background_image ?? null },
  });
}

export function removeWishlist(id: string) {
  return apiRequest<void>(`/wishlist/${id}`, { auth: true, method: "DELETE" });
}

export function getFriends() {
  return apiRequest<Friend[]>("/friends", { auth: true });
}

export function getFriendProfile(id: string) {
  return apiRequest<FriendProfile>(`/friends/${id}/profile`, { auth: true });
}

export function createConversation(recipient_id: string) {
  return apiRequest<Conversation>("/conversations", {
    auth: true,
    method: "POST",
    body: { recipient_id },
  });
}

export function createMessage(conversationId: string, body: string) {
  return apiRequest(`/conversations/${conversationId}/messages`, {
    auth: true,
    method: "POST",
    body: { body },
  });
}

export function searchUsers(query: string) {
  return apiRequest<Friend["user"][]>(`/users/search?q=${encodeURIComponent(query)}`, {
    auth: true,
  });
}

export function getIncomingFriendRequests() {
  return apiRequest<FriendRequest[]>("/friends/requests/incoming", { auth: true });
}

export function createFriendRequest(data: { recipient_id: string; message?: string }) {
  return apiRequest<FriendRequest>("/friends/requests", { auth: true, method: "POST", body: data });
}

export function acceptFriendRequest(id: string) {
  return apiRequest<Friend>(`/friends/requests/${id}/accept`, { auth: true, method: "POST" });
}

export function createGameInvite(data: GameInviteCreate) {
  return apiRequest("/game-invites", { auth: true, method: "POST", body: data });
}

export function getPriceAlerts() {
  return apiRequest<PriceAlert[]>("/price-alerts", { auth: true });
}

export function createPriceAlert(data: PriceAlertCreate) {
  return apiRequest<PriceAlert>("/price-alerts", { auth: true, method: "POST", body: data });
}

export function getNotifications() {
  return apiRequest<Notification[]>("/notifications", { auth: true });
}

export function markNotificationRead(id: string) {
  return apiRequest<Notification>(`/notifications/${id}/read`, { auth: true, method: "POST" });
}

export function markAllNotificationsRead() {
  return apiRequest<void>("/notifications/read-all", { auth: true, method: "POST" });
}
