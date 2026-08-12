// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}));

vi.mock("@/lib/api", () => api);

import { NotificationsPanel } from "./NotificationsPanel";

function renderPanel() {
  const rootRoute = createRootRoute({ component: Outlet });
  const panelRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: NotificationsPanel,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([panelRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

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
    renderPanel();

    expect(await screen.findByText("Sam accepted your friend request.")).toBeInTheDocument();
    expect(screen.getByText("Friend request accepted")).toBeInTheDocument();
    expect(screen.queryByText("friend_request_accepted")).not.toBeInTheDocument();
  });

  it("does not mark an unsupported notification as read", async () => {
    api.getNotifications.mockResolvedValue([
      { id: "notification-2", type: "game_invite", payload: {}, created_at: "2026-07-30T12:00:00Z" },
    ]);
    renderPanel();

    fireEvent.click(await screen.findByText("Game invite"));

    expect(await screen.findByText("This notification action is no longer available.")).toBeInTheDocument();
    await waitFor(() => expect(api.markNotificationRead).not.toHaveBeenCalled());
  });
});
