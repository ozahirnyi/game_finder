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

export type Visibility = "everyone" | "friends" | "nobody";
export type ProfileSettings = {
  nickname: string | null;
  platforms_visibility: Visibility;
  current_game_visibility: Visibility;
  recent_games_visibility: Visibility;
};
export type PublicProfile = { nickname: string; platforms: string[]; current_game: string | null; recent_games: string[] };
export type FriendshipRequest = { id: string; requester_nickname: string; recipient_nickname: string; status: string; created_at: string };
export type Friendship = { user_id: string; nickname: string; created_at: string };
export type FriendInvite = { token: string; url: string };
export type InviteResolution = { owner_nickname: string };
export type PsnContact = { id: string; online_id: string; profile_url: string; created_at: string };
export type ManualActivity = { current_game: string | null; recent_games: string[] };
export type FriendCard = { id: string; source: "site" | "psn" | "steam"; nickname: string | null; profile_url: string | null; steam_id: string | null; avatar: string | null; current_game: string | null; recent_games: string[] };
export type ContactSourceStatus = { available: boolean; error: string | null };
export type FriendsContacts = { contacts: FriendCard[]; sources: Record<string, ContactSourceStatus> };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://game-finder.up.railway.app";
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
  const payload = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    const detail = payload?.detail;
    let message = Array.isArray(detail)
      ? detail.map((item) => item.msg ?? JSON.stringify(item)).join(", ")
      : detail ?? `Request failed with status ${response.status}`;
    if (options.auth && response.status === 401) {
      removeStoredToken();
      message = "Your session expired. Please log in again.";
    }
    throw new ApiError(message, response.status);
  }

  return payload as T;
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

export function getProfileSettings() { return request<ProfileSettings>("/profile/me", { auth: true }); }
export function updateProfileSettings(settings: Partial<ProfileSettings>) { return request<ProfileSettings>("/profile/me", { method: "PATCH", auth: true, body: settings }); }
export function getPublicProfile(nickname: string) { return request<PublicProfile>(`/profiles/${encodeURIComponent(nickname)}`); }
export function createFriendRequest(nickname: string) { return request<FriendshipRequest>("/friends/requests", { method: "POST", auth: true, body: { nickname } }); }
export function listFriendRequests() { return request<FriendshipRequest[]>("/friends/requests", { auth: true }); }
export function respondToFriendRequest(id: string, action: "accepted" | "declined") { return request<FriendshipRequest>(`/friends/requests/${encodeURIComponent(id)}/respond`, { method: "POST", auth: true, body: { action } }); }
export function cancelFriendRequest(id: string) { return request<FriendshipRequest>(`/friends/requests/${encodeURIComponent(id)}/cancel`, { method: "POST", auth: true }); }
export function listFriends() { return request<Friendship[]>("/friends", { auth: true }); }
export function deleteFriend(id: string) { return request<void>(`/friends/${encodeURIComponent(id)}`, { method: "DELETE", auth: true }); }
export function rotateFriendInvite() { return request<FriendInvite>("/friends/invites", { method: "POST", auth: true }); }
export function resolveFriendInvite(token: string) { return request<InviteResolution>(`/friends/invites/${encodeURIComponent(token)}`); }
export function acceptFriendInvite(token: string) { return request<Friendship>(`/friends/invites/${encodeURIComponent(token)}/accept`, { method: "POST", auth: true }); }
export function listPsnContacts() { return request<PsnContact[]>("/friends/psn-contacts", { auth: true }); }
export function createPsnContact(onlineId: string) { return request<PsnContact>("/friends/psn-contacts", { method: "POST", auth: true, body: { online_id: onlineId } }); }
export function updatePsnContact(id: string, onlineId: string) { return request<PsnContact>(`/friends/psn-contacts/${encodeURIComponent(id)}`, { method: "PATCH", auth: true, body: { online_id: onlineId } }); }
export function deletePsnContact(id: string) { return request<void>(`/friends/psn-contacts/${encodeURIComponent(id)}`, { method: "DELETE", auth: true }); }
export function getFriendsContacts() { return request<FriendsContacts>("/friends/contacts", { auth: true }); }
export function syncSteamContacts() { return request<FriendsContacts>("/friends/steam/sync", { method: "POST", auth: true }); }
export function updateManualActivity(activity: ManualActivity) { return request<ManualActivity>("/activity/manual", { method: "PATCH", auth: true, body: activity }); }
export function deleteManualActivity() { return request<void>("/activity/manual", { method: "DELETE", auth: true }); }
