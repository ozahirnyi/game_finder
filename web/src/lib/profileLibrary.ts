import type { PublicLibraryGame } from "./api";
import type { GameDetailTarget } from "./gameRoute";

export function formatPlaytime(minutes: number) {
  const total = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(total / 60);
  return hours ? `${hours}h${total % 60 ? ` ${total % 60}m` : ""}` : `${total}m`;
}

export function profileLibraryHours(games: { playtime_forever?: number | null }[]) {
  const known = games.filter(
    (game) => game.playtime_forever != null && Number.isFinite(game.playtime_forever),
  );
  if (!known.length) return "—";
  return (
    formatPlaytime(known.reduce((total, game) => total + Math.max(0, game.playtime_forever!), 0)) +
    (known.length < games.length ? " (known)" : "")
  );
}

export function profileLibraryGames(games: PublicLibraryGame[]) {
  return games.map((game) => {
    const detail: GameDetailTarget | undefined = game.detail_game_id
      ? {
          gameId: game.detail_game_id,
          ...((game.detail_source ?? game.source) === "steam" ? { source: "steam" as const } : {}),
        }
      : undefined;
    return {
      id: game.id,
      title: game.title,
      coverFrom: "#7c3aed",
      coverTo: "#111827",
      coverUrl: game.cover_url ?? undefined,
      playtime: game.playtime_forever,
      source: game.source,
      detail,
    };
  });
}
