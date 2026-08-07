import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NotificationsMenu } from "./NotificationsMenu";
import { listNotifications, markNotificationRead } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}));

describe("NotificationsMenu", () => {
  it("navigates to a positive catalog game before marking it read", async () => {
    vi.mocked(listNotifications).mockResolvedValue([
      {
        id: "n1",
        event_type: "price_alert",
        target_kind: "catalog_game",
        game_id: "30",
        saved_game_id: null,
        price_alert_id: "a",
        offer_url: null,
        read_at: null,
        created_at: "",
      },
    ]);
    const order: string[] = [];
    render(
      <NotificationsMenu
        navigate={(target) => order.push(target)}
        markRead={async () => order.push("read")}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Price alert" }));
    expect(order).toEqual(["/games/30", "read"]);
  });

  it("keeps an invalid target unread and visible as unavailable", async () => {
    vi.mocked(listNotifications).mockResolvedValue([
      {
        id: "n1",
        event_type: "price_alert",
        target_kind: "catalog_game",
        game_id: "0",
        saved_game_id: null,
        price_alert_id: "a",
        offer_url: "http://unsafe.example",
        read_at: null,
        created_at: "",
      },
    ]);
    render(<NotificationsMenu />);
    fireEvent.click(await screen.findByRole("button", { name: "Price alert" }));
    expect(
      await screen.findByText("This price alert is no longer available."),
    ).toBeVisible();
    expect(markNotificationRead).not.toHaveBeenCalled();
  });

  it("uses an external handler only for valid HTTPS offers", async () => {
    vi.mocked(listNotifications).mockResolvedValue([
      {
        id: "n2",
        event_type: "price_alert",
        target_kind: "offer",
        game_id: null,
        saved_game_id: null,
        price_alert_id: "a",
        offer_url: "https://shop.example/hades",
        read_at: null,
        created_at: "",
      },
    ]);
    const openExternal = vi.fn();
    render(
      <NotificationsMenu
        navigate={vi.fn()}
        openExternal={openExternal}
        markRead={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Price alert" }));
    expect(openExternal).toHaveBeenCalledWith("https://shop.example/hades");
  });

  it("navigates to a message before marking it read", async () => {
    vi.mocked(listNotifications).mockResolvedValue([
      {
        id: "n3",
        event_type: "message",
        target_kind: "message",
        game_id: null,
        saved_game_id: null,
        price_alert_id: null,
        offer_url: null,
        friend_request_id: null,
        friendship_id: "friend-1",
        direct_message_id: "message-1",
        game_invite_id: null,
        read_at: null,
        created_at: "",
      },
    ]);
    const order: string[] = [];
    render(
      <NotificationsMenu
        navigate={(target) => order.push(target)}
        markRead={async () => order.push("read")}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "New message" }));
    expect(order).toEqual(["/friends/friend-1/messages", "read"]);
  });
});
