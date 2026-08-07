import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ConversationScreen } from "@/features/social/ConversationScreen";

export const Route = createFileRoute("/friends/$friendId/messages")({
  component: ConversationRouteComponent,
});

function ConversationRouteComponent() {
  const { friendId } = Route.useParams();
  return (
    <AppShell>
      <ConversationScreen friendId={friendId} />
    </AppShell>
  );
}
