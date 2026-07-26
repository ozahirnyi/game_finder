import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PublicProfileScreen } from "@/features/friends/PublicProfileScreen";

export const Route = createFileRoute("/users/$publicId")({
  head: () => ({
    meta: [
      { title: "PlayFinder profile" },
      { name: "description", content: "A public PlayFinder player profile." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { publicId } = Route.useParams();
  return (
    <AppShell>
      <PublicProfileScreen publicId={publicId} />
    </AppShell>
  );
}
