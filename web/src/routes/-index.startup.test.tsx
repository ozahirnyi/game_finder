// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getAuthSnapshot: vi.fn(),
  subscribeToAuthChanges: vi.fn(() => () => {}),
  getDashboard: vi.fn(),
  getTrendingGames: vi.fn(),
  getDeals: vi.fn(),
  getFriends: vi.fn(),
  getIncomingFriendRequests: vi.fn(),
  getLibraryOverview: vi.fn(),
  getProfile: vi.fn(),
  getSteamSocial: vi.fn(),
  searchGames: vi.fn(),
}));

vi.mock("@/lib/api", () => api);
vi.mock("@/components/ThemeSelector", () => ({ ThemeSelector: () => null }));
vi.mock("@/components/GameCover", () => ({ Avatar: () => <div />, GameCover: () => <div /> }));
vi.mock("@/components/GameCard", () => ({ GameCard: () => <div /> }));

import { Route } from "./index";

function renderHome() {
  const root = createRootRoute({ component: Outlet });
  const route = createRoute({ getParentRoute: () => root, path: "/", component: Route.options.component });
  const router = createRouter({ routeTree: root.addChildren([route]), history: createMemoryHistory({ initialEntries: ["/"] }) });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
}

beforeEach(() => {
  api.getAuthSnapshot.mockReturnValue(true);
  api.getDeals.mockImplementation(() => new Promise(() => {}));
  api.getFriends.mockResolvedValue([]);
  api.getIncomingFriendRequests.mockResolvedValue([]);
  api.getLibraryOverview.mockResolvedValue({ games: [] });
  api.getProfile.mockResolvedValue({ display_name: "Player" });
  api.getSteamSocial.mockResolvedValue({ friends: [] });
  api.getDashboard.mockResolvedValue({ recommendations: { status: "empty", data: [] } });
});

describe("home startup", () => {
  it("renders the authenticated home heading before deferred sidebar deals resolve", async () => {
    renderHome();

    expect(await screen.findByRole("heading", { name: "Play with friends tonight" })).toBeInTheDocument();
    expect(screen.getByText("Live deals · loading")).toBeInTheDocument();
  });
});
