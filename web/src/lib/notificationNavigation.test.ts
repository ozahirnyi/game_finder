import { describe, expect, it } from "vitest";
import type { Notification } from "./api";
import { notificationDestination } from "./notificationNavigation";

const notification = (type: string, payload: Record<string, unknown>) =>
  ({ id: "n", type, payload, created_at: "2026-08-13T00:00:00Z" }) as Notification;

describe("notificationDestination", () => {
  it("maps supported payloads to existing routes", () => {
    expect(notificationDestination(notification("message", { conversation_id: "c-1" }))).toEqual({
      to: "/friends",
      search: { conversation: "c-1" },
    });
    expect(notificationDestination(notification("price_alert", { catalog_game_id: 42 }))).toEqual({
      to: "/games/$gameId",
      params: { gameId: "42" },
    });
  });

  it("rejects malformed targets", () => {
    expect(notificationDestination(notification("game_invite", {}))).toBeNull();
    expect(notificationDestination(notification("price_alert", { catalog_game_id: 0 }))).toBeNull();
  });
});
