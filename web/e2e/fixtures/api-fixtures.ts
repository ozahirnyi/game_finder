import type {
  CatalogGame,
  CollectionGame,
  Conversation,
  ConversationMessage,
  Deal,
  Friend,
  FriendProfile,
  FriendRequest,
  GameInvite,
  Notification,
  OnboardingSummary,
  PriceAlert,
  Profile,
  PublicProfile,
  SharedLibrary,
} from "../../src/lib/api";

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
  wishlist: CollectionGame[];
  alerts: PriceAlert[];
  friends: Friend[];
  incomingFriendRequests: FriendRequest[];
  users: Friend["user"][];
  publicProfiles: Record<string, PublicProfile>;
  friendProfiles: Record<string, FriendProfile>;
  sharedLibraries: Record<string, SharedLibrary>;
  conversations: Conversation[];
  messages: Record<string, ConversationMessage[]>;
  gameInvites: GameInvite[];
  notifications: Notification[];
  delays: Record<string, number>;
  statusByPath: Record<string, number>;
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
    onboarding: {
      steam_linked: false,
      psn_library_games: 0,
      wishlist_games: 0,
      price_alerts: 0,
      friends: 0,
    },
    profile: {
      id: "user-1",
      email: "player@example.com",
      display_name: "Player",
      bio: null,
      platforms: [],
      favorite_genres: [],
    },
    library: { games: [], steam_available: false },
    wishlist: [
      {
        id: "wishlist-101",
        catalog_game_id: 101,
        source: "catalog",
        external_id: "101",
        title: "Celeste",
      },
    ],
    alerts: [],
    friends: [],
    incomingFriendRequests: [],
    users: [],
    publicProfiles: {
      "public-player": {
        public_id: "public-player",
        nickname: "Public Player",
        relationship: "none",
        library: { status: "hidden", data: [] },
        favorites: { status: "hidden", data: [] },
        wishlist: { status: "hidden", data: [] },
      },
    },
    friendProfiles: {},
    sharedLibraries: {},
    conversations: [],
    messages: {},
    gameInvites: [],
    notifications: [],
    delays: {},
    statusByPath: {},
  };
}
