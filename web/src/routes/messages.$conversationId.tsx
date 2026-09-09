import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MessagesScreen } from "@/components/MessagesScreen";
export const Route = createFileRoute("/messages/$conversationId")({
  head: () => ({ meta: [{ title: "Messages — Playfinder" }] }),
  component: ConversationPage,
});
function ConversationPage() {
  const { conversationId } = Route.useParams();
  const navigate = useNavigate();
  return (
    <AppShell>
      <MessagesScreen
        conversationId={conversationId}
        onSelect={(id) => {
          void (id
            ? navigate({ to: "/messages/$conversationId", params: { conversationId: id } })
            : navigate({ to: "/messages" }));
        }}
      />
    </AppShell>
  );
}
