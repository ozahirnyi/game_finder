import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../lib/api";
import { Panel, SectionHeader } from "./ui-bits";

export function NotificationsPanel() {
  const client = useQueryClient();
  const notifications = useQuery({ queryKey: ["notifications"], queryFn: getNotifications });
  const refresh = () => client.invalidateQueries({ queryKey: ["notifications"] });
  const readOne = useMutation({ mutationFn: markNotificationRead, onSuccess: refresh });
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh });
  const items = notifications.data ?? [];
  return (
    <Panel className="p-6 lg:col-span-5">
      <SectionHeader
        title="Notifications"
        hint="Price alerts, friends, and invitations"
        action={
          items.some((item) => !item.read_at) ? (
            <button className="text-xs font-bold text-primary" onClick={() => readAll.mutate()}>
              Mark all read
            </button>
          ) : undefined
        }
      />
      <div className="space-y-3">
        {notifications.isLoading && (
          <p className="text-sm text-muted-foreground">Loading notifications…</p>
        )}
        {notifications.isError && (
          <p className="text-sm text-destructive">Unable to load notifications.</p>
        )}
        {!notifications.isLoading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        )}
        {items.slice(0, 6).map((item) => (
          <button
            key={item.id}
            className={`block w-full rounded-xl border border-border px-4 py-3 text-left ${item.read_at ? "bg-surface-2" : "bg-primary/5"}`}
            onClick={() => !item.read_at && readOne.mutate(item.id)}
          >
            <span className="block text-sm font-semibold">
              {String(item.payload.title ?? item.type.replaceAll("_", " "))}
            </span>
            {item.payload.message && (
              <span className="mt-1 block text-xs text-muted-foreground">
                {String(item.payload.message)}
              </span>
            )}
          </button>
        ))}
      </div>
    </Panel>
  );
}
