import { describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getLibraryOverview: vi.fn(),
  getCatalogGame: vi.fn(),
  searchGames: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  ...api,
  addWishlist: vi.fn(),
  getCatalogGame: api.getCatalogGame,
  getPriceHistory: vi.fn(),
  searchGames: api.searchGames,
}));

import { Route } from "./games.$gameId";

describe("Steam library game loader", () => {
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

  it("keeps a title-bearing recommendation on a detail page when RAWG is unavailable", async () => {
    api.getCatalogGame.mockRejectedValue(new Error("RAWG timeout"));
    api.searchGames.mockRejectedValue(new Error("RAWG timeout"));

    const loader = Route.options.loader;
    if (typeof loader !== "function") throw new Error("Expected a route loader");

    const result = await loader({
      params: { gameId: "0" },
      deps: { title: "Hades" },
    } as never);

    expect(result.game).toMatchObject({ title: "Hades", isSteamLibrary: false, description: "Catalog details are temporarily unavailable." });
  });
});
