import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route as FriendsRoute } from "@/routes/friends";

const api = vi.hoisted(() => ({
  createConversation: vi.fn(),
  createFriendRequest: vi.fn(),
  createGameInvite: vi.fn(),
  createMessage: vi.fn(),
  deleteFriend: vi.fn(),
  deleteFriendRequest: vi.fn(),
  getSocialInviteLink: vi.fn(),
  getSteamSocial: vi.fn(),
  isAuthenticated: vi.fn(),
  listConversations: vi.fn(),
  listFriendRequests: vi.fn(),
  listFriends: vi.fn(),
  listGameInvites: vi.fn(),
  listIncomingFriendRequests: vi.fn(),
  listMessages: vi.fn(),
  respondToGameInvite: vi.fn(),
  acceptFriendRequest: vi.fn(),
  searchUsers: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({
    children,
    to,
    ...props
  }: React.ComponentProps<"a"> & { to?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("@/lib/api", () => api);

function renderPage() {
  const Page = (FriendsRoute as { component: React.ComponentType }).component;
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <Page />
    </QueryClientProvider>,
  );
}

describe("GameFinder friends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.isAuthenticated.mockReturnValue(true);
    api.getSteamSocial.mockResolvedValue({
      steam: { linked: false },
      friends: [],
      top_friend_games: [],
      public_libraries: 0,
      private_libraries: 0,
    });
    api.listFriends.mockResolvedValue([]);
    api.listFriendRequests.mockResolvedValue([]);
    api.listIncomingFriendRequests.mockResolvedValue([]);
    api.listConversations.mockResolvedValue([]);
    api.listGameInvites.mockResolvedValue([]);
    api.listMessages.mockResolvedValue([]);
    api.getSocialInviteLink.mockResolvedValue({
      url: "https://gamefinder.example/friends?add=player",
    });
  });

  it("searches registered players and sends a confirmation-based friend request", async () => {
    api.searchUsers.mockResolvedValue([
      { id: "user-2", display_name: "Niko", bio: "Co-op player", avatar: null },
    ]);
    api.createFriendRequest.mockResolvedValue({ id: "request-1" });
    renderPage();

    fireEvent.change(
      await screen.findByPlaceholderText(/search gamefinder players/i),
      { target: { value: "Ni" } },
    );
    expect(await screen.findByText("Niko")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /add niko/i }));

    await waitFor(() =>
      expect(api.createFriendRequest).toHaveBeenCalledWith("user-2"),
    );
  });
});
