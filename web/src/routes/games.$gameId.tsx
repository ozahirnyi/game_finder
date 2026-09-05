import { createFileRoute } from "@tanstack/react-router";
import { GameDetailScreen } from "@/features/discovery/GameDetailScreen";

export const Route = createFileRoute("/games/$gameId")({
  head: () => ({ meta: [{ title: "Game details — GameFinder" }] }),
  component: GameDetailRoute,
});

function GameDetailRoute() {
  const { gameId } = Route.useParams();
  return <GameDetailScreen gameId={gameId} />;
}
