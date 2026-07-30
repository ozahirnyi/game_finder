// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  acceptFriendRequest: vi.fn(),
  createFriendRequest: vi.fn(),
  getFriends: vi.fn(),
  getIncomingFriendRequests: vi.fn(),
  searchUsers: vi.fn(),
}));

vi.mock("@/lib/api", () => api);
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/GameCover", () => ({ Avatar: () => <div />, GameCover: () => <div /> }));

import { Route } from "./friends.index";

function renderFriends() {
  const rootRoute = createRootRoute({ component: Outlet });
  const friendsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: Route.options.component });
  const router = createRouter({ routeTree: rootRoute.addChildren([friendsRoute]), history: createMemoryHistory({ initialEntries: ["/"] }) });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>);
}

describe("FriendsPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    cleanup();
    api.getFriends.mockResolvedValue([]);
    api.getIncomingFriendRequests.mockResolvedValue([]);
    api.searchUsers.mockResolvedValue([{ id: "player-1", display_name: "Sam" }]);
    api.createFriendRequest.mockResolvedValue({ id: "request-1" });
    api.acceptFriendRequest.mockResolvedValue({ user: { id: "player-1", display_name: "Sam" } });
  });

  it("searches for a player and sends a friend request", async () => {
    renderFriends();

    fireEvent.click((await screen.findAllByRole("button", { name: "Add friend" }))[0]);
    fireEvent.change(screen.getByLabelText("Player name"), { target: { value: "Sam" } });

    await waitFor(() => expect(api.searchUsers).toHaveBeenCalledWith("Sam"));
    fireEvent.click(await screen.findByRole("button", { name: "Add Sam" }));
    await waitFor(() => expect(api.createFriendRequest).toHaveBeenCalledWith({ recipient_id: "player-1" }));
    expect(await screen.findByText("Request sent")).toBeInTheDocument();
  });

  it("accepts an incoming friend request", async () => {
    api.getIncomingFriendRequests.mockResolvedValue([{ id: "request-1", sender: { id: "player-1", display_name: "Sam" } }]);
    renderFriends();

    fireEvent.click(await screen.findByRole("button", { name: "Accept Sam" }));

    await waitFor(() => expect(api.acceptFriendRequest).toHaveBeenCalledWith("request-1"));
  });
});
