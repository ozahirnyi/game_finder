export type GameDetailTarget = {
  gameId: string;
  source?: "steam";
};

export function gameDetailTarget(
  catalogId?: number | null,
  steamAppId?: number | null,
): GameDetailTarget | undefined {
  if (catalogId != null) return { gameId: String(catalogId) };
  if (steamAppId != null) return { gameId: String(steamAppId), source: "steam" };
  return undefined;
}
