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
  addWishlist: vi.fn(),
  createGameInvite: vi.fn(),
  createPriceAlert: vi.fn(),
  getFriends: vi.fn(),
  getPriceAlerts: vi.fn(),
  getWishlist: vi.fn(),
  getPriceHistory: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  ...api,
  getCatalogGame: vi.fn(),
  getLibraryOverview: vi.fn(),
  searchGames: vi.fn(),
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { Route } from "./games.$gameId";

const game = {
  id: "274755",
  title: "Hades II",
  coverFrom: "#1d4ed8",
  coverTo: "#111827",
  coverUrl: undefined,
  genres: [],
  platforms: ["PC"],
  releaseDate: undefined,
  rating: 0,
  description: "A game.",
  price: null,
  originalPrice: null,
  discount: null,
  currency: undefined,
  store: undefined,
  storeUrl: undefined,
  coop: false,
  isSteamLibrary: false,
};

function renderGame() {
  cleanup();
  const rootRoute = createRootRoute({ component: Outlet });
  const gameRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/games/$gameId",
    loader: async () => ({ game }),
    component: Route.options.component,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([gameRoute]),
    history: createMemoryHistory({ initialEntries: ["/games/274755"] }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("GameDetail actions", () => {
  afterEach(cleanup);
  beforeEach(() => {
    cleanup();
    api.getPriceHistory.mockResolvedValue({ deals: [] });
    api.getWishlist.mockResolvedValue([]);
    api.addWishlist.mockResolvedValue({ id: "wishlist-1" });
    api.getPriceAlerts.mockResolvedValue([]);
    api.createPriceAlert.mockResolvedValue({ id: "alert-1" });
    api.getFriends.mockResolvedValue([{ user: { id: "friend-1", display_name: "Sam" } }]);
    api.createGameInvite.mockResolvedValue({ id: "invite-1" });
  });

  it("adds the game to the wishlist and creates an in-app alert", async () => {
    renderGame();

    fireEvent.click(await screen.findByRole("button", { name: "Alert" }));
    fireEvent.change(await screen.findByLabelText("Target price"), { target: { value: "24" } });
    fireEvent.click(screen.getByRole("button", { name: "Save alert" }));

    await waitFor(() =>
      expect(api.createPriceAlert).toHaveBeenCalledWith({
        wishlist_catalog_game_id: 274755,
        target_price: 24,
        delivery_channels: ["in_app"],
      }),
    );
    expect(api.addWishlist).toHaveBeenCalledWith({
      id: 274755,
      name: "Hades II",
      background_image: null,
    });
  });

  it("confirms when the game is added to the wishlist", async () => {
    renderGame();

    fireEvent.click(await screen.findByRole("button", { name: "Add to wishlist" }));

    await waitFor(() => expect(api.addWishlist).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: "In wishlist" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Added to wishlist");
  });

  it("sends a game invite to the selected PlayFinder friend", async () => {
    renderGame();

    const inviteButton = await screen.findByRole("button", { name: "Invite" });
    await waitFor(() => expect(inviteButton).not.toBeDisabled());
    fireEvent.click(inviteButton);
    fireEvent.click(await screen.findByRole("button", { name: "Send invite" }));

    await waitFor(() =>
      expect(api.createGameInvite).toHaveBeenCalledWith({
        recipient_id: "friend-1",
        game_name: "Hades II",
        game_id: 274755,
      }),
    );
  });

  it("copies the game link when native sharing is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderGame();

    fireEvent.click(await screen.findByRole("button", { name: "Share" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/games/274755")),
    );
    expect(screen.getByText("Link copied")).toBeInTheDocument();
  });
});
