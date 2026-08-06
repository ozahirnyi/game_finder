import { useEffect, useState } from "react";
import {
  listNotifications,
  markNotificationRead,
  type Notification,
} from "@/lib/api";

type Props = {
  navigate?: (target: string) => void;
  openExternal?: (target: string) => void;
  markRead?: (id: string) => Promise<unknown>;
};

function targetFor(notification: Notification) {
  if (
    notification.event_type === "friend_request" &&
    notification.friend_request_id
  )
    return `/friends?request=${notification.friend_request_id}`;
  if (notification.event_type === "message" && notification.friendship_id)
    return `/friends/${notification.friendship_id}/messages`;
  if (
    (notification.event_type === "game_invite" ||
      notification.event_type === "game_invite_response") &&
    notification.game_invite_id
  )
    return `/friends/invites?invite=${notification.game_invite_id}`;
  const gameId = Number(notification.game_id);
  if (
    notification.target_kind === "catalog_game" &&
    Number.isInteger(gameId) &&
    gameId > 0
  )
    return `/games/${gameId}`;
  if (notification.offer_url && /^https:\/\//i.test(notification.offer_url))
    return notification.offer_url;
  return null;
}

export function NotificationsMenu({
  navigate,
  openExternal = (target) => window.location.assign(target),
  markRead = markNotificationRead,
}: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unavailable, setUnavailable] = useState("");
  useEffect(() => {
    void listNotifications()
      .then(setNotifications)
      .catch(() => setNotifications([]));
  }, []);
  const open = async (notification: Notification) => {
    const target = targetFor(notification);
    if (!target) {
      setUnavailable(notification.id);
      return;
    }
    if (target.startsWith("https://")) openExternal(target);
    else if (navigate) navigate(target);
    else window.location.assign(target);
    await markRead(notification.id);
    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id
          ? { ...item, read_at: new Date().toISOString() }
          : item,
      ),
    );
  };
  const labelFor = (notification: Notification) =>
    ({
      price_alert: "Price alert",
      friend_request: "Friend request",
      message: "New message",
      game_invite: "Game invite",
      game_invite_response: "Game invite response",
    })[notification.event_type];
  return (
    <section aria-label="Notifications">
      <h2>Notifications</h2>
      {notifications.length === 0 ? (
        <p>No price notifications.</p>
      ) : (
        notifications.map((notification) => (
          <div key={notification.id}>
            <button type="button" onClick={() => void open(notification)}>
              {labelFor(notification)}
            </button>
            {unavailable === notification.id ? (
              <p role="alert">
                {notification.event_type === "price_alert"
                  ? "This price alert is no longer available."
                  : "This notification is no longer available."}
              </p>
            ) : null}
          </div>
        ))
      )}
    </section>
  );
}
