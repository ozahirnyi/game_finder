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
  addSteamWishlist: vi.fn(),
  createGameInvite: vi.fn(),
  createPriceAlert: vi.fn(),
  getFriends: vi.fn(),
  getFavorites: vi.fn(),
  getAuthSnapshot: vi.fn(() => true),
  subscribeToAuthChanges: vi.fn(() => () => {}),
  getGameMembership: vi.fn(),
  getPriceAlerts: vi.fn(),
  getTelegramAccount: vi.fn(),
  getWishlist: vi.fn(),
  getPriceHistory: vi.fn(),
  removeFavorite: vi.fn(),
  saveCatalogGameToFavorites: vi.fn(),
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
  steamAppId: null as number | null,
};

function renderGame(override: Partial<typeof game> = {}, initialUrl = "/games/274755") {
  cleanup();
  const rootRoute = createRootRoute({ component: Outlet });
  const gameRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/games/$gameId",
    validateSearch: Route.options.validateSearch,
    loader: async () => ({ game: { ...game, ...override } }),
    component: Route.options.component,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([gameRoute]),
    history: createMemoryHistory({ initialEntries: [initialUrl] }),
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
    vi.clearAllMocks();
    api.getAuthSnapshot.mockReturnValue(true);
    api.getPriceHistory.mockResolvedValue({ deals: [] });
    api.getWishlist.mockResolvedValue([]);
    api.getFavorites.mockResolvedValue([]);
    api.getGameMembership.mockResolvedValue({ owned: false, matches: [] });
    api.addWishlist.mockResolvedValue({ id: "wishlist-1" });
    api.addSteamWishlist.mockResolvedValue({
      id: "steam-wishlist-1",
      source: "steam",
      external_id: "730",
    });
    api.getPriceAlerts.mockResolvedValue([]);
    api.getTelegramAccount.mockResolvedValue({ linked: false, configured: false });
    api.createPriceAlert.mockResolvedValue({ id: "alert-1" });
    api.getFriends.mockResolvedValue([{ user: { id: "friend-1", display_name: "Sam" } }]);
    api.createGameInvite.mockResolvedValue({ id: "invite-1" });
    api.saveCatalogGameToFavorites.mockResolvedValue({ id: "favorite-1" });
    api.removeFavorite.mockResolvedValue(undefined);
  });

  it("adds and removes a catalog game from favorites", async () => {
    renderGame();

    fireEvent.click(await screen.findByRole("button", { name: "Add to favorites" }));
    await waitFor(() => expect(api.saveCatalogGameToFavorites).toHaveBeenCalledWith(274755));
    expect(await screen.findByRole("button", { name: "Remove from favorites" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Remove from favorites" }));
    await waitFor(() => expect(api.removeFavorite).toHaveBeenCalledWith(274755));
    expect(await screen.findByRole("button", { name: "Add to favorites" })).toBeEnabled();
  });

  it("shows the library state instead of wishlist and alert for an owned game", async () => {
    api.getGameMembership.mockResolvedValueOnce({
      owned: true,
      matches: [{ id: "owned-1", source: "psn" }],
    });
    renderGame();

    const libraryLink = await screen.findByRole("link", {
      name: /In your library.*Open library/i,
    });
    expect(libraryLink).toHaveAttribute("href", "/library");
    expect(libraryLink).toHaveClass("text-center");
    expect(libraryLink).toContainElement(screen.getByText("In your library"));
    expect(libraryLink).toContainElement(screen.getByText("Open library"));
    expect(screen.getByText("Open library")).not.toHaveClass("underline");
    expect(screen.queryByRole("button", { name: "Add to wishlist" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Alert" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invite" }).parentElement).toHaveClass("grid-cols-2");
  });

  it("offers sign-in instead of an unavailable library status to a guest", async () => {
    api.getAuthSnapshot.mockReturnValue(false);
    renderGame();
    expect(await screen.findByRole("link", { name: "Sign in to save this game" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    expect(
      screen.queryByText("Library status is unavailable. Try again later."),
    ).not.toBeInTheDocument();
    expect(api.getGameMembership).not.toHaveBeenCalled();
  });

  it("keeps Steam-only wishlist and alert on the Steam identity", async () => {
    renderGame({ id: "730", isSteamLibrary: true, steamAppId: 730 });
    fireEvent.click(await screen.findByRole("button", { name: "Alert" }));
    fireEvent.click(screen.getByRole("button", { name: "Save alert" }));

    await waitFor(() => expect(api.addSteamWishlist).toHaveBeenCalledWith("730"));
    expect(api.createPriceAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        wishlist_item_id: "steam-wishlist-1",
      }),
    );
    expect(api.addWishlist).not.toHaveBeenCalled();
  });

  it("links to an existing Steam price alert instead of offering another", async () => {
    api.getWishlist.mockResolvedValueOnce([
      { id: "steam-wishlist-1", source: "steam", external_id: "814380", catalog_game_id: 0 },
    ]);
    api.getPriceAlerts.mockResolvedValueOnce([
      {
        id: "alert-1",
        wishlist_item_id: "steam-wishlist-1",
        source: "steam",
        external_id: "814380",
      },
    ]);
    renderGame({
      id: "814380",
      title: "Sekiro: Shadows Die Twice",
      isSteamLibrary: true,
      steamAppId: 814380,
    });

    expect(await screen.findByRole("link", { name: "View price alert" })).toHaveAttribute(
      "href",
      "/wishlist?alert=alert-1",
    );
    expect(screen.queryByRole("button", { name: "Alert" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save alert" })).not.toBeInTheDocument();
    expect(api.createPriceAlert).not.toHaveBeenCalled();
  });

  it("recognizes an existing Steam wishlist item when its game resolves to a catalog page", async () => {
    api.getWishlist.mockResolvedValueOnce([
      { id: "steam-wishlist-1", source: "steam", external_id: "440", catalog_game_id: 440 },
    ]);
    renderGame(
      { id: "440", title: "Team Fortress 2", steamAppId: 440, isSteamLibrary: false },
      "/games/440?source=steam",
    );

    expect(await screen.findByRole("button", { name: "In wishlist" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Add to wishlist" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Alert" }));
    fireEvent.click(screen.getByRole("button", { name: "Save alert" }));
    await waitFor(() =>
      expect(api.createPriceAlert).toHaveBeenCalledWith(
        expect.objectContaining({ wishlist_item_id: "steam-wishlist-1" }),
      ),
    );
    expect(api.addWishlist).not.toHaveBeenCalled();
    expect(api.addSteamWishlist).not.toHaveBeenCalled();
  });

  it("shows unavailable ownership status without allowing wishlist or alert", async () => {
    api.getGameMembership.mockRejectedValueOnce(new Error("offline"));
    renderGame();
    expect(
      await screen.findByText("Library status is unavailable. Try again later."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Alert" })).not.toBeInTheDocument();
  });

  it("shows a favorite mutation error", async () => {
    api.saveCatalogGameToFavorites.mockRejectedValueOnce(new Error("offline"));
    renderGame();

    fireEvent.click(await screen.findByRole("button", { name: "Add to favorites" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not update favorites");
  });

  it("adds the game to the wishlist and creates an any-discount in-app alert", async () => {
    renderGame();

    fireEvent.click(await screen.findByRole("button", { name: "Alert" }));
    fireEvent.click(screen.getByRole("button", { name: "Save alert" }));

    await waitFor(() =>
      expect(api.createPriceAlert).toHaveBeenCalledWith({
        wishlist_item_id: "wishlist-1",
        wishlist_catalog_game_id: undefined,
        target_discount: 1,
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
    fireEvent.change(screen.getByLabelText("Note (optional)"), {
      target: { value: "  Tonight?  " },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Send invite" }));

    await waitFor(() =>
      expect(api.createGameInvite).toHaveBeenCalledWith({
        recipient_id: "friend-1",
        game_name: "Hades II",
        game_id: 274755,
        source: "igdb",
        external_id: "274755",
        note: "Tonight?",
      }),
    );
  });

  it("keeps the friend picker and invite actions within the detail card", async () => {
    renderGame();
    const inviteButton = await screen.findByRole("button", { name: "Invite" });
    await waitFor(() => expect(inviteButton).not.toBeDisabled());
    fireEvent.click(inviteButton);

    const form = screen.getByRole("button", { name: "Send invite" }).closest("form");
    expect(form).toHaveClass("min-w-0", "max-w-full");
    expect(screen.getByLabelText("Friend")).toHaveClass("w-full", "max-w-full");
    expect(screen.getByRole("button", { name: "Send invite" }).parentElement).toHaveClass(
      "flex-wrap",
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

  it("omits unsupported ownership and squad claims when no supporting data is available", async () => {
    renderGame();

    expect(await screen.findByText("Hades II")).toBeInTheDocument();
    expect(screen.queryByText("Friends who own it")).not.toBeInTheDocument();
    expect(screen.queryByText("Why for your squad")).not.toBeInTheDocument();
  });

  it("groups desktop operating systems as PC throughout Game Detail", async () => {
    game.platforms = ["Windows", "macOS", "Linux", "PlayStation 5"];
    renderGame();

    expect(await screen.findByText("PC · PlayStation 5")).toBeInTheDocument();
    expect(screen.getByText("Platforms").parentElement).toHaveTextContent("PC, PlayStation 5");
    expect(screen.queryByText(/Windows/)).not.toBeInTheDocument();
    game.platforms = ["PC"];
  });
});
