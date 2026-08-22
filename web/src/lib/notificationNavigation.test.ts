import { describe, expect, it } from "vitest";
import type { Notification } from "./api";
import { notificationDestination } from "./notificationNavigation";

const notification = (type: string, payload: Record<string, unknown>) =>
  ({ id: "n", type, payload, created_at: "2026-08-13T00:00:00Z" }) as Notification;

describe("notificationDestination", () => {
  it("maps supported payloads to existing routes", () => {
    expect(notificationDestination(notification("friend_request", { request_id: "r-1" }))).toEqual({
      to: "/friends",
      search: { request: "r-1", notification: "n" },
    });
    expect(
      notificationDestination(notification("friend_request_accepted", { public_id: "sam" })),
    ).toEqual({
      to: "/users/$publicId",
      params: { publicId: "sam" },
    });
    expect(notificationDestination(notification("message", { conversation_id: "c-1" }))).toEqual({
      to: "/friends",
      search: { conversation: "c-1", notification: "n" },
    });
    expect(notificationDestination(notification("price_alert", { catalog_game_id: 42 }))).toEqual({
      to: "/games/$gameId",
      params: { gameId: "42" },
    });
    expect(
      notificationDestination(notification("game_invite_response", { invite_id: "i-1" })),
    ).toEqual({
      to: "/friends",
      search: { invite: "i-1", notification: "n" },
    });
  });

  it("rejects malformed targets", () => {
    expect(notificationDestination(notification("game_invite", {}))).toBeNull();
    expect(notificationDestination(notification("price_alert", { catalog_game_id: 0 }))).toBeNull();
  });
});
