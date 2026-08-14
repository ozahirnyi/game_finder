import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const api = vi.hoisted(() => ({
  getConversations: vi.fn(),
  getConversationMessages: vi.fn(),
  getGameInvites: vi.fn(),
}));

vi.mock("@/lib/api", async () => ({
  ...(await vi.importActual<typeof import("@/lib/api")>("@/lib/api")),
  ...api,
}));

import { FriendConversationHistory } from "./FriendConversationHistory";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderHistory(friendId = "friend-1") {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FriendConversationHistory friendId={friendId} />
    </QueryClientProvider>,
  );
}

describe("FriendConversationHistory", () => {
  it("shows only the selected friend's messages and invitation statuses", async () => {
    api.getConversations.mockResolvedValue([
      { id: "conversation-1", participant: { id: "friend-1", display_name: "Sam" } },
    ]);
    api.getConversationMessages.mockResolvedValue([
      { id: "message-1", sender_id: "friend-1", body: "Ready tonight?", created_at: "2026-08-14T12:00:00Z" },
    ]);
    api.getGameInvites.mockResolvedValue([
      {
        id: "invite-1",
        sender: { id: "friend-1", display_name: "Sam" },
        recipient: { id: "me", display_name: "Me" },
        game_name: "Portal 2",
        status: "accepted",
        created_at: "2026-08-14T11:00:00Z",
      },
      {
        id: "invite-2",
        sender: { id: "friend-2", display_name: "Alex" },
        recipient: { id: "me", display_name: "Me" },
        game_name: "Unrelated game",
        status: "pending",
        created_at: "2026-08-14T10:00:00Z",
      },
    ]);

    renderHistory();

    expect(await screen.findByText("Ready tonight?")).toBeInTheDocument();
    expect(screen.getByText("Game invitation: Portal 2 · Accepted")).toBeInTheDocument();
    expect(screen.queryByText("Unrelated game")).not.toBeInTheDocument();
  });

  it("shows an empty state when the selected friend has no conversation or invites", async () => {
    api.getConversations.mockResolvedValue([]);
    api.getGameInvites.mockResolvedValue([]);

    renderHistory();

    expect(await screen.findByText("No messages yet")).toBeInTheDocument();
  });
});
