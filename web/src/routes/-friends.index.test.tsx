// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  acceptFriendRequest: vi.fn(),
  createFriendRequest: vi.fn(),
  getFriends: vi.fn(),
  getIncomingFriendRequests: vi.fn(),
  getSteamSocial: vi.fn(),
  searchUsers: vi.fn(),
}));

vi.mock("@/lib/api", () => api);
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/GameCover", () => ({ Avatar: () => <div />, GameCover: () => <div /> }));

import { Route } from "./friends.index";

function renderFriends(prefetchedSteamSocial?: unknown) {
  const rootRoute = createRootRoute({ component: Outlet });
  const friendsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: Route.options.component,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([friendsRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (prefetchedSteamSocial) {
    queryClient.setQueryData(["steam-social"], {
      pages: [prefetchedSteamSocial],
      pageParams: [0],
    });
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("FriendsPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    cleanup();
    api.getFriends.mockResolvedValue([]);
    api.getIncomingFriendRequests.mockResolvedValue([]);
    api.getSteamSocial.mockResolvedValue({
      friends: [
        {
          steam_id: "765",
          persona_name: "Steam Sam",
          taste_match_percent: 67,
          common_games_count: 3,
          library_public: true,
        },
      ],
      friends_total: 1,
      top_friend_games: [],
    });
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
    await waitFor(() =>
      expect(api.createFriendRequest).toHaveBeenCalledWith({ recipient_id: "player-1" }),
    );
    expect(await screen.findByText("Request sent")).toBeInTheDocument();
  });

  it("accepts an incoming friend request", async () => {
    api.getIncomingFriendRequests.mockResolvedValue([
      { id: "request-1", sender: { id: "player-1", display_name: "Sam" } },
    ]);
    renderFriends();

    fireEvent.click(await screen.findByRole("button", { name: "Accept Sam" }));

    await waitFor(() => expect(api.acceptFriendRequest).toHaveBeenCalledWith("request-1"));
  });

  it("enables message and invite actions for an existing friend", async () => {
    api.getFriends.mockResolvedValue([{ user: { id: "player-1", display_name: "Sam" } }]);
    renderFriends();

    expect(await screen.findByRole("button", { name: "Message" })).toBeEnabled();
    expect(screen.getAllByRole("button", { name: "Invite to play" })[0]).toBeEnabled();
  });

  it("shows Steam friends with taste match and a Steam profile link", async () => {
    renderFriends();

    expect(await screen.findByText("Steam Sam")).toBeInTheDocument();
    expect(screen.getByText("67% match · 3 shared")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Steam Sam" })).toHaveAttribute(
      "href",
      "https://steamcommunity.com/profiles/765",
    );
  });

  it("loads the next page of Steam friends", async () => {
    api.getSteamSocial.mockImplementation((_limit: number, offset: number) =>
      Promise.resolve(
        offset === 0
          ? {
              friends: [
                {
                  steam_id: "765",
                  persona_name: "Steam Sam",
                  taste_match_percent: 67,
                  common_games_count: 3,
                  library_public: true,
                },
              ],
              friends_total: 2,
              friends_has_more: true,
              top_friend_games: [],
            }
          : {
              friends: [
                {
                  steam_id: "766",
                  persona_name: "Steam Pat",
                  taste_match_percent: 42,
                  common_games_count: 1,
                  library_public: true,
                },
              ],
              friends_total: 2,
              friends_has_more: false,
              top_friend_games: [],
            },
      ),
    );
    renderFriends();

    fireEvent.click(await screen.findByRole("button", { name: "Show more Steam friends" }));

    expect(await screen.findByText("Steam Pat")).toBeInTheDocument();
    expect(api.getSteamSocial).toHaveBeenLastCalledWith(12, 1);
  });

  it("does not crash after Steam friends were prefetched from navigation", async () => {
    renderFriends({
      friends: [
        {
          steam_id: "765",
          persona_name: "Steam Sam",
          taste_match_percent: 67,
          common_games_count: 3,
          library_public: true,
        },
      ],
      friends_total: 1,
      friends_has_more: false,
      top_friend_games: [],
    });

    expect(await screen.findByText("Steam Sam")).toBeInTheDocument();
  });

  it("shows a Friends skeleton while its first request is pending", async () => {
    api.getFriends.mockImplementation(() => new Promise(() => {}));

    renderFriends();

    expect(await screen.findByTestId("friends-loading")).toBeInTheDocument();
  });

  it("uses a separate Steam tab and sorts friends by match", async () => {
    api.getSteamSocial.mockResolvedValue({
      friends: [
        {
          steam_id: "1",
          persona_name: "Low match",
          taste_match_percent: 12,
          common_games_count: 1,
          library_public: true,
        },
        {
          steam_id: "2",
          persona_name: "High match",
          taste_match_percent: 88,
          common_games_count: 8,
          library_public: true,
        },
      ],
      friends_total: 2,
      friends_has_more: false,
      top_friend_games: [],
    });
    renderFriends();

    fireEvent.click(await screen.findByRole("button", { name: "Steam friends" }));
    const names = await screen.findAllByRole("link");
    expect(names.map((link) => link.getAttribute("aria-label"))).toEqual([
      "High match",
      "Low match",
    ]);
  });
});
