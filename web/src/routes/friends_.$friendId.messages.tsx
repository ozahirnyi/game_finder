import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ConversationScreen } from "@/features/friends/ConversationScreen";

type ConversationSearch = {
  draft?: string;
  draftKey?: "resume";
};

export const Route = createFileRoute("/friends_/$friendId/messages")({
  validateSearch: (search: Record<string, unknown>): ConversationSearch => ({
    draft:
      typeof search.draft === "string"
        ? search.draft.slice(0, 2000)
        : undefined,
    draftKey: search.draftKey === "resume" ? "resume" : undefined,
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
  const { draft, draftKey } = Route.useSearch();
  return (
    <AppShell>
      <ConversationScreen
        draftKey={draftKey}
        friendId={friendId}
        initialDraft={draft}
      />
    </AppShell>
  );
}
