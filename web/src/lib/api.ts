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

export type Friend = {
  user: {
    id: string;
    display_name: string;
    steam_persona_name?: string | null;
    bio?: string | null;
    avatar?: string | null;
  };
};

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  bio?: string | null;
  platforms: string[];
  favorite_genres: string[];
  library_visibility?: "public" | "friends" | "private";
};

export type ProfileUpdate = Pick<Profile, "display_name" | "bio" | "library_visibility">;
export type RecommendationItem = { title: string; reason: string; tags: string[] };
export type RecommendationResponse = { recommendations: RecommendationItem[] };

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

export function getCatalogGame(id: string | number) {
  return apiRequest<CatalogGame>(`/catalog/games/${id}`);
}

export function getDeals(country: string) {
  return apiRequest<{ results: Deal[] }>(
    `/prices/deals?country=${encodeURIComponent(country)}&page_size=12`,
  );
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

export function getNotifications() {
  return apiRequest<Notification[]>("/notifications", { auth: true });
}

export function markNotificationRead(id: string) {
  return apiRequest<Notification>(`/notifications/${id}/read`, { auth: true, method: "POST" });
}

export function markAllNotificationsRead() {
  return apiRequest<void>("/notifications/read-all", { auth: true, method: "POST" });
}
