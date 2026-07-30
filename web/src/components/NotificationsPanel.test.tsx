// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}));

vi.mock("@/lib/api", () => api);

import { NotificationsPanel } from "./NotificationsPanel";

describe("NotificationsPanel", () => {
  beforeEach(() => {
    api.getNotifications.mockResolvedValue([
      {
        id: "notification-1",
        type: "friend_request_accepted",
        payload: { by: "Sam" },
        created_at: "2026-07-30T12:00:00Z",
      },
    ]);
  });

  it("turns friend-request payloads into a readable notification", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <NotificationsPanel />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Sam accepted your friend request.")).toBeInTheDocument();
  });
});
