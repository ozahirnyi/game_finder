import type { Notification } from "./api";

export type NotificationDestination =
  | { to: "/messages/$conversationId"; params: { conversationId: string } }
  | {
      to: "/friends";
      search: { request?: string; conversation?: string; invite?: string; notification?: string };
    }
  | { to: "/users/$publicId"; params: { publicId: string } }
  | {
      to: "/games/$gameId";
      params: { gameId: string };
      search?: { source?: "steam"; offer?: string };
    };

const stringField = (payload: Record<string, unknown>, key: string) =>
  typeof payload[key] === "string" && payload[key] ? payload[key] : null;

export function notificationDestination(
  notification: Notification,
): NotificationDestination | null {
  switch (notification.type) {
    case "friend_request": {
      const request = stringField(notification.payload, "request_id");
      return request
        ? { to: "/friends", search: { request, notification: notification.id } }
        : null;
    }
    case "friend_request_accepted": {
      const publicId = stringField(notification.payload, "public_id");
      return publicId ? { to: "/users/$publicId", params: { publicId } } : null;
    }
    case "message": {
      const conversation = stringField(notification.payload, "conversation_id");
      return conversation
        ? { to: "/messages/$conversationId", params: { conversationId: conversation } }
        : null;
    }
    case "game_invite":
    case "game_invite_response": {
      const conversation = stringField(notification.payload, "conversation_id");
      if (conversation) {
        return { to: "/messages/$conversationId", params: { conversationId: conversation } };
      }
      const invite = stringField(notification.payload, "invite_id");
      return invite ? { to: "/friends", search: { invite, notification: notification.id } } : null;
    }
    case "price_alert": {
      const source = stringField(notification.payload, "source");
      const externalId = stringField(notification.payload, "external_id");
      if (source === "steam" && externalId && /^\d+$/.test(externalId)) {
        return {
          to: "/games/$gameId",
          params: { gameId: externalId },
          search: { source: "steam", offer: notification.id },
        };
      }
      if (source === "catalog" && externalId?.startsWith("igdb:")) {
        const gameId = externalId.slice(5);
        if (/^\d+$/.test(gameId))
          return {
            to: "/games/$gameId",
            params: { gameId },
            search: { offer: notification.id },
          };
      }
      const gameId = notification.payload.catalog_game_id;
      return typeof gameId === "number" && gameId > 0
        ? { to: "/games/$gameId", params: { gameId: String(gameId) } }
        : null;
    }
    default:
      return null;
  }
}
