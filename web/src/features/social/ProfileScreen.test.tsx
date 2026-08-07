import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileScreen } from "./ProfileScreen";
import { getSocialProfile, sendFriendRequest } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  getSocialProfile: vi.fn(),
  sendFriendRequest: vi.fn(),
}));

describe("ProfileScreen", () => {
  it("shows a minimal profile and sends a request by profile id", async () => {
    vi.mocked(getSocialProfile).mockResolvedValue({
      profile_id: "alex-1",
      display_name: "Alex",
      relationship: "none",
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
});
