import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DealsPage } from "@/routes/deals";
import { GameDetailPage } from "@/routes/games.$gameId";
import { CatalogGameActions } from "@/components/CatalogGameActions";
import { SearchPage } from "@/routes/search";

const api = vi.hoisted(() => ({
  ApiError: class ApiError extends Error {},
  getCatalogGame: vi.fn(),
  getGenreDeals: vi.fn(),
  getGamePriceHistory: vi.fn(),
  getHomepageDeals: vi.fn(),
  getSavedGame: vi.fn(),
  isAuthenticated: vi.fn(),
  listFavorites: vi.fn(),
  listSavedGames: vi.fn(),
  listWishlist: vi.fn(),
  removeFavorite: vi.fn(),
  saveCatalogGameToFavorites: vi.fn(),
  saveCatalogGameToLibrary: vi.fn(),
  saveCatalogGameToWishlist: vi.fn(),
  searchGames: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({
    children,
    to,
    params,
    ...props
  }: React.ComponentProps<"a"> & {
    to?: string;
    params?: { gameId?: string };
  }) => (
    <a href={params?.gameId ? `/games/${params.gameId}` : to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("@/lib/api", () => api);

function renderPage(view: React.ReactElement) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {view}
    </QueryClientProvider>,
  );
}

describe("catalog routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listFavorites.mockResolvedValue([]);
    api.getHomepageDeals.mockResolvedValue({
      results: [
        {
          id: 274755,
          name: "Hades II",
          released: "2024-05-06",
          background_image: "https://cdn.example/hades.jpg",
          url: "https://store.steampowered.com/app/1145350",
          current: {
            shop: "Steam",
            price: { amount: 19.99, currency: "USD" },
            regular: { amount: 29.99, currency: "USD" },
            cut: 33,
          },
        },
      ],
    });
    api.getGenreDeals.mockResolvedValue({
      popular: [
        {
          id: 274755,
          name: "Hades II",
          released: "2024-05-06",
          background_image: "https://cdn.example/hades.jpg",
          url: "https://store.steampowered.com/app/1145350",
          current: {
            shop: "Steam",
            price: { amount: 19.99, currency: "USD" },
            regular: { amount: 29.99, currency: "USD" },
            cut: 33,
          },
        },
      ],
      sections: [
        {
          genre: "Action",
          results: [
            {
              id: 274755,
              name: "Hades II",
              released: "2024-05-06",
              background_image: "https://cdn.example/hades.jpg",
              url: "https://store.steampowered.com/app/1145350",
              current: {
                shop: "Steam",
                price: { amount: 19.99, currency: "USD" },
                regular: { amount: 29.99, currency: "USD" },
                cut: 33,
              },
            },
          ],
        },
        { genre: "Strategy", results: [] },
      ],
    });
    api.getCatalogGame.mockResolvedValue({
      id: 274755,
      name: "Hades II",
      released: "2024-05-06",
      background_image: "https://cdn.example/hades.jpg",
      description_raw: "Fight beyond the Underworld.",
      rating: 4.8,
      genres: ["Action"],
      platforms: ["PC"],
    });
    api.searchGames.mockResolvedValue({
      results: [
        {
          id: 274755,
          name: "Hades II",
          released: null,
          background_image: null,
        },
      ],
    });
    api.getGamePriceHistory.mockResolvedValue({
      itad_id: "hades-ii",
      title: "Hades II",
      url: "https://isthereanydeal.com/game/hades-ii",
      current: {
        shop: "Steam",
        price: { amount: 19.99, currency: "USD" },
        regular: { amount: 29.99, currency: "USD" },
        cut: 33,
        url: "https://store.steampowered.com/app/1145350",
        timestamp: null,
      },
      history_low_all: { amount: 12.49, currency: "USD" },
      history_low_1y: { amount: 14.99, currency: "USD" },
      history_low_3m: { amount: 17.99, currency: "USD" },
      deals: [],
    });
  });

  it("links each real deal to the store and its catalog detail", async () => {
    renderPage(<DealsPage />);

    expect((await screen.findAllByText("Hades II")).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /open deal/i })[0]).toHaveAttribute(
      "href",
      "https://store.steampowered.com/app/1145350",
    );
    expect(screen.getAllByRole("link", { name: /game details/i })[0]).toHaveAttribute(
      "href",
      "/games/274755",
    );
    expect(screen.queryByText("Data unavailable")).not.toBeInTheDocument();
  });

  it("shows popular Steam discounts and honest genre sections", async () => {
    renderPage(<DealsPage />);

    expect(await screen.findByText("Popular on Steam")).toBeVisible();
    expect(screen.getByText("Action")).toBeVisible();
    expect(screen.getByText("Strategy")).toBeVisible();
    expect(screen.getByText("No matching current deals.")).toBeVisible();
    expect(screen.getAllByText(/-33%/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /open deal/i })[0]).toHaveAttribute(
      "href",
      "https://store.steampowered.com/app/1145350",
    );
    expect(api.getGenreDeals).toHaveBeenCalledTimes(1);
    expect(api.getHomepageDeals).not.toHaveBeenCalled();
  });

  it("keeps a Steam link when a deal has no catalog match", async () => {
    api.getGenreDeals.mockResolvedValueOnce({
      popular: [],
      sections: [
        {
          genre: "Indie",
          results: [
            {
              id: null,
              name: "Unmatched Indie Deal",
              released: null,
              background_image: null,
              url: "https://store.steampowered.com/app/999",
              current: {
                shop: "Steam",
                price: { amount: 4.99, currency: "USD" },
                regular: { amount: 9.99, currency: "USD" },
                cut: 50,
              },
            },
          ],
        },
      ],
    });

    renderPage(<DealsPage />);

    expect(await screen.findByText("Unmatched Indie Deal")).toBeVisible();
    expect(screen.getByRole("link", { name: /open deal/i })).toHaveAttribute(
      "href",
      "https://store.steampowered.com/app/999",
    );
    expect(screen.queryByRole("link", { name: /game details/i })).not.toBeInTheDocument();
  });

  it("renders real catalog metadata and price-low values without placeholder copy", async () => {
    renderPage(<GameDetailPage gameId="274755" />);

    expect(
      await screen.findByText("Fight beyond the Underworld."),
    ).toBeVisible();
    expect(await screen.findByText("All-time low")).toBeVisible();
    expect(screen.getAllByText(/\$19\.99/).length).toBeGreaterThan(0);
    expect(screen.getByText(/\$12\.49/)).toBeVisible();
    expect(
      screen.getByRole("link", { name: /open at steam/i }),
    ).toHaveAttribute("href", "https://store.steampowered.com/app/1145350");
    await waitFor(() =>
      expect(screen.queryByText("Data unavailable")).not.toBeInTheDocument(),
    );
  });

  it("opens a saved library game in its matching catalog page and expands its description", async () => {
    api.getSavedGame.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      title: "Hades II",
      source: "steam",
      notes: null,
      info: null,
      external_id: "1145350",
      playtime_forever: 120,
      playtime_2weeks: null,
      img_icon_url: null,
      synced_at: null,
      created_at: "2026-01-01T00:00:00Z",
    });
    renderPage(
      <GameDetailPage gameId="11111111-1111-4111-8111-111111111111" />,
    );
    expect(
      await screen.findByText("Fight beyond the Underworld."),
    ).toBeVisible();
    expect(api.searchGames).toHaveBeenCalledWith("Hades II");
    fireEvent.click(
      screen.getByRole("button", { name: /show full description/i }),
    );
    expect(
      screen.getByRole("button", { name: /collapse description/i }),
    ).toBeVisible();
  });

  it("hides catalog actions for guests", () => {
    api.isAuthenticated.mockReturnValue(false);

    renderPage(
      <CatalogGameActions
        game={{
          id: 274755,
          name: "Hades II",
          released: null,
          background_image: null,
          description_raw: null,
          rating: null,
          genres: [],
          platforms: [],
        }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /add to library/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add to favorites/i }),
    ).not.toBeInTheDocument();
  });

  it("saves a catalog game and updates its library label", async () => {
    api.isAuthenticated.mockReturnValue(true);
    api.listSavedGames.mockResolvedValue([]);
    api.listWishlist.mockResolvedValue([]);
    api.saveCatalogGameToLibrary.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      title: "Hades II",
      notes: null,
      info: null,
      source: "catalog",
      external_id: "rawg:274755",
      playtime_forever: null,
      playtime_2weeks: null,
      img_icon_url: null,
      synced_at: null,
      created_at: "2026-01-01T00:00:00Z",
    });

    renderPage(
      <CatalogGameActions
        game={{
          id: 274755,
          name: "Hades II",
          released: null,
          background_image: null,
          description_raw: null,
          rating: null,
          genres: [],
          platforms: [],
        }}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: /add to library/i }),
    );

    await waitFor(() =>
      expect(api.saveCatalogGameToLibrary).toHaveBeenCalledWith(274755),
    );
    expect(
      await screen.findByRole("button", { name: /in library/i }),
    ).toBeVisible();
  });

  it("shows catalog actions in game details for an authenticated user", async () => {
    api.isAuthenticated.mockReturnValue(true);
    api.listSavedGames.mockResolvedValue([]);
    api.listWishlist.mockResolvedValue([]);

    renderPage(<GameDetailPage gameId="274755" />);

    expect(
      await screen.findByRole("button", { name: /add to library/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /add to wishlist/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /add hades ii to favorites/i }),
    ).toBeVisible();
  });

  it("adds a catalog game to Favorites from search with the heart", async () => {
    api.isAuthenticated.mockReturnValue(true);
    api.listSavedGames.mockResolvedValue([]);
    api.listWishlist.mockResolvedValue([]);
    api.saveCatalogGameToFavorites.mockResolvedValue({
      id: "favorite-1",
      catalog_game_id: 274755,
      title: "Hades II",
      cover_url: null,
      created_at: "2026-07-25T00:00:00Z",
      updated_at: null,
    });

    renderPage(<SearchPage />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Hades" },
    });

    fireEvent.click(
      await screen.findByRole("button", { name: /add hades ii to favorites/i }),
    );

    await waitFor(() =>
      expect(api.saveCatalogGameToFavorites).toHaveBeenCalledWith(274755),
    );
    expect(
      await screen.findByRole("button", { name: /remove hades ii from favorites/i }),
    ).toBeVisible();
  });

  it("removes a catalog game from Favorites with the filled heart", async () => {
    api.isAuthenticated.mockReturnValue(true);
    api.listSavedGames.mockResolvedValue([]);
    api.listWishlist.mockResolvedValue([]);
    api.listFavorites.mockResolvedValue([
      { catalog_game_id: 274755, title: "Hades II" },
    ]);
    api.removeFavorite.mockResolvedValue(undefined);

    renderPage(<CatalogGameActions game={{ id: 274755, name: "Hades II", released: null, background_image: null, description_raw: null, rating: null, genres: [], platforms: [] }} />);

    fireEvent.click(
      await screen.findByRole("button", { name: /remove hades ii from favorites/i }),
    );

    await waitFor(() =>
      expect(api.removeFavorite).toHaveBeenCalledWith(274755),
    );
  });

  it("shows the Favorites pending label while saving", async () => {
    api.isAuthenticated.mockReturnValue(true);
    api.listSavedGames.mockResolvedValue([]);
    api.listWishlist.mockResolvedValue([]);
    let resolveFavorite: (value: unknown) => void;
    api.saveCatalogGameToFavorites.mockReturnValue(
      new Promise((resolve) => {
        resolveFavorite = resolve;
      }),
    );

    renderPage(<CatalogGameActions game={{ id: 274755, name: "Hades II", released: null, background_image: null, description_raw: null, rating: null, genres: [], platforms: [] }} />);

    fireEvent.click(await screen.findByRole("button", { name: /add hades ii to favorites/i }));

    expect(
      await screen.findByRole("button", { name: /adding hades ii to favorites/i }),
    ).toBeDisabled();
    resolveFavorite!({});
    expect(
      await screen.findByRole("button", { name: /remove hades ii from favorites/i }),
    ).toBeVisible();
  });

  it("keeps the Favorites action retryable after a save failure", async () => {
    api.isAuthenticated.mockReturnValue(true);
    api.listSavedGames.mockResolvedValue([]);
    api.listWishlist.mockResolvedValue([]);
    api.saveCatalogGameToFavorites.mockRejectedValue(new Error("Unavailable"));

    renderPage(<CatalogGameActions game={{ id: 274755, name: "Hades II", released: null, background_image: null, description_raw: null, rating: null, genres: [], platforms: [] }} />);

    fireEvent.click(await screen.findByRole("button", { name: /add hades ii to favorites/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not save this game. Please try again.",
    );
    expect(screen.getByRole("button", { name: /add hades ii to favorites/i })).toBeEnabled();
  });

  it("adds from search without replacing the explicit details link", async () => {
    api.isAuthenticated.mockReturnValue(true);
    api.listSavedGames.mockResolvedValue([]);
    api.listWishlist.mockResolvedValue([]);
    api.saveCatalogGameToLibrary.mockResolvedValue({});

    renderPage(<SearchPage />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Hades" },
    });

    fireEvent.click(
      await screen.findByRole("button", { name: /add to library/i }),
    );

    await waitFor(() =>
      expect(api.saveCatalogGameToLibrary).toHaveBeenCalledWith(274755),
    );
    expect(
      screen.getByRole("link", { name: /view details for hades ii/i }),
    ).toHaveAttribute("href", "/games/274755");
  });
});
