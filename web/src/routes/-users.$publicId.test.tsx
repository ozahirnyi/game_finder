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
  getPublicProfile: vi.fn(),
}));

vi.mock("@/lib/api", () => api);
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { Route } from "./users.$publicId";

function renderPublicProfile() {
  const rootRoute = createRootRoute({ component: Outlet });
  const profileRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/users/$publicId",
    component: Route.options.component,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([profileRoute]),
    history: createMemoryHistory({ initialEntries: ["/users/owner"] }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("PublicProfilePage", () => {
  beforeEach(() => {
    api.getAuthSnapshot.mockReturnValue(false);
    api.getPublicProfile.mockResolvedValue({
      public_id: "owner",
      nickname: "Owner",
      relationship: "none",
      library: { status: "empty", data: [], message: "No saved games yet." },
      favorites: { status: "empty", data: [], message: "No favorite games yet." },
      wishlist: { status: "empty", data: [], message: "No wishlist games yet." },
      steam: { status: "empty", data: [], message: "Steam is not linked." },
    });
  });

  afterEach(cleanup);

  it("loads the canonical public route and keeps anonymous visitors unactionable", async () => {
    renderPublicProfile();

    expect(await screen.findByRole("heading", { name: "Owner" })).toBeInTheDocument();
    expect(api.getPublicProfile).toHaveBeenCalledWith("owner");
    expect(screen.queryByRole("button", { name: "Add friend" })).not.toBeInTheDocument();
  });

  it("shows a controlled unavailable state when the profile cannot load", async () => {
    api.getPublicProfile.mockRejectedValue(new Error("missing"));
    renderPublicProfile();

    expect(await screen.findByText("Profile unavailable")).toBeInTheDocument();
  });
});
