import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConversationScreen } from "./ConversationScreen";
import {
  createGameInvite,
  listMessages,
  searchGames,
  sendMessage,
} from "@/lib/api";

vi.mock("@/lib/api", () => ({
  listMessages: vi.fn(),
  sendMessage: vi.fn(),
  searchGames: vi.fn(),
  createGameInvite: vi.fn(),
}));

describe("ConversationScreen", () => {
  it("sends a trimmed conversation message and reloads history", async () => {
    vi.mocked(listMessages).mockResolvedValue([]);
    vi.mocked(sendMessage).mockResolvedValue({});
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ConversationScreen friendId="friend-1" />
      </QueryClientProvider>,
    );
    fireEvent.change(await screen.findByLabelText("Message"), {
      target: { value: "  Ready?  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith("friend-1", { text: "Ready?" }),
    );
    await waitFor(() => expect(listMessages).toHaveBeenCalledTimes(2));
  });
});

it("creates an invite from a selected catalog game", async () => {
  vi.mocked(listMessages).mockResolvedValue([]);
  vi.mocked(searchGames).mockResolvedValue({
    results: [
      { id: 30, name: "Hades", released: null, background_image: null },
    ],
  });
  vi.mocked(createGameInvite).mockResolvedValue({});
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ConversationScreen friendId="friend-1" />
    </QueryClientProvider>,
  );
  fireEvent.change(await screen.findByLabelText("Find a game to invite"), {
    target: { value: "Hades" },
  });
  fireEvent.click(
    await screen.findByRole("button", { name: "Invite to Hades" }),
  );
  await waitFor(() =>
    expect(createGameInvite).toHaveBeenCalledWith("friend-1", {
      game_id: "30",
      game_title: "Hades",
    }),
  );
});
