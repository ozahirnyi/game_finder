export type UserRead = {
  id: string;
  email: string;
  created_at: string;
};

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

export type SavedGame = {
  id: string;
  title: string;
  notes: string | null;
  info: string | null;
  created_at: string;
};

export type RecommendationItem = {
  title: string;
  reason: string;
  tags: string[];
};

export type RecommendationResponse = {
  recommendations: RecommendationItem[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "game_finder_token";
const AUTH_EVENT = "game-finder-auth";

type RequestOptions = {
  method?: string;
  auth?: boolean;
  body?: unknown;
  formBody?: URLSearchParams;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event(AUTH_EVENT));
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
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg ?? JSON.stringify(item)).join(", ")
      : detail ?? `Request failed with status ${response.status}`;
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

export function searchGames(query: string) {
  return request<SearchResponse>(`/search/games?q=${encodeURIComponent(query)}`);
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
