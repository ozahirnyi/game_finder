import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InvitesScreen } from "./InvitesScreen";
import { listInvites, respondToInvite } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  listInvites: vi.fn(),
  respondToInvite: vi.fn(),
}));

describe("InvitesScreen", () => {
  it("accepts an incoming invite and reloads the list", async () => {
    vi.mocked(listInvites).mockResolvedValue([
      {
        id: "invite-1",
        friend_id: "friend-1",
        game_id: "30",
        game_title: "Hades",
        status: "pending",
        direction: "incoming",
      },
    ]);
    vi.mocked(respondToInvite).mockResolvedValue({});
    render(
      <QueryClientProvider client={new QueryClient()}>
        <InvitesScreen />
      </QueryClientProvider>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Accept invite" }),
    );
    await waitFor(() =>
      expect(respondToInvite).toHaveBeenCalledWith("invite-1", "accept"),
    );
    await waitFor(() => expect(listInvites).toHaveBeenCalledTimes(2));
  });
});
