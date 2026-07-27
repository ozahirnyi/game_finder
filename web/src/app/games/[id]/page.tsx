import { GameDetailScreen } from "@/features/discovery/GameDetailScreen";

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GameDetailScreen gameId={id} />;
}
