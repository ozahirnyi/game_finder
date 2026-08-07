import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ProfileScreen } from "@/features/social/ProfileScreen";

export const Route = createFileRoute("/users/$profileId")({
  component: ProfileRouteComponent,
});

function ProfileRouteComponent() {
  const { profileId } = Route.useParams();
  return (
    <AppShell>
      <ProfileScreen profileId={profileId} />
    </AppShell>
  );
}
