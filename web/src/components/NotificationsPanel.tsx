import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Panel, SectionHeader, EmptyState, Chip } from "@/components/ui-bits";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api";
import { Bell, Gamepad2, Tag, Users, Settings2, Check } from "lucide-react";

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
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState([
    { id: "price", label: "Price drops", enabled: true },
    { id: "friends", label: "Friend activity", enabled: true },
  ]);
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
            <button
              aria-label="Notification settings"
              onClick={() => setShowSettings((s) => !s)}
              className={`grid size-9 place-items-center rounded-lg border transition ${
                showSettings
                  ? "border-primary/60 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Settings2 className="size-4" />
            </button>
          </div>
        }
      />

      {showSettings && (
        <div className="pop-in mb-5 space-y-2 rounded-xl border border-border bg-surface-2 p-3">
          {prefs.map((p) => (
            <button
              key={p.id}
              onClick={() =>
                setPrefs((list) =>
                  list.map((x) => (x.id === p.id ? { ...x, enabled: !x.enabled } : x)),
                )
              }
              className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-foreground/5"
            >
              <span className="text-sm font-semibold">{p.label}</span>
              <span
                className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                  p.enabled ? "bg-primary" : "bg-foreground/15"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-4 rounded-full bg-background transition-all ${
                    p.enabled ? "left-[1.125rem]" : "left-0.5"
                  }`}
                />
              </span>
            </button>
          ))}
        </div>
      )}

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
                onClick={() => isUnread && markRead.mutate(n.id)}
                className={`flex items-start gap-3 rounded-xl border p-3 transition ${
                  isUnread ? "border-primary/30 bg-primary/5" : "border-border bg-surface-2"
                }`}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-surface text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold">{titleFor[n.type] ?? "Notification"}</p>
                    {isUnread && <Chip tone="primary">New</Chip>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {notificationMessage(n.type, n.payload)}
                  </p>
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
