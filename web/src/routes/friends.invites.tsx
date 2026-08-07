import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { InvitesScreen } from "@/features/social/InvitesScreen";

export const Route = createFileRoute("/friends/invites")({
  component: () => (
    <AppShell>
      <InvitesScreen />
    </AppShell>
  ),
});
