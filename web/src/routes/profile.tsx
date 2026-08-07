import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ProfileScreen } from "@/features/integrations/ProfileScreen";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — GameFinder" },
      {
        name: "description",
        content: "Manage your favorites, integrations, and profile privacy.",
      },
    ],
  }),
  component: ProfileRoute,
});

function ProfileRoute() {
  return (
    <AppShell>
      <ProfileScreen />
    </AppShell>
  );
}
