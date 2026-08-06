import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FriendsScreen } from "./FriendsScreen";
import { getSocialMe, searchProfiles, sendFriendRequest } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  getSocialMe: vi.fn(),
  searchProfiles: vi.fn(),
  sendFriendRequest: vi.fn(),
}));

describe("FriendsScreen", () => {
  it("searches duplicate nicknames and sends to the selected profile", async () => {
    vi.mocked(getSocialMe).mockResolvedValue({
      profile_id: "me",
      display_name: "Me",
      friend_code: "code",
      friends: [],
      incoming: [],
      outgoing: [],
    });
    vi.mocked(searchProfiles).mockResolvedValue([
      { profile_id: "alex-1", display_name: "Alex", relationship: "none" },
    ]);
    vi.mocked(sendFriendRequest).mockResolvedValue({});
    render(
      <QueryClientProvider client={new QueryClient()}>
        <FriendsScreen />
      </QueryClientProvider>,
    );
    fireEvent.change(await screen.findByLabelText("Find by nickname"), {
      target: { value: "Alex" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Alex" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Send friend request" }),
    );
    await waitFor(() =>
      expect(sendFriendRequest).toHaveBeenCalledWith(
        { profile_id: "alex-1" },
        expect.anything(),
      ),
    );
  });
});
