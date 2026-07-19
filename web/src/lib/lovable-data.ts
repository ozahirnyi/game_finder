import {
  ApiError,
  type CatalogGame,
  type HomeDeal,
  type SavedGame,
  type SearchGame,
} from "./api";

type CatalogCardSource = CatalogGame | HomeDeal | SearchGame;

export type LovableGameCard = {
  id: string | null;
  title: string | null;
  released: string | null;
  imageUrl: string | null;
};

export type LovableSavedGameCard = {
  id: string;
  title: string;
  source: SavedGame["source"];
  notes: string | null;
  info: string | null;
  playtimeForever: number | null;
  playtimeTwoWeeks: number | null;
  imageUrl: string | null;
};

export const lovableQueryKeys = {
  me: ["auth", "me"] as const,
  savedGames: ["games"] as const,
  deals: (country: string) => ["deals", country] as const,
  steam: ["steam"] as const,
  search: (query: string) => ["search", query] as const,
  catalogGame: (id: string) => ["catalog", "game", id] as const,
  gamePriceHistory: (id: string, country: string) => ["prices", "game", id, country] as const,
  upcomingGames: (pageSize: number) => ["catalog", "upcoming", pageSize] as const,
  trendingGames: (pageSize: number) => ["catalog", "trending", pageSize] as const,
  steamLibrary: ["steam", "library"] as const,
  steamSocial: (friendsLimit: number) => ["steam", "social", friendsLimit] as const,
  dashboard: ["dashboard"] as const,
  profileSummary: ["profile", "summary"] as const,
} as const;

export function getProtectedState(error: unknown): "sign-in" | "connect-steam" | "error" {
  if (error instanceof ApiError && error.status === 401) {
    return "sign-in";
  }
  if (error instanceof ApiError && error.status === 409) {
    return "connect-steam";
  }
  return "error";
}

export function toGameCard(game: CatalogCardSource): LovableGameCard {
  return {
    id: game.id === null ? null : String(game.id),
    title: game.name,
    released: game.released,
    imageUrl: game.background_image,
  };
}

export function toSavedGameCard(game: SavedGame): LovableSavedGameCard {
  return {
    id: game.id,
    title: game.title,
    source: game.source,
    notes: game.notes,
    info: game.info,
    playtimeForever: game.playtime_forever,
    playtimeTwoWeeks: game.playtime_2weeks,
    imageUrl: game.img_icon_url && game.external_id
      ? `https://media.steampowered.com/steamcommunity/public/images/apps/${game.external_id}/${game.img_icon_url}.jpg`
      : game.img_icon_url,
  };
}
