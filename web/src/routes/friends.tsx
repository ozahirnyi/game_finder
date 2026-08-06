import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { FriendsScreen } from "@/features/social/FriendsScreen";

export const Route = createFileRoute("/friends")({
  component: () => (
    <AppShell>
      <FriendsScreen />
    </AppShell>
  ),
});
