import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { FriendsScreen } from "@/features/friends/FriendsScreen";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "Friends — PlayFinder" },
      {
        name: "description",
        content:
          "Manage PlayFinder friendships, invitations, messages, and Steam friends.",
      },
    ],
  }),
  component: FriendsPage,
});

function FriendsPage() {
  return (
    <AppShell>
      <FriendsScreen />
    </AppShell>
  );
}
