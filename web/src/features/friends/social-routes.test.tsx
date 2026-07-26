import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationScreen } from "./ConversationScreen";
import { PublicProfileScreen } from "./PublicProfileScreen";

const api = vi.hoisted(() => ({
  acceptFriendRequest: vi.fn(),
  cancelFriendRequest: vi.fn(),
  createFriendRequest: vi.fn(),
  declineFriendRequest: vi.fn(),
  getDirectMessages: vi.fn(),
  getSocialMe: vi.fn(),
  getSocialProfile: vi.fn(),
  isAuthenticated: vi.fn(),
  sendDirectMessage: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  useAuthState: vi.fn(),
}));

vi.mock("@/lib/api", () => api);
vi.mock("@/hooks/useAuthState", () => auth);

const player = {
  public_id: "alex-public",
  nickname: "Alex",
  avatar: "https://example.test/alex.jpg",
};

const friend = {
  ...player,
  id: "friend-id",
};

const emptySocial = {
  public_id: "me-public",
  nickname: "Me",
  avatar: null,
  friends: [],
  incoming_requests: [],
  outgoing_requests: [],
};

const message = {
  id: "message-1",
  friendship_id: "friendship-id",
  author_id: "friend-id",
  text: "Ready to play?",
  created_at: "2026-07-26T12:00:00Z",
};

describe("PublicProfileScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.isAuthenticated.mockReturnValue(true);
    auth.useAuthState.mockReturnValue(true);
    api.getSocialMe.mockResolvedValue(emptySocial);
  });

  it("preserves the public profile as returnTo when asking a signed-out visitor to log in", () => {
    auth.useAuthState.mockReturnValue(false);

    render(<PublicProfileScreen publicId="alex/public" />);

    expect(api.getSocialProfile).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?returnTo=%2Fusers%2Falex%252Fpublic",
    );
  });

  it("shows only safe public fields and sends an explicit friend request", async () => {
    api.getSocialProfile.mockResolvedValue({ ...player, relationship: "none" });
    api.createFriendRequest.mockResolvedValue({
      ...player,
      id: "request-id",
      status: "pending",
      created_at: "2026-07-26T12:00:00Z",
    });

    render(<PublicProfileScreen publicId={player.public_id} />);

    expect(
      await screen.findByRole("heading", { name: player.nickname }),
    ).toBeVisible();
    expect(screen.getByRole("img", { name: "Alex's avatar" })).toHaveAttribute(
      "src",
      player.avatar,
    );
    expect(screen.queryByText(/@example\.com/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/steam/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add friend" }));

    await waitFor(() =>
      expect(api.createFriendRequest).toHaveBeenCalledWith(player.public_id),
    );
    expect(await screen.findByText("Request sent")).toBeVisible();
  });

  it("can immediately cancel a newly-created request by its returned id", async () => {
    api.getSocialProfile.mockResolvedValue({ ...player, relationship: "none" });
    api.createFriendRequest.mockResolvedValue({
      ...player,
      id: "new-request-id",
      status: "pending",
      created_at: "2026-07-26T12:00:00Z",
    });
    api.cancelFriendRequest.mockResolvedValue({
      ...player,
      id: "new-request-id",
      status: "cancelled",
      created_at: "2026-07-26T12:00:00Z",
    });

    render(<PublicProfileScreen publicId={player.public_id} />);

    fireEvent.click(await screen.findByRole("button", { name: "Add friend" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Cancel request" }),
    );

    await waitFor(() =>
      expect(api.cancelFriendRequest).toHaveBeenCalledWith("new-request-id"),
    );
    expect(
      await screen.findByRole("button", { name: "Add friend" }),
    ).toBeVisible();
  });

  it("uses the subscribed auth snapshot when hydration changes it", async () => {
    api.isAuthenticated.mockReturnValue(false);
    auth.useAuthState.mockReturnValue(true);
    api.getSocialProfile.mockResolvedValue({ ...player, relationship: "self" });

    render(<PublicProfileScreen publicId={player.public_id} />);

    expect(
      await screen.findByRole("heading", { name: player.nickname }),
    ).toBeVisible();
    expect(api.isAuthenticated).not.toHaveBeenCalled();
  });

  it("accepts an incoming request and exposes the confirmed conversation", async () => {
    api.getSocialProfile.mockResolvedValue({
      ...player,
      relationship: "incoming_pending",
    });
    api.getSocialMe
      .mockResolvedValueOnce({
        ...emptySocial,
        incoming_requests: [
          {
            ...player,
            id: "request-id",
            status: "pending",
            created_at: "2026-07-26T12:00:00Z",
          },
        ],
      })
      .mockResolvedValueOnce({
        ...emptySocial,
        friends: [friend],
      });
    api.acceptFriendRequest.mockResolvedValue({
      ...player,
      id: "request-id",
      status: "accepted",
      created_at: "2026-07-26T12:00:00Z",
    });

    render(<PublicProfileScreen publicId={player.public_id} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Accept request" }),
    );

    await waitFor(() =>
      expect(api.acceptFriendRequest).toHaveBeenCalledWith("request-id"),
    );
    expect(
      await screen.findByRole("link", { name: "Message Alex" }),
    ).toHaveAttribute("href", "/friends/friend-id/messages");
  });
});

describe("ConversationScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.isAuthenticated.mockReturnValue(true);
    auth.useAuthState.mockReturnValue(true);
    api.getSocialMe.mockResolvedValue({ ...emptySocial, friends: [friend] });
    api.getDirectMessages.mockResolvedValue({
      messages: [],
      next_cursor: null,
    });
    api.sendDirectMessage.mockResolvedValue(message);
  });

  it("preserves the conversation as returnTo for signed-out visitors", () => {
    auth.useAuthState.mockReturnValue(false);

    render(<ConversationScreen friendId="friend/id" />);

    expect(api.getDirectMessages).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?returnTo=%2Ffriends%2Ffriend%252Fid%2Fmessages",
    );
  });

  it("preserves a shared-game draft in the signed-out login returnTo", () => {
    auth.useAuthState.mockReturnValue(false);
    const draft = "Let's play Deep Rock Galactic!";
    const returnTo = `/friends/${encodeURIComponent("friend/id")}/messages?draft=${encodeURIComponent(draft)}`;

    render(<ConversationScreen friendId="friend/id" initialDraft={draft} />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      `/login?returnTo=${encodeURIComponent(returnTo)}`,
    );
  });

  it("uses the subscribed auth snapshot before loading a conversation", async () => {
    api.isAuthenticated.mockReturnValue(false);
    auth.useAuthState.mockReturnValue(true);

    render(<ConversationScreen friendId={friend.id} />);

    await waitFor(() =>
      expect(api.getDirectMessages).toHaveBeenCalledWith(friend.id),
    );
    expect(api.isAuthenticated).not.toHaveBeenCalled();
  });

  it("prefills but does not submit a draft, then trims and refreshes after send", async () => {
    render(
      <ConversationScreen
        friendId={friend.id}
        initialDraft="  Let's play DRG!  "
      />,
    );

    expect(
      await screen.findByRole("heading", { name: friend.nickname }),
    ).toBeVisible();
    expect(screen.getByLabelText("Message")).toHaveValue("  Let's play DRG!  ");
    expect(api.sendDirectMessage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(api.sendDirectMessage).toHaveBeenCalledWith(
        friend.id,
        "Let's play DRG!",
      ),
    );
    await waitFor(() => expect(api.getDirectMessages).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });

  it("polls the latest page every 15 seconds", async () => {
    vi.useFakeTimers();
    api.getDirectMessages
      .mockResolvedValueOnce({ messages: [message], next_cursor: null })
      .mockResolvedValueOnce({
        messages: [{ ...message, id: "message-2", text: "Second message" }],
        next_cursor: null,
      });

    render(<ConversationScreen friendId={friend.id} />);
    await act(async () => Promise.resolve());
    expect(screen.getByText(message.text)).toBeVisible();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(api.getDirectMessages).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Second message")).toBeVisible();
    vi.useRealTimers();
  });

  it("loads earlier pages without duplicating messages", async () => {
    api.getDirectMessages
      .mockResolvedValueOnce({ messages: [message], next_cursor: "older-id" })
      .mockResolvedValueOnce({
        messages: [
          { ...message, id: "message-0", text: "Earlier message" },
          message,
        ],
        next_cursor: null,
      });

    render(<ConversationScreen friendId={friend.id} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Load earlier" }),
    );

    expect(await screen.findByText("Earlier message")).toBeVisible();
    expect(screen.getAllByText(message.text)).toHaveLength(1);
    expect(api.getDirectMessages).toHaveBeenLastCalledWith(
      friend.id,
      "older-id",
    );
  });
});
