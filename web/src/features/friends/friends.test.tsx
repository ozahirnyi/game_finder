import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FriendsScreen } from "./FriendsScreen";

const api = vi.hoisted(() => ({
  acceptFriendRequest: vi.fn(),
  cancelFriendRequest: vi.fn(),
  createFriendRequest: vi.fn(),
  declineFriendRequest: vi.fn(),
  getSocialMe: vi.fn(),
  getSocialPlayers: vi.fn(),
  getSteamSocial: vi.fn(),
  updateSocialMe: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  useAuthState: vi.fn(),
}));

vi.mock("@/lib/api", () => api);
vi.mock("@/hooks/useAuthState", () => auth);

const friend = {
  id: "friend-id",
  public_id: "alex-public",
  nickname: "Alex",
  avatar: null,
};

const incoming = {
  id: "incoming-id",
  public_id: "sam-public",
  nickname: "Sam",
  avatar: null,
  status: "pending",
  created_at: "2026-07-26T12:00:00Z",
};

const outgoing = {
  id: "outgoing-id",
  public_id: "mira-public",
  nickname: "Mira",
  avatar: null,
  status: "pending",
  created_at: "2026-07-26T12:00:00Z",
};

const social = {
  public_id: "me/public",
  nickname: "Player One",
  avatar: null,
  friends: [friend],
  incoming_requests: [incoming],
  outgoing_requests: [outgoing],
};

const linkedSteam = {
  linked: true,
  steam_id: "owner-1",
  persona_name: "Player One",
  avatar: null,
  country_code: null,
  linked_at: null,
};

const steamFriend = {
  steam_id: "steam-alex",
  persona_name: "Steam Alex",
  avatar: null,
  friend_since: null,
  library_public: true,
  games_count: 20,
  common_games_count: 1,
  taste_match_percent: 75,
  common_games: [
    {
      appid: 1,
      name: "Deep Rock Galactic",
      playtime_forever: 120,
      playtime_2weeks: 0,
      img_icon_url: null,
    },
  ],
  top_games: [],
};

function steamPage(
  friends = [steamFriend],
  {
    total = friends.length,
    hasMore = false,
  }: { total?: number; hasMore?: boolean } = {},
) {
  return {
    steam: linkedSteam,
    friends,
    top_friend_games: [
      {
        appid: 1,
        name: "Deep Rock Galactic",
        friends: 2,
        total_playtime_forever: 500,
        img_icon_url: null,
      },
    ],
    public_libraries: friends.filter((item) => item.library_public).length,
    private_libraries: friends.filter((item) => !item.library_public).length,
    friends_total: total,
    friends_has_more: hasMore,
  };
}

describe("FriendsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.useAuthState.mockReturnValue(true);
    api.getSocialMe.mockResolvedValue(social);
    api.getSocialPlayers.mockResolvedValue({
      players: [],
      next_cursor: null,
    });
    api.getSteamSocial.mockResolvedValue(steamPage());
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("requires login before loading any private social data", () => {
    auth.useAuthState.mockReturnValue(false);

    render(<FriendsScreen />);

    expect(screen.getByRole("heading", { name: "Sign in to see friends" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?returnTo=%2Ffriends",
    );
    expect(api.getSocialMe).not.toHaveBeenCalled();
    expect(api.getSteamSocial).not.toHaveBeenCalled();
  });

  it("renders PlayFinder relationships and a separately counted Steam page", async () => {
    api.getSteamSocial.mockResolvedValue(steamPage([steamFriend], { total: 37 }));

    render(<FriendsScreen />);

    expect(await screen.findByRole("heading", { name: "My friends" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Message Alex" })).toHaveAttribute(
      "href",
      "/friends/friend-id/messages",
    );
    expect(screen.getByText("Sam")).toBeVisible();
    expect(screen.getByText("Mira")).toBeVisible();
    expect(await screen.findByText("37 Steam friends")).toBeVisible();
    expect(screen.getByText("Steam Alex")).toBeVisible();
    expect(api.getSteamSocial).toHaveBeenCalledWith(12, 0);
  });

  it("saves a required public nickname before exposing the workspace", async () => {
    api.getSocialMe.mockResolvedValue({ ...social, nickname: null });
    api.updateSocialMe.mockResolvedValue({ ...social, nickname: "Night Owl" });

    render(<FriendsScreen />);

    fireEvent.change(await screen.findByLabelText("Public nickname"), {
      target: { value: "  Night Owl  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save nickname" }));

    await waitFor(() =>
      expect(api.updateSocialMe).toHaveBeenCalledWith("Night Owl"),
    );
    expect(await screen.findByRole("heading", { name: "My friends" })).toBeVisible();
  });

  it("accepts incoming and cancels outgoing requests, then refreshes relationships", async () => {
    api.acceptFriendRequest.mockResolvedValue({ ...incoming, status: "accepted" });
    api.cancelFriendRequest.mockResolvedValue({ ...outgoing, status: "cancelled" });
    api.getSocialMe
      .mockResolvedValueOnce(social)
      .mockResolvedValueOnce({ ...social, incoming_requests: [] })
      .mockResolvedValueOnce({
        ...social,
        incoming_requests: [],
        outgoing_requests: [],
      });

    render(<FriendsScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Accept Sam" }));
    await waitFor(() =>
      expect(api.acceptFriendRequest).toHaveBeenCalledWith(incoming.id),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Cancel request to Mira" }));
    await waitFor(() =>
      expect(api.cancelFriendRequest).toHaveBeenCalledWith(outgoing.id),
    );
    expect(api.getSocialMe).toHaveBeenCalledTimes(3);
  });

  it("searches real players and exposes only the relevant request action", async () => {
    const player = {
      public_id: "zoe-public",
      nickname: "Zoe",
      avatar: null,
    };
    api.getSocialPlayers.mockResolvedValue({
      players: [player],
      next_cursor: null,
    });
    api.createFriendRequest.mockResolvedValue({
      ...player,
      id: "new-request",
      status: "pending",
      created_at: "2026-07-26T12:00:00Z",
    });

    render(<FriendsScreen />);

    fireEvent.change(await screen.findByRole("textbox", { name: "Find PlayFinder players" }), {
      target: { value: "zoe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search players" }));

    expect(await screen.findByText("Zoe")).toBeVisible();
    expect(api.getSocialPlayers).toHaveBeenLastCalledWith("zoe");
    fireEvent.click(screen.getByRole("button", { name: "Add Zoe" }));
    await waitFor(() =>
      expect(api.createFriendRequest).toHaveBeenCalledWith("zoe-public"),
    );
    expect(
      (await screen.findAllByRole("button", { name: "Cancel request to Zoe" }))
        .length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Add Zoe" })).not.toBeInTheDocument();
  });

  it("copies the public profile link and falls back when Clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });

    render(<FriendsScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Copy invite link" }));

    await waitFor(() => expect(execCommand).toHaveBeenCalledWith("copy"));
    expect(screen.getByRole("status")).toHaveTextContent("Invite link copied");
  });

  it("loads later Steam pages without duplicate friends", async () => {
    api.getSteamSocial
      .mockResolvedValueOnce(steamPage([steamFriend], { total: 2, hasMore: true }))
      .mockResolvedValueOnce(
        steamPage(
          [
            steamFriend,
            {
              ...steamFriend,
              steam_id: "steam-sam",
              persona_name: "Steam Sam",
            },
          ],
          { total: 2 },
        ),
      );

    render(<FriendsScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Show more Steam friends" }));

    expect(await screen.findByText("Steam Sam")).toBeVisible();
    expect(screen.getAllByText("Steam Alex")).toHaveLength(1);
    expect(api.getSteamSocial).toHaveBeenLastCalledWith(12, 1);
  });

  it("opens chat with an unsubmitted draft only after a shared game is selected", async () => {
    render(<FriendsScreen />);

    const gameSelect = await screen.findByLabelText("Game to invite Alex to");
    expect(screen.queryByRole("link", { name: "Invite Alex to play" })).not.toBeInTheDocument();
    fireEvent.change(gameSelect, { target: { value: "Deep Rock Galactic" } });

    expect(screen.getByRole("link", { name: "Invite Alex to play" })).toHaveAttribute(
      "href",
      "/friends/friend-id/messages?draft=Let's%20play%20Deep%20Rock%20Galactic!",
    );
  });
});
