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
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  getBlockedUsers: vi.fn().mockResolvedValue([]),
  syncSteamFriends: vi.fn().mockResolvedValue({ status: "synced", added: 0, message: null }),
  blockUser: vi.fn(),
  removeFriend: vi.fn(),
  unblockUser: vi.fn(),
  markNotificationRead: vi.fn(),
  acceptFriendRequest: vi.fn(),
  createFriendRequest: vi.fn(),
  createSocialFriendRequest: vi.fn(),
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
vi.mock("@/components/GameCover", () => ({
  Avatar: ({ image, name }: { image?: string; name: string }) => <img alt={name} src={image} />,
  GameCover: () => <div />,
}));

import { Route } from "./friends.index";

function renderFriends(prefetchedSteamSocial?: unknown, initialEntry = "/") {
  const rootRoute = createRootRoute({ component: Outlet });
  const friendsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: Route.options.component,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      friendsRoute,
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/messages/$conversationId",
        component: () => <p>Dedicated chat</p>,
      }),
    ]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
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
    api.createSocialFriendRequest.mockResolvedValue({ id: "request-1" });
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

  it("links a search result to that player's canonical public profile", async () => {
    api.searchUsers.mockResolvedValue([
      { id: "player-1", public_id: "sam-public", display_name: "Sam" },
    ]);
    renderFriends();

    fireEvent.click((await screen.findAllByRole("button", { name: "Add friend" }))[0]);
    fireEvent.change(screen.getByLabelText("Player name"), { target: { value: "Sam" } });

    expect(await screen.findByRole("link", { name: "Sam" })).toHaveAttribute(
      "href",
      "/users/sam-public",
    );
  });

  it("accepts an incoming friend request", async () => {
    api.getIncomingFriendRequests.mockResolvedValue([
      { id: "request-1", sender: { id: "player-1", display_name: "Sam" } },
    ]);
    renderFriends();

    fireEvent.click(await screen.findByRole("button", { name: "Accept Sam" }));

    await waitFor(() => expect(api.acceptFriendRequest).toHaveBeenCalledWith("request-1"));
  });

  it("focuses a deep-linked incoming friend request", async () => {
    api.getIncomingFriendRequests.mockResolvedValue([
      { id: "request-1", sender: { id: "player-1", display_name: "Sam" } },
    ]);
    renderFriends(undefined, "/?request=request-1");

    expect(await screen.findByTestId("notification-request-request-1")).toHaveAttribute(
      "data-notification-target",
      "true",
    );
  });

  it("shows one neutral state when a deep-linked action is unavailable", async () => {
    renderFriends(undefined, "/?invite=missing");

    expect(
      await screen.findByText("This notification action is no longer available."),
    ).toBeInTheDocument();
  });

  it("selects the message conversation target", async () => {
    api.getFriends.mockResolvedValue([{ user: { id: "player-1", display_name: "Sam" } }]);
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
    renderFriends(undefined, "/?conversation=conversation-1");

    expect(await screen.findByText("Dedicated chat")).toBeInTheDocument();
  });

  it("focuses a deep-linked incoming invite", async () => {
    api.getGameInvites.mockResolvedValue([
      {
        id: "invite-1",
        sender: { id: "player-1", display_name: "Sam" },
        recipient: { id: "me", display_name: "Me" },
        game_name: "Portal 2",
        status: "pending",
      },
    ]);
    renderFriends(undefined, "/?invite=invite-1");

    expect(await screen.findByTestId("notification-invite-invite-1")).toHaveAttribute(
      "data-notification-target",
      "true",
    );
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

  it("confirms the accepted game invitation by name", async () => {
    api.getGameInvites.mockResolvedValue([
      {
        id: "invite-1",
        sender: { id: "player-1", display_name: "Sam" },
        recipient: { id: "me", display_name: "Me" },
        game_name: "Portal 2",
        status: "pending",
      },
    ]);
    api.respondToGameInvite.mockResolvedValue({ id: "invite-1", game_name: "Portal 2" });
    renderFriends();

    fireEvent.click(await screen.findByRole("button", { name: "Accept Portal 2" }));

    expect(await screen.findByText("You accepted the invitation to Portal 2.")).toBeInTheDocument();
  });

  it("selects a friend from the list and keeps profile navigation explicit", async () => {
    api.getFriends.mockResolvedValue([
      { user: { id: "player-1", public_id: "sam-public", display_name: "Sam" } },
      { user: { id: "player-2", public_id: "alex-public", display_name: "Alex" } },
    ]);
    api.getConversations.mockResolvedValue([
      {
        id: "conversation-1",
        participant: { id: "player-1", public_id: "sam-public", display_name: "Sam" },
      },
      {
        id: "conversation-2",
        participant: { id: "player-2", public_id: "alex-public", display_name: "Alex" },
      },
    ]);
    api.getConversationMessages.mockImplementation((id: string) =>
      Promise.resolve([
        {
          id: `message-${id}`,
          sender_id: id === "conversation-1" ? "player-1" : "player-2",
          body: id === "conversation-1" ? "Sam's message" : "Alex's message",
          created_at: "2026-08-14T12:00:00Z",
        },
      ]),
    );
    renderFriends();

    fireEvent.click(await screen.findByRole("button", { name: "Select Alex" }));

    expect(await screen.findByRole("link", { name: "Open chat" })).toHaveAttribute(
      "href",
      "/messages?friend=player-2",
    );
    expect(screen.queryByRole("link", { name: "View Alex's profile" })).not.toBeInTheDocument();
  });

  it("enables message and invite actions for an existing friend", async () => {
    api.getFriends.mockResolvedValue([{ user: { id: "player-1", display_name: "Sam" } }]);
    renderFriends();

    expect(await screen.findByRole("link", { name: "Open chat" })).toBeEnabled();
    expect(screen.getAllByRole("button", { name: "Invite to play" })[0]).toBeEnabled();
  });

  it("does not present unavailable social metrics as statistics", async () => {
    api.getFriends.mockResolvedValue([{ user: { id: "player-1", display_name: "Sam" } }]);
    renderFriends();

    await screen.findByRole("link", { name: "Open chat" });
    expect(screen.getByText("Compatibility")).toBeInTheDocument();
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
    expect(screen.getByRole("link", { name: "Open chat" })).toHaveAttribute(
      "href",
      "/messages?friend=player-1",
    );
    expect(screen.getByRole("button", { name: "Accept Portal 2" })).toBeInTheDocument();
    expect(screen.queryByText("Activity")).not.toBeInTheDocument();
    expect(api.getFriendSocialSummary).toHaveBeenCalledWith("player-1");
  });

  it("shows the selected friend's real identity and social summary", async () => {
    api.getFriends.mockResolvedValue([
      {
        user: {
          id: "player-1",
          public_id: "sam-public",
          display_name: "Sam",
          steam_persona_name: "SamOnSteam",
          bio: "Collects co-op games",
          avatar: "https://cdn.example/sam.png",
        },
      },
    ]);
    api.getFriendSocialSummary.mockResolvedValue({
      shared_games: 3,
      compatibility_percent: 86,
      wishlist_count: 4,
    });
    renderFriends();

    await screen.findByRole("button", { name: "Select SamOnSteam" });

    const selectedFriendLink = screen.getByRole("link", {
      name: "Open selected friend's profile",
    });
    expect(within(selectedFriendLink).getByRole("img", { name: "SamOnSteam" })).toHaveAttribute(
      "src",
      "https://cdn.example/sam.png",
    );
    expect(within(selectedFriendLink).getByText(/SamOnSteam/)).toBeInTheDocument();
    expect(screen.getByText("Collects co-op games")).toBeInTheDocument();
    expect(await screen.findByText("86%")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Compatibility")).toBeInTheDocument();
    expect(screen.getByText("Shared games")).toBeInTheDocument();
  });

  it("shows unavailable rather than fabricated social-summary data", async () => {
    api.getFriends.mockResolvedValue([{ user: { id: "player-1", display_name: "Sam" } }]);
    api.getFriendSocialSummary.mockRejectedValue(new Error("Summary unavailable"));
    renderFriends();

    expect(await screen.findAllByText("Unavailable")).toHaveLength(3);
  });

  it("automatically synchronizes contacts without the old Steam tab or request", async () => {
    api.getSteamSocial.mockClear();
    api.syncSteamFriends.mockClear();
    renderFriends();
    await screen.findByRole("heading", { name: "Friends" });
    await waitFor(() => expect(api.syncSteamFriends).toHaveBeenCalledWith(false));
    expect(screen.queryByRole("button", { name: "Steam friends" })).not.toBeInTheDocument();
    expect(api.getSteamSocial).not.toHaveBeenCalled();
  });

  it("shows a Friends skeleton while its first request is pending", async () => {
    api.getFriends.mockImplementation(() => new Promise(() => {}));

    renderFriends();

    expect(await screen.findByTestId("friends-loading")).toBeInTheDocument();
  });
});
