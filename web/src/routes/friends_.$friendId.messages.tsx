import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ConversationScreen } from "@/features/friends/ConversationScreen";

type ConversationSearch = {
  draft?: string;
};

export const Route = createFileRoute("/friends_/$friendId/messages")({
  validateSearch: (search: Record<string, unknown>): ConversationSearch => ({
    draft:
      typeof search.draft === "string"
        ? search.draft.slice(0, 2000)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Messages — PlayFinder" },
      {
        name: "description",
        content: "A private PlayFinder friend conversation.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConversationPage,
});

function ConversationPage() {
  const { friendId } = Route.useParams();
  const { draft } = Route.useSearch();
  return (
    <AppShell>
      <ConversationScreen friendId={friendId} initialDraft={draft} />
    </AppShell>
  );
}
