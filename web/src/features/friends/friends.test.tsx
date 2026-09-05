import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FriendsScreen } from "./FriendsScreen";
import { acceptFriendRequest, ApiError, declineFriendRequest, getSocialSnapshot, getSteamSocial, isAuthenticated, sendFriendRequest } from "@/lib/api";

const api = vi.hoisted(() => {
  class MockApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  }

  return { ApiError: MockApiError, acceptFriendRequest: vi.fn(), declineFriendRequest: vi.fn(), getSocialSnapshot: vi.fn(), getSteamSocial: vi.fn(), isAuthenticated: vi.fn(), sendFriendRequest: vi.fn() };
});

vi.mock("@/lib/api", () => api);
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => <a {...props} href={to}>{children}</a>,
}));

const linkedSteam = {
  linked: true,
  steam_id: "owner-1",
  persona_name: "Player One",
  avatar: null,
  country_code: null,
  linked_at: null,
};

const friend = {
  steam_id: "friend-1",
  persona_name: "Alex",
  avatar: "https://example.test/alex.jpg",
  friend_since: null,
  library_public: true,
  games_count: 20,
  common_games_count: 4,
  taste_match_percent: 75,
  common_games: [{ appid: 1, name: "Deep Rock Galactic", playtime_forever: 120, playtime_2weeks: 0, img_icon_url: null }],
  top_games: [],
};

describe("FriendsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAuthenticated).mockReturnValue(true);
    vi.mocked(getSocialSnapshot).mockResolvedValue({
      me: { id: "me", display_name: "Me", avatar: null, steam_profile_url: null, steam_add_url: null },
      friends: [], incoming_requests: [], outgoing_requests: [], steam_suggestions: [], steam_suggestions_error: null,
    });
  });

  it("renders Steam friend results from the social endpoint", async () => {
    vi.mocked(getSteamSocial).mockResolvedValue({ steam: linkedSteam, friends: [friend], top_friend_games: [], public_libraries: 1, private_libraries: 0 });

    render(<FriendsScreen />);

    expect(await screen.findByText(friend.persona_name!)).toBeVisible();
    expect(screen.getByText("4 games in common")).toBeVisible();
    expect(screen.getByText("75% taste match")).toBeVisible();
    expect(screen.getByText("Deep Rock Galactic")).toBeVisible();
    expect(screen.getByRole("img", { name: "Alex's Steam avatar" })).toHaveAttribute("src", friend.avatar);
  });

  it("renders GameFinder relationships and replaces its social snapshot after actions", async () => {
    const accepted = { id: "friend-1", display_name: "Alex", avatar: null, steam_profile_url: "https://steamcommunity.com/profiles/765", steam_add_url: "https://steamcommunity.com/profiles/765/friends/add" };
    vi.mocked(getSocialSnapshot).mockResolvedValue({
      me: { id: "me", display_name: "Me", avatar: null, steam_profile_url: null, steam_add_url: null },
      friends: [accepted],
      incoming_requests: [{ id: "request-1", sender: { id: "sender-1", display_name: "Sam", avatar: null, steam_profile_url: null, steam_add_url: null } }],
      outgoing_requests: [],
      steam_suggestions: [{ id: "suggestion-1", display_name: "Taylor", avatar: null, steam_profile_url: null, steam_add_url: null }],
      steam_suggestions_error: null,
    });
    vi.mocked(acceptFriendRequest).mockResolvedValue({ me: { id: "me", display_name: "Me", avatar: null, steam_profile_url: null, steam_add_url: null }, friends: [accepted], incoming_requests: [], outgoing_requests: [], steam_suggestions: [{ id: "suggestion-1", display_name: "Taylor", avatar: null, steam_profile_url: null, steam_add_url: null }], steam_suggestions_error: null });
    vi.mocked(sendFriendRequest).mockResolvedValue({ me: { id: "me", display_name: "Me", avatar: null, steam_profile_url: null, steam_add_url: null }, friends: [accepted], incoming_requests: [], outgoing_requests: [], steam_suggestions: [], steam_suggestions_error: null });

    render(<FriendsScreen />);

    expect(await screen.findByRole("heading", { name: "Incoming friend requests" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "My GameFinder friends" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Friends from Steam on GameFinder" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Open Steam profile" })).toHaveAttribute("href", accepted.steam_profile_url);
    expect(screen.getByRole("link", { name: "Open Steam profile" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "Add on Steam" })).toHaveAttribute("href", accepted.steam_add_url);
    expect(screen.getByRole("link", { name: "Add on Steam" })).toHaveAttribute("rel", "noopener noreferrer");
    fireEvent.click(screen.getByRole("button", { name: "Accept Sam" }));
    await waitFor(() => expect(acceptFriendRequest).toHaveBeenCalledWith("request-1"));
    expect(screen.queryByText("Sam")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add friend: Taylor" }));
    await waitFor(() => expect(sendFriendRequest).toHaveBeenCalledWith("suggestion-1"));
  });

  it("keeps existing friends visible when a friend action fails", async () => {
    vi.mocked(getSocialSnapshot).mockResolvedValue({ me: { id: "me", display_name: "Me", avatar: null, steam_profile_url: null, steam_add_url: null }, friends: [], incoming_requests: [], outgoing_requests: [], steam_suggestions: [{ id: "suggestion-1", display_name: "Taylor", avatar: null, steam_profile_url: null, steam_add_url: null }], steam_suggestions_error: null });
    vi.mocked(sendFriendRequest).mockRejectedValue(new Error("Request unavailable"));
    render(<FriendsScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Add friend: Taylor" }));
    expect(await screen.findByText("Request unavailable")).toBeVisible();
    expect(screen.getByText("Taylor")).toBeVisible();
  });

  it("shows the Steam connect state for the backend's unlinked-account response", async () => {
    vi.mocked(getSteamSocial).mockRejectedValue(new ApiError("Connect Steam first", 409));

    render(<FriendsScreen />);

    expect(await screen.findByText("Connect Steam to see friends")).toBeVisible();
    expect(screen.getByRole("link", { name: "Connect Steam" })).toHaveAttribute("href", "/steam");
    expect(screen.queryByText("Sasha K.")).not.toBeInTheDocument();
  });

  it("does not request Steam social data when signed out", () => {
    vi.mocked(isAuthenticated).mockReturnValue(false);

    render(<FriendsScreen />);

    expect(getSteamSocial).not.toHaveBeenCalled();
    expect(screen.getByText("Sign in to see friends")).toBeVisible();
  });

  it("offers a retry when Steam social data is unavailable", async () => {
    vi.mocked(getSteamSocial)
      .mockRejectedValueOnce(new ApiError("Steam service is unavailable", 503))
      .mockResolvedValueOnce({ steam: linkedSteam, friends: [], top_friend_games: [], public_libraries: 0, private_libraries: 0 });

    render(<FriendsScreen />);

    expect(await screen.findByText("Friends are unavailable")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(getSteamSocial).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("No Steam friends available")).toBeVisible();
  });
});
