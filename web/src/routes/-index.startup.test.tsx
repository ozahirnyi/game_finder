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
  const route = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: Route.options.component,
  });
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
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

afterEach(cleanup);

describe("home startup", () => {
  it("renders the authenticated home heading before deferred sidebar deals resolve", async () => {
    renderHome();

    expect(
      await screen.findByRole("heading", { name: "Play with friends tonight" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Live deals · loading").length).toBeGreaterThan(0);
  });

  it("does not present pending account data as zero games or friends", async () => {
    api.getProfile.mockImplementation(() => new Promise(() => {}));
    api.getLibraryOverview.mockImplementation(() => new Promise(() => {}));
    api.getFriends.mockImplementation(() => new Promise(() => {}));

    renderHome();

    expect(await screen.findByText("Your dashboard · library and friends are loading")).toBeInTheDocument();
    expect(screen.queryByText(/0 games in your library/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/0 friends connected/i)).not.toBeInTheDocument();
  });

  it("uses a GET form so keyboard submit preserves the search query", async () => {
    renderHome();

    const input = await screen.findByPlaceholderText("Search games by title");
    const form = input.closest("form")!;
    expect(form).toHaveAttribute("action", "/search");
    expect(form).toHaveAttribute("method", "get");
    expect(input).toHaveAttribute("name", "q");
    expect(screen.getByRole("button", { name: "Search games" })).toHaveAttribute("type", "submit");
  });
});
