type GameDetailCard = {
  title: string;
  source?: "steam";
  returnTo?: string;
};

export function gameDetailSearch(game: GameDetailCard) {
  return {
    title: game.title,
    ...(game.source ? { source: game.source } : {}),
    ...(game.returnTo ? { returnTo: game.returnTo } : {}),
  };
}
