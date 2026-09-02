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
  addSteamWishlist: vi.fn(),
  addWishlist: vi.fn(),
  createGameInvite: vi.fn(),
  createPriceAlert: vi.fn(),
  getFavorites: vi.fn(),
  getFriends: vi.fn(),
  getPriceHistory: vi.fn(),
  getSimilarCatalogGames: vi.fn(),
  getSteamPriceHistory: vi.fn(),
  getWishlist: vi.fn(),
  removeFavorite: vi.fn(),
  saveCatalogGameToFavorites: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  ...api,
  ApiError: class ApiError extends Error {},
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { Route } from "./games.$gameId";

const game = {
  id: "274755",
  title: "Hades",
  coverFrom: "#1d4ed8",
  coverTo: "#111827",
  coverUrl: "https://images.example.test/hades.jpg",
  fallbackCoverUrl: undefined,
  genres: ["Action"],
  platforms: ["PC"],
  releaseDate: "2025-09-25",
  rating: 89.246,
  description: "Escape the Underworld.",
  price: null,
  originalPrice: null,
  discount: null,
  currency: undefined,
  store: undefined,
  storeUrl: undefined,
  coop: false,
  isSteamLibrary: false,
};

function renderDetail() {
  const root = createRootRoute({ component: Outlet });
  const route = createRoute({
    getParentRoute: () => root,
    path: "/games/$gameId",
    loader: () => ({ game }),
    component: Route.options.component,
  });
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({ initialEntries: ["/games/274755"] }),
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
  api.getFavorites.mockResolvedValue([]);
  api.getFriends.mockResolvedValue([]);
  api.getPriceHistory.mockResolvedValue({
    current: { price: { amount: 19.99, currency: "USD" } },
    history: [],
  });
  api.getSimilarCatalogGames.mockResolvedValue({ results: [] });
  api.getWishlist.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("game detail presentation", () => {
  it("uses formatted rating and release date consistently in the hero and details", async () => {
    renderDetail();

    expect(
      await screen.findByText("PC · 25 Sep 2025 · 89.2 / 100 critic score"),
    ).toBeInTheDocument();
    expect(screen.getByText("89.2 / 100")).toBeInTheDocument();
    expect(screen.getByText("25 Sep 2025")).toBeInTheDocument();
  });

  it("falls back from a failed hero image to the neutral cover treatment", async () => {
    renderDetail();

    const image = await screen.findByAltText("Hades");
    fireEvent.error(image);

    await waitFor(() => expect(screen.queryByAltText("Hades")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Hades" })).toBeInTheDocument();
  });

  it("shows price-history loading and retries a failed request", async () => {
    api.getPriceHistory.mockImplementationOnce(() => new Promise(() => {}));
    renderDetail();
    expect(await screen.findByText("Loading price history…")).toBeInTheDocument();
    cleanup();

    api.getPriceHistory.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({
      current: { price: { amount: 19.99, currency: "USD" } },
      history: [],
    });
    renderDetail();
    const retry = await screen.findByRole("button", { name: "Retry price history" });
    const callsBeforeRetry = api.getPriceHistory.mock.calls.length;
    fireEvent.click(retry);
    await waitFor(() => expect(api.getPriceHistory).toHaveBeenCalledTimes(callsBeforeRetry + 1));
  });

  it("shows up to four similar catalog cards with internal detail links", async () => {
    api.getSimilarCatalogGames.mockResolvedValue({
      results: [
        { id: 274755, name: "Hades" },
        ...Array.from({ length: 5 }, (_, index) => ({
          id: index + 1,
          name: `Related ${index + 1}`,
          platforms: ["PC"],
        })),
      ],
    });
    renderDetail();

    expect((await screen.findByRole("link", { name: /Related 1/i })).getAttribute("href")).toBe(
      "/games/1?title=Related+1",
    );
    expect(screen.getAllByRole("link", { name: /Related/i })).toHaveLength(4);
    expect(screen.queryByRole("link", { name: /^Hades$/ })).not.toBeInTheDocument();
  });

  it("shows similar-games loading, failure retry, and empty feedback", async () => {
    api.getSimilarCatalogGames.mockImplementationOnce(() => new Promise(() => {}));
    renderDetail();
    expect(await screen.findByText("Loading similar games…")).toBeInTheDocument();
    cleanup();

    api.getSimilarCatalogGames
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ results: [] });
    renderDetail();
    const retry = await screen.findByRole("button", { name: "Retry similar games" });
    fireEvent.click(retry);
    await screen.findByText("No similar games are available yet.");
  });
});
