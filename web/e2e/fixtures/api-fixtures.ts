import type { CatalogGame, Deal, OnboardingSummary, Profile } from "../../src/lib/api";

export type GuestHomeFixtures = {
  trendingGames: { results: CatalogGame[] };
  searchGames: { results: CatalogGame[] };
  deals: { results: Deal[] };
};

export type ApiState = GuestHomeFixtures & {
  trendingFailureCount: number;
  onboardingFailureCount: number;
  onboarding: OnboardingSummary;
  profile: Profile;
  library: { games: []; steam_available: boolean };
};

export function createGuestHomeFixtures(): ApiState {
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
    trendingFailureCount: 0,
    onboardingFailureCount: 0,
    onboarding: { steam_linked: false, psn_library_games: 0, wishlist_games: 0, price_alerts: 0, friends: 0 },
    profile: { id: "user-1", email: "player@example.com", display_name: "Player", bio: null, platforms: [], favorite_genres: [] },
    library: { games: [], steam_available: false },
  };
}
