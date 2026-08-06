import {
  searchGames,
  type RecommendationItem,
  type SearchGame,
} from "@/lib/api";

export type ResolvedRecommendation = {
  item: RecommendationItem;
  game: SearchGame | null;
  href: string;
  external: boolean;
};
export const normalizeTitle = (value: string) =>
  value
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function isSteamUrl(
  value: string | null | undefined,
  appId: number | null | undefined,
) {
  if (!Number.isInteger(appId) || (appId ?? 0) <= 0 || !value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "store.steampowered.com" &&
      url.pathname.includes(`/app/${appId}`)
    );
  } catch {
    return false;
  }
}

export async function resolveRecommendation(
  item: RecommendationItem,
): Promise<ResolvedRecommendation> {
  if (Number.isInteger(item.rawg_id) && (item.rawg_id ?? 0) > 0)
    return {
      item,
      game: null,
      href: `/games/${item.rawg_id}`,
      external: false,
    };
  if (isSteamUrl(item.steam_url, item.steam_appid))
    return { item, game: null, href: item.steam_url!, external: true };
  const { results } = await searchGames(item.title);
  const game =
    results.find(
      (candidate) =>
        candidate.id != null &&
        candidate.name != null &&
        normalizeTitle(candidate.name) === normalizeTitle(item.title),
    ) ?? null;
  return {
    item,
    game,
    href: game
      ? `/games/${game.id}`
      : `/search?q=${encodeURIComponent(item.title)}`,
    external: false,
  };
}
