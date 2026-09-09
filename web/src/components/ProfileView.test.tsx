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
  Link: ({
    children,
    to,
    params,
    search,
    ...props
  }: {
    children: ReactNode;
    to: string;
    params?: { gameId?: string };
    search?: Record<string, string>;
  }) => (
    <a
      {...props}
      href={
        to.replace("$gameId", params?.gameId ?? "") +
        (search ? `?${new URLSearchParams(search)}` : "")
      }
    >
      {children}
    </a>
  ),
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
  it("links a friend's connected Steam profile", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ProfileView
          profile={{ ...profile, steamProfileUrl: "https://steamcommunity.com/profiles/765" }}
          isSelf={false}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("link", { name: "Open Steam profile" })).toHaveAttribute(
      "href",
      "https://steamcommunity.com/profiles/765",
    );
  });

  it("shows only Add friend for an eligible stranger", () => {
    const onAddFriend = vi.fn();

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ProfileView
          profile={profile}
          isSelf={false}
          viewer={{
            canMessage: false,
            canInvite: false,
            canAddFriend: true,
            onAddFriend,
          }}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add friend" }));
    expect(onAddFriend).toHaveBeenCalledOnce();
    expect(screen.queryByRole("link", { name: "Message Player" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invite to play" })).not.toBeInTheDocument();
  });

  it("shows friend actions only when the viewer is authorized", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ProfileView
          profile={{ ...profile, friendId: "friend-1" }}
          isSelf={false}
          viewer={{ canMessage: true, canInvite: true, canAddFriend: false }}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("link", { name: "Message Player" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invite to play" })).toBeInTheDocument();
  });

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

  it("shows the persistent price region control in profile settings", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ProfileView
          profile={{
            ...profile,
            settings: {
              displayName: "Player",
              bio: "",
              libraryVisibility: "public",
              favoritesVisibility: "public",
              wishlistVisibility: "public",
              steamVisibility: "public",
              platforms: [],
              favoriteGenres: [],
              priceCountryCode: "UA",
            },
          }}
          isSelf
        />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^settings$/i }));
    expect(screen.getByLabelText("Price region")).toHaveValue("UA");
  });
  it("shows the owner's favorites separately from the library", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ProfileView
          profile={{
            ...profile,
            favorites: [{ catalog_game_id: 274755, title: "Hades II" }],
          }}
          isSelf
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Favorites")).toBeInTheDocument();
    expect(screen.getByText("Hades II")).toBeInTheDocument();
    expect(screen.getByText(/reflect your taste/i)).toBeInTheDocument();
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
  it("saves all public-profile visibility controls", async () => {
    renderProfile(true);
    fireEvent.click(screen.getByRole("button", { name: /^settings$/i }));
    fireEvent.change(screen.getByLabelText("Library visibility"), { target: { value: "friends" } });
    fireEvent.change(screen.getByLabelText("Favorites visibility"), {
      target: { value: "private" },
    });
    fireEvent.change(screen.getByLabelText("Wishlist visibility"), {
      target: { value: "friends" },
    });
    fireEvent.change(screen.getByLabelText("Steam profile visibility"), {
      target: { value: "private" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(api.updateProfile.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          library_visibility: "friends",
          favorites_visibility: "private",
          wishlist_visibility: "friends",
          steam_visibility: "private",
        }),
      ),
    );
  });
  it("uses refreshed profile visibility settings when reopening the dialog", () => {
    const queryClient = new QueryClient();
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <ProfileView
          profile={{
            ...profile,
            settings: {
              displayName: "Player",
              bio: "",
              libraryVisibility: "public",
              favoritesVisibility: "public",
              wishlistVisibility: "public",
              steamVisibility: "public",
              platforms: [],
              favoriteGenres: [],
            },
          }}
          isSelf
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^settings$/i }));
    expect(screen.getByLabelText("Favorites visibility")).toHaveValue("public");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    rerender(
      <QueryClientProvider client={queryClient}>
        <ProfileView
          profile={{
            ...profile,
            settings: {
              displayName: "Player",
              bio: "",
              libraryVisibility: "friends",
              favoritesVisibility: "private",
              wishlistVisibility: "friends",
              steamVisibility: "private",
              platforms: [],
              favoriteGenres: [],
            },
          }}
          isSelf
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^settings$/i }));
    expect(screen.getByLabelText("Favorites visibility")).toHaveValue("private");
    expect(screen.getByLabelText("Steam profile visibility")).toHaveValue("private");
  });
  it("formats friend game playtime from minutes", () => {
    profile.games[0].playtime = 125;
    renderProfile(false);
    expect(screen.getByText("2h 5m")).toBeInTheDocument();
  });
  it("opens the dedicated chat from the profile", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ProfileView profile={{ ...profile, friendId: "friend-1" }} isSelf={false} />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("link", { name: "Message Player" })).toHaveAttribute(
      "href",
      "/messages?friend=friend-1",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open chat" })).toHaveAttribute(
      "href",
      "/messages?friend=friend-1",
    );
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
