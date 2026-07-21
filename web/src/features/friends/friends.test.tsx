import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FriendsScreen } from "./FriendsScreen";
import { ApiError, getSteamSocial, isAuthenticated } from "@/lib/api";

const api = vi.hoisted(() => {
  class MockApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  }

  return { ApiError: MockApiError, getSteamSocial: vi.fn(), isAuthenticated: vi.fn() };
});

vi.mock("@/lib/api", () => api);

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
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
