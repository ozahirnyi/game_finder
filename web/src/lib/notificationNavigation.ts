import type { Notification } from "./api";

export type NotificationDestination =
  | { to: "/friends"; search: { request?: string; conversation?: string; invite?: string } }
  | { to: "/users/$publicId"; params: { publicId: string } }
  | { to: "/games/$gameId"; params: { gameId: string } };

const stringField = (payload: Record<string, unknown>, key: string) =>
  typeof payload[key] === "string" && payload[key] ? payload[key] : null;

export function notificationDestination(
  notification: Notification,
): NotificationDestination | null {
  switch (notification.type) {
    case "friend_request": {
      const request = stringField(notification.payload, "request_id");
      return request ? { to: "/friends", search: { request } } : null;
    }
    case "friend_request_accepted": {
      const publicId = stringField(notification.payload, "public_id");
      return publicId ? { to: "/users/$publicId", params: { publicId } } : null;
    }
    case "message": {
      const conversation = stringField(notification.payload, "conversation_id");
      return conversation ? { to: "/friends", search: { conversation } } : null;
    }
    case "game_invite":
    case "game_invite_response": {
      const invite = stringField(notification.payload, "invite_id");
      return invite ? { to: "/friends", search: { invite } } : null;
    }
    case "price_alert": {
      const gameId = notification.payload.catalog_game_id;
      return typeof gameId === "number" && gameId > 0
        ? { to: "/games/$gameId", params: { gameId: String(gameId) } }
        : null;
    }
    default:
      return null;
  }
}
