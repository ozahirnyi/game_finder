import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  updateProfile: vi.fn().mockResolvedValue({}),
  createConversation: vi.fn().mockResolvedValue({ id: "conversation-1" }),
  createMessage: vi.fn().mockResolvedValue({}),
  createGameInvite: vi.fn().mockResolvedValue({}),
  getConversations: vi.fn().mockResolvedValue([]),
  getConversationMessages: vi.fn().mockResolvedValue([]),
  getGameInvites: vi.fn().mockResolvedValue([]),
}));

vi.mock("./ConnectedServices", () => ({ ConnectedServices: () => <div /> }));
vi.mock("./NotificationsPanel", () => ({ NotificationsPanel: () => <div /> }));
vi.mock("@/lib/api", async () => ({
  ...(await vi.importActual<typeof import("@/lib/api")>("@/lib/api")),
  updateProfile: api.updateProfile,
  createConversation: api.createConversation,
  createMessage: api.createMessage,
  createGameInvite: api.createGameInvite,
  getConversations: api.getConversations,
  getConversationMessages: api.getConversationMessages,
  getGameInvites: api.getGameInvites,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import { ProfileView, type ProfileData } from "./ProfileView";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  api.updateProfile.mockResolvedValue({});
  api.createConversation.mockResolvedValue({ id: "conversation-1" });
  api.createMessage.mockResolvedValue({});
  api.createGameInvite.mockResolvedValue({});
  api.getConversations.mockResolvedValue([]);
  api.getConversationMessages.mockResolvedValue([]);
  api.getGameInvites.mockResolvedValue([]);
});

const profile: ProfileData = {
  name: "Player",
  handle: "player",
  avatarFrom: "#111",
  avatarTo: "#222",
  region: "US",
  hours: "10h",
  stores: [],
  games: [{ id: "1", title: "Portal", coverFrom: "#111", coverTo: "#222" }],
};
const renderProfile = (isSelf: boolean) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProfileView profile={profile} isSelf={isSelf} />
    </QueryClientProvider>,
  );

describe("ProfileView library visibility", () => {
  it("hides the library from the profile owner", () => {
    renderProfile(true);
    expect(screen.queryByText("Your library")).not.toBeInTheDocument();
  });
  it("keeps the library on a friend profile", () => {
    renderProfile(false);
    expect(screen.getByText("Their library")).toBeInTheDocument();
  });
  it("opens editable profile settings for the profile owner", () => {
    renderProfile(true);
    fireEvent.click(screen.getByRole("button", { name: /^settings$/i }));
    expect(screen.getByRole("dialog", { name: /profile settings/i })).toBeInTheDocument();
  });
  it("saves selected favorite genres and platforms", async () => {
    renderProfile(true);
    fireEvent.click(screen.getByRole("button", { name: /^settings$/i }));
    fireEvent.click(screen.getByRole("button", { name: "RPG" }));
    fireEvent.click(screen.getByRole("button", { name: "PC" }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(api.updateProfile.mock.calls[0][0]).toEqual(
        expect.objectContaining({ favorite_genres: ["RPG"], platforms: ["PC"] }),
      ),
    );
  });
  it("formats friend game playtime from minutes", () => {
    profile.games[0].playtime = 125;
    renderProfile(false);
    expect(screen.getByText("2h 5m")).toBeInTheDocument();
  });
  it("shows the message form above its backdrop", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ProfileView profile={{ ...profile, friendId: "friend-1" }} isSelf={false} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Message Player" }));
    expect(screen.getByRole("dialog", { name: "Message Player" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Message Player" })).toBeVisible();
  });
  it("auto-sizes the message composer without allowing manual resize", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ProfileView profile={{ ...profile, friendId: "friend-1" }} isSelf={false} />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Message Player" }));
    const textarea = screen.getByLabelText("Message text");
    Object.defineProperty(textarea, "scrollHeight", { configurable: true, value: 480 });
    fireEvent.change(textarea, { target: { value: "A longer message" } });

    expect(textarea).toHaveClass("resize-none", "overflow-y-auto");
    expect(textarea).toHaveStyle({ height: "240px" });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Message Player" }));
    expect(screen.getByLabelText("Message text")).not.toHaveStyle({ height: "240px" });
  });
  it("shows the existing conversation and invitations on a friend profile", async () => {
    api.getConversations.mockResolvedValue([
      { id: "conversation-1", participant: { id: "friend-1", display_name: "Player" } },
    ]);
    api.getConversationMessages.mockResolvedValue([
      {
        id: "message-1",
        sender_id: "friend-1",
        body: "Earlier message",
        created_at: "2026-08-14T12:00:00Z",
      },
    ]);
    api.getGameInvites.mockResolvedValue([
      {
        id: "invite-1",
        sender: { id: "friend-1", display_name: "Player" },
        recipient: { id: "me", display_name: "Me" },
        game_name: "Portal 2",
        status: "pending",
        created_at: "2026-08-14T11:00:00Z",
      },
    ]);
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <ProfileView profile={{ ...profile, friendId: "friend-1" }} isSelf={false} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Earlier message")).toBeInTheDocument();
    expect(screen.getByText("Game invitation: Portal 2 · Pending")).toBeInTheDocument();
  });

  it("refreshes the profile conversation after sending a message", async () => {
    api.getConversations.mockResolvedValue([
      { id: "conversation-1", participant: { id: "friend-1", display_name: "Player" } },
    ]);
    api.getConversationMessages.mockResolvedValue([]);
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <ProfileView profile={{ ...profile, friendId: "friend-1" }} isSelf={false} />
      </QueryClientProvider>,
    );

    await screen.findByText("No messages yet");
    fireEvent.click(screen.getByRole("button", { name: "Message Player" }));
    fireEvent.change(screen.getByLabelText("Message text"), { target: { value: "New message" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(api.createMessage).toHaveBeenCalledWith("conversation-1", "New message"),
    );
    await waitFor(() => expect(api.getConversationMessages).toHaveBeenCalledTimes(2));
  });
  it("shows the explicit shared library state for a private library", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ProfileView
          profile={{
            ...profile,
            friendId: "friend-1",
            sharedLibrary: { status: "private", data: [], message: "This library is private." },
          }}
          isSelf={false}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Shared games")).toBeInTheDocument();
    expect(screen.getByText("This library is private.")).toBeInTheDocument();
  });
  it("explains when Steam must be connected before shared games can be compared", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ProfileView
          profile={{
            ...profile,
            friendId: "friend-1",
            sharedLibrary: {
              status: "disconnected",
              data: [],
              message: "Both players must connect Steam to compare Steam libraries.",
            },
          }}
          isSelf={false}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Steam connection required")).toBeInTheDocument();
  });
  it("creates an invite from the selected shared game's canonical identity", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ProfileView
          profile={{
            ...profile,
            friendId: "friend-1",
            sharedLibrary: {
              status: "ready",
              data: [{ source: "steam", external_id: "620", title: "Portal 2" }],
            },
          }}
          isSelf={false}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Invite to play" }));
    fireEvent.change(screen.getByLabelText("Game"), { target: { value: "steam:620" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    await waitFor(() =>
      expect(api.createGameInvite).toHaveBeenCalledWith({
        recipient_id: "friend-1",
        game_name: "Portal 2",
        source: "steam",
        external_id: "620",
      }),
    );
  });
  it("opens an invite for the shared game card", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ProfileView
          profile={{
            ...profile,
            friendId: "friend-1",
            sharedLibrary: {
              status: "ready",
              data: [{ source: "steam", external_id: "620", title: "Portal 2" }],
            },
          }}
          isSelf={false}
        />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Invite Portal 2" }));
    expect(screen.getByRole("dialog", { name: "Invite Player" })).toBeVisible();
  });
});
