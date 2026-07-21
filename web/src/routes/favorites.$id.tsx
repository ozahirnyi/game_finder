import { createFileRoute } from "@tanstack/react-router";
import { SavedGameDetailScreen } from "@/features/library/SavedGameDetailScreen";

export const Route = createFileRoute("/favorites/$id")({
  component: SavedGameDetailRoute,
});

function SavedGameDetailRoute() {
  const { id } = Route.useParams();

  return <SavedGameDetailScreen id={id} />;
}
