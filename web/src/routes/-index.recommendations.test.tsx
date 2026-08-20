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
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getAuthSnapshot: vi.fn(),
  subscribeToAuthChanges: vi.fn(() => () => {}),
  getDashboard: vi.fn(),
  getTrendingGames: vi.fn(),
  getDeals: vi.fn(),
  getFriends: vi.fn(),
  getLibraryOverview: vi.fn(),
  getOnboardingSummary: vi.fn(),
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
  api.getOnboardingSummary.mockResolvedValue({
    steam_linked: true,
    psn_library_games: 0,
    wishlist_games: 1,
    price_alerts: 1,
    friends: 1,
  });
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
              igdb_id: 123,
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

  it("keeps an unmatched recommendation off an invalid game route", async () => {
    api.getAuthSnapshot.mockReturnValue(true);
    api.getDashboard.mockResolvedValue({
      recommendations: {
        status: "ready",
        data: {
          recommendations: [
            { title: "Unknown title", reason: "Fits", tags: [], igdb_id: null, cover_url: null },
          ],
        },
      },
    });

    renderHome();

    const cardTitle = await screen.findByRole("heading", { name: "Unknown title" });
    expect(cardTitle.closest("a")).toBeNull();
    expect(screen.queryByRole("link", { name: "Unknown title" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search this title" })).toHaveAttribute(
      "href",
      "/search?q=Unknown+title",
    );
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

  it("shows a retryable state when the dashboard request fails", async () => {
    api.getAuthSnapshot.mockReturnValue(true);
    api.getDashboard.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({
      recommendations: { status: "empty", data: [] },
    });

    renderHome();

    const retry = await screen.findByRole("button", { name: "Retry recommendations" });
    expect(screen.getByText("Recommendations are unavailable.")).toBeInTheDocument();
    const callsBeforeRetry = api.getDashboard.mock.calls.length;
    fireEvent.click(retry);
    await waitFor(() => expect(api.getDashboard.mock.calls.length).toBe(callsBeforeRetry + 1));
  });

  it("renders real trending catalog games for a guest", async () => {
    api.getAuthSnapshot.mockReturnValue(false);
    api.getTrendingGames.mockResolvedValue({ results: [{ id: 44, name: "Hades" }] });

    renderHome();

    expect(await screen.findByText("Hades")).toHaveAttribute("data-game-id", "44");
  });

  it("shows loading while guest trending games are pending", async () => {
    api.getAuthSnapshot.mockReturnValue(false);
    api.getTrendingGames.mockImplementation(() => new Promise(() => {}));

    renderHome();

    expect(await screen.findByText("Popular games · loading")).toBeInTheDocument();
  });

  it("shows an empty state when the guest trending catalog is empty", async () => {
    api.getAuthSnapshot.mockReturnValue(false);
    api.getTrendingGames.mockResolvedValue({ results: [] });

    renderHome();

    expect(
      await screen.findByText("No popular games are available right now."),
    ).toBeInTheDocument();
  });

  it("retries guest trending games after a failure", async () => {
    api.getAuthSnapshot.mockReturnValue(false);
    api.getTrendingGames
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ results: [] });

    renderHome();

    const retry = await screen.findByRole("button", { name: "Retry popular games" });
    const callsBeforeRetry = api.getTrendingGames.mock.calls.length;
    fireEvent.click(retry);
    await waitFor(() => expect(api.getTrendingGames.mock.calls.length).toBe(callsBeforeRetry + 1));
  });

  it("requests a twelfth standard deal for the full Price drops grid", async () => {
    api.getAuthSnapshot.mockReturnValue(false);
    api.getDeals.mockResolvedValue({
      results: Array.from({ length: 13 }, (_, index) => ({
        id: index + 1,
        name: index === 12 ? "Twelfth deal" : `Deal ${index + 1}`,
      })),
    });

    renderHome();

    expect(await screen.findByText("Twelfth deal")).toBeInTheDocument();
    await waitFor(() => expect(api.getDeals).toHaveBeenCalledWith("US", 13));
  });

  it("shows a loading state while selected-region deals are pending", async () => {
    api.getAuthSnapshot.mockReturnValue(false);
    api.getDeals.mockImplementation(() => new Promise(() => {}));

    renderHome();

    expect(await screen.findByText("Live deals · loading")).toBeInTheDocument();
  });

  it("shows an empty state when the selected region has no deals", async () => {
    api.getAuthSnapshot.mockReturnValue(false);
    api.getDeals.mockResolvedValue({ results: [] });

    renderHome();

    expect(await screen.findByText("No price drops are available for US.")).toBeInTheDocument();
  });

  it("retries selected-region deals after a failure", async () => {
    api.getAuthSnapshot.mockReturnValue(false);
    api.getDeals.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ results: [] });

    renderHome();

    fireEvent.click(await screen.findByRole("button", { name: "Retry price drops" }));
    await waitFor(() => expect(api.getDeals).toHaveBeenLastCalledWith("US", 13));
  });
});
