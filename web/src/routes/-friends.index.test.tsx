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
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
    }
  },
  acceptFriendRequest: vi.fn(),
  createFriendRequest: vi.fn(),
  getFriends: vi.fn(),
  getGameInvites: vi.fn(),
  getFriendActivity: vi.fn(),
  getFriendSocialSummary: vi.fn(),
  getConversationMessages: vi.fn(),
  getConversations: vi.fn(),
  getIncomingFriendRequests: vi.fn(),
  getSharedGames: vi.fn(),
  getSteamSocial: vi.fn(),
  searchUsers: vi.fn(),
  respondToGameInvite: vi.fn(),
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
    api.getGameInvites.mockResolvedValue([]);
    api.getConversations.mockResolvedValue([]);
    api.getConversationMessages.mockResolvedValue([]);
    api.getFriendSocialSummary.mockResolvedValue({
      shared_games: 0,
      compatibility_percent: 0,
      wishlist_count: null,
    });
    api.getSharedGames.mockResolvedValue({
      status: "empty",
      data: [],
      message: "No shared saved games yet.",
    });
    api.respondToGameInvite.mockResolvedValue({});
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

  it("accepts an incoming game invite", async () => {
    api.getGameInvites.mockResolvedValue([
      {
        id: "invite-1",
        sender: { id: "player-1", display_name: "Sam" },
        recipient: { id: "me", display_name: "Me" },
        game_name: "Portal 2",
        status: "pending",
      },
    ]);
    renderFriends();

    fireEvent.click(await screen.findByRole("button", { name: "Accept Portal 2" }));
    await waitFor(() =>
      expect(api.respondToGameInvite).toHaveBeenCalledWith("invite-1", "accepted"),
    );
  });

  it("enables message and invite actions for an existing friend", async () => {
    api.getFriends.mockResolvedValue([{ user: { id: "player-1", display_name: "Sam" } }]);
    renderFriends();

    expect(await screen.findByRole("button", { name: "Message" })).toBeEnabled();
    expect(screen.getAllByRole("button", { name: "Invite to play" })[0]).toBeEnabled();
  });

  it("does not present unavailable social metrics as statistics", async () => {
    api.getFriends.mockResolvedValue([{ user: { id: "player-1", display_name: "Sam" } }]);
    renderFriends();

    await screen.findByRole("button", { name: "Message" });
    expect(screen.queryByText("Compatibility")).not.toBeInTheDocument();
    expect(screen.queryByText("Shared: вЂ”")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Messaging is coming soon")).not.toBeInTheDocument();
  });

  it("shows real messages and game invitations for the selected friend in the rail", async () => {
    api.getFriends.mockResolvedValue([{ user: { id: "player-1", display_name: "Sam" } }]);
    api.getFriendSocialSummary.mockResolvedValue({
      shared_games: 1,
      compatibility_percent: 100,
      wishlist_count: 2,
    });
    api.getGameInvites.mockResolvedValue([
      {
        id: "invite-1",
        sender: { id: "player-1", display_name: "Sam" },
        recipient: { id: "me", display_name: "Me" },
        game_name: "Portal 2",
        status: "pending",
      },
    ]);
    api.getConversations.mockResolvedValue([
      { id: "conversation-1", participant: { id: "player-1", display_name: "Sam" } },
    ]);
    api.getConversationMessages.mockResolvedValue([
      {
        id: "message-1",
        sender_id: "player-1",
        body: "Ready tonight?",
        created_at: "2026-08-05T12:00:00Z",
      },
    ]);
    renderFriends();

    expect(await screen.findByText("Selected friend")).toBeInTheDocument();
    expect(await screen.findByText("100%")).toBeInTheDocument();
    expect(screen.getByText("Game invitation: Portal 2")).toBeInTheDocument();
    expect(screen.getByText("Ready tonight?")).toBeInTheDocument();
    expect(screen.queryByText("Activity")).not.toBeInTheDocument();
    expect(api.getFriendSocialSummary).toHaveBeenCalledWith("player-1");
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
