import { useQuery } from "@tanstack/react-query";
import {
  getConversationMessages,
  getConversations,
  getGameInvites,
  type ConversationMessage,
  type GameInvite,
} from "@/lib/api";
import { EmptyState, SectionHeader } from "@/components/ui-bits";

type FriendConversationHistoryProps = {
  friendId: string;
  title?: string;
};

type HistoryEvent =
  | { kind: "message"; createdAt: string; message: ConversationMessage }
  | { kind: "invite"; createdAt: string; invite: GameInvite };

function displayInviteStatus(status: GameInvite["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function FriendConversationHistory({
  friendId,
  title = "Messages",
}: FriendConversationHistoryProps) {
  const conversationsQuery = useQuery({ queryKey: ["conversations"], queryFn: getConversations });
  const conversation = conversationsQuery.data?.find(
    (item) => item.participant.id === friendId,
  );
  const messagesQuery = useQuery({
    queryKey: ["conversation-messages", conversation?.id],
    queryFn: () => getConversationMessages(conversation!.id),
    enabled: Boolean(conversation),
  });
  const invitesQuery = useQuery({
    queryKey: ["game-invites", "all"],
    queryFn: () => getGameInvites("all"),
  });
  const invites = (invitesQuery.data ?? []).filter(
    (invite) => invite.sender.id === friendId || invite.recipient.id === friendId,
  );
  const events: HistoryEvent[] = [
    ...(messagesQuery.data ?? []).map((message) => ({
      kind: "message" as const,
      createdAt: message.created_at,
      message,
    })),
    ...invites.map((invite) => ({
      kind: "invite" as const,
      createdAt: invite.created_at,
      invite,
    })),
  ].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  const isLoading =
    conversationsQuery.isPending ||
    invitesQuery.isPending ||
    (Boolean(conversation) && messagesQuery.isPending);

  return (
    <section>
      <SectionHeader title={title} />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading messages…</p>
      ) : events.length ? (
        <div className="space-y-2">
          {events.map((event) =>
            event.kind === "message" ? (
              <p
                key={`message:${event.message.id}`}
                className="rounded-xl border border-border bg-surface p-3 text-sm"
              >
                {event.message.body}
              </p>
            ) : (
              <p
                key={`invite:${event.invite.id}`}
                className="rounded-xl border border-border bg-surface p-3 text-sm"
              >
                Game invitation: {event.invite.game_name} · {displayInviteStatus(event.invite.status)}
              </p>
            ),
          )}
        </div>
      ) : (
        <EmptyState title="No messages yet" description="Start a conversation or send a game invitation." />
      )}
    </section>
  );
}
