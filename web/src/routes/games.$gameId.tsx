import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { GameDetailScreen } from "@/features/discovery/GameDetailScreen";
export const Route = createFileRoute("/games/$gameId")({
  component: GameDetail,
});
function GameDetail() {
  const { gameId } = Route.useParams();
  return (
    <AppShell>
      <GameDetailScreen gameId={gameId} />
    </AppShell>
  );
}
