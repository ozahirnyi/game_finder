import { describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getLibraryOverview: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  ...api,
  addWishlist: vi.fn(),
  getCatalogGame: vi.fn(),
  getPriceHistory: vi.fn(),
  searchGames: vi.fn(),
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
      "https://cdn.cloudflare.steamstatic.com/steam/apps/620/header.jpg",
    );
  });
});
