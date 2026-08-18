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
import { cleanup, render, screen } from "@testing-library/react";
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
    isSelf,
    initialComposer,
    viewer,
  }: {
    isSelf: boolean;
    initialComposer?: string;
    viewer?: { canMessage: boolean; canInvite: boolean; canAddFriend: boolean };
  }) => (
    <div>
      <h1>ProfileView</h1>
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
    routeTree: rootRoute.addChildren([profileRoute]),
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
  afterEach(cleanup);

  it("loads a friend through the canonical route and opens the requested composer", async () => {
    api.getPublicProfile.mockResolvedValue(publicProfile("friends"));
    renderProfile("/users/owner?compose=message");
    expect(await screen.findByRole("button", { name: "Message" })).toBeInTheDocument();
    expect(api.getFriendProfileByPublicId).toHaveBeenCalledWith("owner");
    expect(screen.getByText("message")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invite" })).toBeInTheDocument();
  });

  it("keeps anonymous strangers on ProfileView without friend actions", async () => {
    renderProfile();
    expect(await screen.findByRole("heading", { name: "ProfileView" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Message" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invite" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add friend" })).not.toBeInTheDocument();
  });

  it("keeps settings available on the owner profile", async () => {
    api.getPublicProfile.mockResolvedValue(publicProfile("self"));
    renderProfile();
    expect(await screen.findByRole("button", { name: "Settings" })).toBeInTheDocument();
  });
});
