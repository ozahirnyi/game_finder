import { describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getLibraryOverview: vi.fn(),
  getCatalogGame: vi.fn(),
  searchGames: vi.fn(),
  getSteamGame: vi.fn(),
  getSteamGameByTitle: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  ...api,
  addWishlist: vi.fn(),
  getCatalogGame: api.getCatalogGame,
  getPriceHistory: vi.fn(),
  getSteamGame: api.getSteamGame,
  getSteamPriceHistory: vi.fn(),
  searchGames: api.searchGames,
  getSteamGameByTitle: api.getSteamGameByTitle,
}));

import { mergeGamePrice, Route } from "./games.$gameId";

describe("Steam library game loader", () => {
  it("loads Steam Store details and price for a Steam search result", async () => {
    api.getSteamGame.mockResolvedValue({
      appid: 1145360,
      name: "Hades",
      description_raw: "Escape the Underworld.",
      genres: ["Action"],
      platforms: ["PC"],
      released: "17 Sep, 2020",
      rating: 93,
      current: {
        shop: "Steam",
        price: { amount: 25, currency: "USD" },
        regular: { amount: 30, currency: "USD" },
        cut: 17,
        url: "https://store.steampowered.com/app/1145360/",
      },
    });

    const loader = Route.options.loader;
    if (typeof loader !== "function") throw new Error("Expected a route loader");

    const result = await loader({
      params: { gameId: "1145360" },
      deps: { title: "Hades", source: "steam" },
    } as never);

    expect(result.game).toMatchObject({
      id: "1145360",
      title: "Hades",
      price: 25,
      store: "Steam",
      isSteamLibrary: true,
      releaseDate: "17 Sep, 2020",
      rating: 93,
    });
  });

  it("keeps a Steam price when no IGDB price history is requested", () => {
    expect(mergeGamePrice({ price: 25, originalPrice: 30, discount: 17, currency: "USD", store: "Steam" }, undefined)).toMatchObject({
      price: 25,
      originalPrice: 30,
      discount: 17,
      currency: "USD",
      store: "Steam",
    });
  });

  it("uses the verified Steam app header image for the detail hero", async () => {
    api.getLibraryOverview.mockResolvedValue({
      games: [
        {
          source: "steam",
          external_id: "620",
          title: "Portal 2",
          cover_url: "https://steamcdn.example.test/library_600x900.jpg",
        },
      ],
    });

    const loader = Route.options.loader;
    if (typeof loader !== "function") throw new Error("Expected a route loader");

    const result = await loader({
      params: { gameId: "620" },
      deps: { source: "steam" },
    } as never);

    expect(result.game.coverUrl).toBe(
      "https://cdn.cloudflare.steamstatic.com/steam/apps/620/library_hero.jpg",
    );
  });

  it("keeps a title-bearing recommendation on a detail page when IGDB is unavailable", async () => {
    api.getCatalogGame.mockRejectedValue(new Error("IGDB timeout"));
    api.searchGames.mockRejectedValue(new Error("IGDB timeout"));
    api.getSteamGameByTitle.mockResolvedValue({ appid: 1145360, name: "Hades", background_image: "https://steam.example/hades.jpg", description_raw: "Escape the Underworld.", genres: ["Action"], platforms: ["PC"], current: { shop: "Steam", price: { amount: 25, currency: "USD" }, url: "https://store.steampowered.com/app/1145360/" } });

    const loader = Route.options.loader;
    if (typeof loader !== "function") throw new Error("Expected a route loader");

    const result = await loader({
      params: { gameId: "0" },
      deps: { title: "Hades" },
    } as never);

    expect(result.game).toMatchObject({ id: "1145360", title: "Hades", coverUrl: "https://steam.example/hades.jpg", genres: ["Action"], store: "Steam", isSteamLibrary: true });
  });
});
