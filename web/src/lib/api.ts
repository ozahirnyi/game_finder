const API_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/$/, "");
const TOKEN_KEY = "game_finder_token";
const AUTH_EVENT = "game-finder-auth";

type RequestOptions = {
  auth?: boolean;
  body?: unknown;
  formBody?: URLSearchParams;
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
};

export type CollectionGame = {
  id: string;
  catalog_game_id: number;
  title: string;
  cover_url?: string | null;
};

export type Friend = {
  user: { id: string; display_name: string; bio?: string | null; avatar?: string | null };
};

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  bio?: string | null;
  platforms: string[];
  favorite_genres: string[];
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

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body === undefined && options.formBody === undefined
        ? {}
        : {
            "Content-Type": options.formBody
              ? "application/x-www-form-urlencoded"
              : "application/json",
          }),
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

export function searchGames(query: string) {
  return apiRequest<{ results: CatalogGame[] }>(`/search/games?q=${encodeURIComponent(query)}`);
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

export function getLibrary() {
  return apiRequest<LibraryGame[]>("/games", { auth: true });
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

export function removeWishlist(id: number) {
  return apiRequest<void>(`/wishlist/${id}`, { auth: true, method: "DELETE" });
}

export function getFriends() {
  return apiRequest<Friend[]>("/friends", { auth: true });
}
