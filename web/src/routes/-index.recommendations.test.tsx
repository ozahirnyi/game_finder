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
  getAuthSnapshot: vi.fn(),
  subscribeToAuthChanges: vi.fn(() => () => {}),
  getDashboard: vi.fn(),
  getTrendingGames: vi.fn(),
  getDeals: vi.fn(),
  getFriends: vi.fn(),
  getLibraryOverview: vi.fn(),
  getProfile: vi.fn(),
  searchGames: vi.fn(),
}));

vi.mock("@/lib/api", () => api);
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/GameCover", () => ({ GameCover: () => <div /> }));
vi.mock("@/components/GameCard", () => ({
  GameCard: ({ game }: { game: { title: string; gameId?: string } }) => (
    <div data-game-id={game.gameId}>{game.title}</div>
  ),
}));

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
}

beforeEach(() => {
  api.getDeals.mockResolvedValue({ results: [] });
  api.getFriends.mockResolvedValue([]);
  api.getLibraryOverview.mockResolvedValue({ games: [] });
  api.getProfile.mockResolvedValue({ display_name: "Player" });
  api.searchGames.mockResolvedValue({ results: [] });
});

afterEach(cleanup);

describe("Home recommendations", () => {
  it("shows a search-in-progress state instead of an empty result", async () => {
    api.getAuthSnapshot.mockReturnValue(false);
    api.searchGames.mockImplementation(() => new Promise(() => {}));

    renderHome();

    fireEvent.change(await screen.findByPlaceholderText("Search games by title"), {
      target: { value: "Hades" },
    });

    expect(screen.getByText("Searching games…")).toBeInTheDocument();
    expect(screen.queryByText(/No matches for/i)).not.toBeInTheDocument();
  });

  it("links the enriched Eligible recommendation to its game details", async () => {
    api.getAuthSnapshot.mockReturnValue(true);
    api.getDashboard.mockResolvedValue({
      recommendations: {
        status: "ready",
        data: {
          recommendations: [
            {
              title: "Eligible",
              reason: "Fast action",
              tags: ["Action"],
              rawg_id: 123,
              cover_url: null,
            },
          ],
        },
      },
    });

    renderHome();

    expect((await screen.findByRole("link", { name: /Eligible/i })).getAttribute("href")).toBe(
      "/games/123?title=Eligible",
    );
  });

  it("opens an unenriched recommendation through its exact title", async () => {
    api.getAuthSnapshot.mockReturnValue(true);
    api.getDashboard.mockResolvedValue({
      recommendations: { status: "ready", data: { recommendations: [{ title: "Unknown title", reason: "Fits", tags: [], rawg_id: null, cover_url: null }] } },
    });

    renderHome();

    expect((await screen.findByRole("link", { name: /Unknown title/i })).getAttribute("href")).toBe("/games/0?title=Unknown+title");
  });

  it("shows an honest signed-in empty state", async () => {
    api.getAuthSnapshot.mockReturnValue(true);
    api.getDashboard.mockResolvedValue({
      recommendations: {
        status: "empty",
        data: [],
        message: "Add games or connect Steam to get recommendations.",
      },
    });

    renderHome();

    expect(await screen.findByText(/Add games or connect Steam/i)).toBeInTheDocument();
  });

  it("shows the signed-in recommendation error without fallback cards", async () => {
    api.getAuthSnapshot.mockReturnValue(true);
    api.getDashboard.mockResolvedValue({
      recommendations: {
        status: "error",
        data: [],
        message: "Recommendations are temporarily unavailable.",
      },
    });

    renderHome();

    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText("Hades")).not.toBeInTheDocument();
  });

  it("renders real trending catalog games for a guest", async () => {
    api.getAuthSnapshot.mockReturnValue(false);
    api.getTrendingGames.mockResolvedValue({ results: [{ id: 44, name: "Hades" }] });

    renderHome();

    expect(await screen.findByText("Hades")).toHaveAttribute("data-game-id", "44");
  });
});
