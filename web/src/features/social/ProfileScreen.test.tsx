import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileScreen } from "./ProfileScreen";
import {
  getPublicProfile,
  isAuthenticated,
  sendFriendRequest,
} from "@/lib/api";

vi.mock("@/lib/api", () => ({
  getPublicProfile: vi.fn(),
  isAuthenticated: vi.fn(() => true),
  sendFriendRequest: vi.fn(),
}));

describe("ProfileScreen", () => {
  it("shows a minimal profile and sends a request by profile id", async () => {
    vi.mocked(getPublicProfile).mockResolvedValue({
      profile_id: "alex-1",
      display_name: "Alex",
      relationship: "none",
      library: { state: "empty", items: [] },
      favorites: { state: "hidden", message: "This section is private." },
      wishlist: { state: "empty", items: [] },
      steam: { state: "empty", items: [] },
    });
    vi.mocked(sendFriendRequest).mockResolvedValue({});
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ProfileScreen profileId="alex-1" />
      </QueryClientProvider>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Send friend request" }),
    );
    await waitFor(() =>
      expect(sendFriendRequest).toHaveBeenCalledWith(
        { profile_id: "alex-1" },
        expect.anything(),
      ),
    );
  });
  it("does not offer a request to anonymous viewers", async () => {
    vi.mocked(isAuthenticated).mockReturnValue(false);
    vi.mocked(getPublicProfile).mockResolvedValue({
      profile_id: "alex",
      display_name: "Alex",
      relationship: "anonymous",
      library: { state: "empty", items: [] },
      favorites: { state: "hidden", message: "This section is private." },
      wishlist: { state: "empty", items: [] },
      steam: { state: "empty", items: [] },
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ProfileScreen profileId="alex" />
      </QueryClientProvider>,
    );
    await screen.findByText("This section is private.");
    expect(
      screen.queryByRole("button", { name: "Send friend request" }),
    ).toBeNull();
  });
});
