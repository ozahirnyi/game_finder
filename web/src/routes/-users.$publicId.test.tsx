// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  createSocialFriendRequest: vi.fn(),
  getAuthSnapshot: vi.fn(),
  getFriendProfileByPublicId: vi.fn(),
  getPublicProfile: vi.fn(),
  getSharedGames: vi.fn(),
  getProfile: vi.fn(),
}));
vi.mock("@/lib/api", () => api);
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/ProfileView", () => ({
  ProfileView: ({
    profile,
    isSelf,
    initialComposer,
    viewer,
  }: {
    profile: {
      name: string;
      hours: string | number;
      games: { title: string }[];
      libraryPagination?: { query: string; onQueryChange: (query: string) => void };
    };
    isSelf: boolean;
    initialComposer?: string;
    viewer?: { canMessage: boolean; canInvite: boolean; canAddFriend: boolean };
  }) => (
    <div>
      <h1>{profile.name}</h1>
      <p>Hours: {profile.hours}</p>
      {profile.libraryPagination && (
        <input
          aria-label="Search library"
          value={profile.libraryPagination.query}
          onChange={(event) => profile.libraryPagination?.onQueryChange(event.target.value)}
        />
      )}
      {profile.games.map((game) => (
        <p key={game.title}>{game.title}</p>
      ))}
      <p>{initialComposer ?? "none"}</p>
      {isSelf && <button>Settings</button>}
      {viewer?.canMessage && <button>Message</button>}
      {viewer?.canInvite && <button>Invite</button>}
      {viewer?.canAddFriend && <button>Add friend</button>}
    </div>
  ),
}));

import { Route } from "./users.$publicId";

function renderProfile(path = "/users/owner") {
  const rootRoute = createRootRoute({ component: Outlet });
  const profileRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/users/$publicId",
    validateSearch: Route.options.validateSearch,
    component: Route.options.component,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      profileRoute,
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/messages",
        component: () => <p>Dedicated chat</p>,
      }),
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const publicProfile = (relationship: string) => ({
  public_id: "owner",
  nickname: "Owner",
  relationship,
  library: { status: "empty", data: [], message: "No saved games yet." },
  favorites: { status: "empty", data: [], message: "No favorites yet." },
  wishlist: { status: "empty", data: [], message: "No wishlist yet." },
  steam: { status: "empty", data: [], message: "Steam is not linked." },
});

describe("PublicProfilePage", () => {
  beforeEach(() => {
    api.getAuthSnapshot.mockReturnValue(false);
    api.getPublicProfile.mockResolvedValue(publicProfile("none"));
    api.getFriendProfileByPublicId.mockResolvedValue({
      user: { id: "friend-id", public_id: "owner", display_name: "Owner" },
      library: { status: "empty", data: [] },
    });
    api.getSharedGames.mockResolvedValue({ status: "empty", data: [] });
    api.getProfile.mockResolvedValue({
      display_name: "Owner",
      bio: "",
      platforms: [],
      favorite_genres: [],
    });
  });
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it("loads a friend through the canonical route and opens the requested composer", async () => {
    api.getPublicProfile.mockResolvedValue(publicProfile("friends"));
    renderProfile("/users/owner?compose=message");
    expect(await screen.findByText("Dedicated chat")).toBeInTheDocument();
    expect(api.getFriendProfileByPublicId).toHaveBeenCalledWith("owner", 1, "");
  });

  it("keeps the friend profile mounted while a library search request is pending", async () => {
    api.getPublicProfile.mockResolvedValue(publicProfile("friends"));
    api.getFriendProfileByPublicId
      .mockResolvedValueOnce({
        user: { id: "friend-id", public_id: "owner", display_name: "Owner" },
        library: {
          status: "ready",
          data: [{ id: "game-id", title: "Game from first page", source: "manual" }],
          page: 1,
          page_size: 12,
          total: 13,
          summary: { total_games: 13, total_playtime: 780, platform_counts: { manual: 13 } },
        },
      })
      .mockImplementationOnce(() => new Promise(() => {}));

    renderProfile();

    expect(await screen.findByRole("heading", { name: "Owner" })).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "Search library" }), {
      target: { value: "dota" },
    });

    expect(screen.getByRole("heading", { name: "Owner" })).toBeVisible();
    expect(screen.getByText("Game from first page")).toBeVisible();
  });

  it("formats complete-library playtime from minutes", async () => {
    api.getPublicProfile.mockResolvedValue(publicProfile("friends"));
    api.getFriendProfileByPublicId.mockResolvedValue({
      user: { id: "friend-id", public_id: "owner", display_name: "Owner" },
      library: {
        status: "ready",
        data: [],
        page: 1,
        page_size: 12,
        total: 1,
        summary: { total_games: 1, total_playtime: 715000, platform_counts: { steam: 1 } },
      },
    });

    renderProfile();

    expect(await screen.findByText("Hours: 11916h 40m")).toBeInTheDocument();
  });

  it("keeps anonymous strangers on ProfileView without friend actions", async () => {
    renderProfile();
    expect(await screen.findByRole("heading", { name: "Owner" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Message" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invite" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add friend" })).not.toBeInTheDocument();
  });

  it("renders a legacy public profile that has no Steam block", async () => {
    const legacyProfile = { ...publicProfile("none"), steam: undefined };
    api.getPublicProfile.mockResolvedValue(legacyProfile);

    renderProfile();

    expect(await screen.findByRole("heading", { name: "Owner" })).toBeInTheDocument();
  });

  it("keeps settings available on the owner profile", async () => {
    api.getPublicProfile.mockResolvedValue(publicProfile("self"));
    renderProfile();
    expect(await screen.findByRole("button", { name: "Settings" })).toBeInTheDocument();
  });
});
