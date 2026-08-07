import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FriendsScreen } from "./FriendsScreen";
import {
  getSocialMe,
  searchProfiles,
  sendFriendRequest,
  transitionFriendRequest,
} from "@/lib/api";

vi.mock("@/lib/api", () => ({
  getSocialMe: vi.fn(),
  searchProfiles: vi.fn(),
  sendFriendRequest: vi.fn(),
  transitionFriendRequest: vi.fn(),
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

it("accepts an incoming friend request", async () => {
  vi.mocked(getSocialMe).mockResolvedValue({
    profile_id: "me",
    display_name: "Me",
    friend_code: "code",
    friends: [],
    incoming: [
      {
        id: "request-1",
        profile_id: "alex-1",
        display_name: "Alex",
        relationship: "incoming",
      },
    ],
    outgoing: [],
  });
  vi.mocked(transitionFriendRequest).mockResolvedValue({});
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FriendsScreen />
    </QueryClientProvider>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Accept request from Alex" }),
  );
  await waitFor(() =>
    expect(transitionFriendRequest).toHaveBeenCalledWith("request-1", "accept"),
  );
});
