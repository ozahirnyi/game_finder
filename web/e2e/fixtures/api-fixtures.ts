import type { CatalogGame, Deal } from "../../src/lib/api";

export type GuestHomeFixtures = {
  trendingGames: { results: CatalogGame[] };
  searchGames: { results: CatalogGame[] };
  deals: { results: Deal[] };
};

export function createGuestHomeFixtures(): GuestHomeFixtures {
  return {
    trendingGames: {
      results: [
        {
          id: 101,
          name: "Celeste",
          genres: ["Platformer"],
          platforms: ["PC"],
        },
      ],
    },
    searchGames: {
      results: [{ id: 101, name: "Celeste", genres: ["Platformer"], platforms: ["PC"] }],
    },
    deals: {
      results: [
        {
          id: 202,
          name: "Hades",
          current: {
            shop: "Steam",
            price: { amount: 12.49, currency: "USD" },
            regular: { amount: 24.99, currency: "USD" },
            cut: 50,
          },
        },
      ],
    },
  };
}
