import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Panel, SectionHeader, EmptyState, Chip } from "@/components/ui-bits";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api";
import { notificationDestination } from "@/lib/notificationNavigation";
import { Bell, Gamepad2, Tag, Users, Check } from "lucide-react";

const iconFor = {
  invite: Gamepad2,
  price: Tag,
  friend: Users,
  system: Bell,
} as const;

const titleFor: Record<string, string> = {
  friend_request: "Friend request",
  friend_request_accepted: "Friend request accepted",
  message: "New message",
  game_invite: "Game invite",
  game_invite_response: "Game invite response",
};

function notificationMessage(type: string, payload: Record<string, unknown>) {
  const from = typeof payload.from === "string" ? payload.from : "A player";
  const by = typeof payload.by === "string" ? payload.by : "A player";
  switch (type) {
    case "friend_request":
      return `${from} sent you a friend request.`;
    case "friend_request_accepted":
      return `${by} accepted your friend request.`;
    case "message":
      return `${from}: ${typeof payload.preview === "string" ? payload.preview : "sent you a message."}`;
    case "game_invite":
      return `${from} invited you to play ${typeof payload.game_name === "string" ? payload.game_name : "a game"}.`;
    case "game_invite_response":
      return `${by} ${payload.status === "accepted" ? "accepted" : "declined"} your game invite.`;
    default:
      return typeof payload.message === "string" ? payload.message : "New Playfinder notification";
  }
}

export function NotificationsPanel({ className = "" }: { className?: string }) {
  const [unavailableId, setUnavailableId] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({ queryKey: ["notifications"], queryFn: getNotifications });
  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markAllRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const notifications = notificationsQuery.data ?? [];

  const unread = notifications.filter((n) => !n.read_at).length;

  return (
    <Panel className={`p-6 ${className}`}>
      <SectionHeader
        title="Notifications"
        hint={unread > 0 ? `${unread} unread` : "You're all caught up"}
        action={
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-muted-foreground transition hover:text-foreground"
              >
                <Check className="mr-1 inline size-3.5" /> Mark all read
              </button>
            )}
          </div>
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-5" />}
          title="No notifications yet"
          description="Invites, price drops and friend activity will show up here."
        />
      ) : (
        <div className="stagger space-y-2">
          {notifications.map((n) => {
            const Icon = iconFor[n.type as keyof typeof iconFor] ?? Bell;
            const isUnread = !n.read_at;
            return (
              <div
                key={n.id}
                onClick={() => {
                  const destination = notificationDestination(n);
                  if (!destination) {
                    setUnavailableId(n.id);
                    return;
                  }
                  void navigate(destination);
                  if (isUnread) markRead.mutate(n.id);
                }}
                className={`flex items-start gap-3 rounded-xl border p-3 transition ${
                  isUnread ? "border-primary/30 bg-primary/5" : "border-border bg-surface-2"
                }`}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-surface text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold">
                      {titleFor[n.type] ?? "Notification"}
                    </p>
                    {isUnread && <Chip tone="primary">New</Chip>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {notificationMessage(n.type, n.payload)}
                  </p>
                  {unavailableId === n.id && (
                    <p
                      role="status"
                      aria-live="polite"
                      className="mt-1 text-xs text-muted-foreground"
                    >
                      This notification action is no longer available.
                    </p>
                  )}
                </div>
                <span className="label-mono shrink-0 text-muted-foreground">
                  {new Date(n.created_at).toLocaleDateString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
