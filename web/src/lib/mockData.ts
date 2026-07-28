export type Game = {
  id: string;
  title: string;
  genres: string[];
  platforms: string[];
  rating: number;
  price: number;
  originalPrice?: number;
  discount?: number;
  coverFrom: string;
  coverTo: string;
  coop?: boolean;
  status?: "Playing" | "Completed" | "Paused" | "Want to Play" | "Playing with Friends";
  playtime?: number;
  /** Which connected store the game was synced from. */
  source?: "Steam" | "PlayStation";
};

export type Friend = {
  id: string;
  name: string;
  handle: string;
  online: boolean;
  activity: string;
  compatibility: number;
  sharedGames: number;
  genres: string[];
  platforms: string[];
  avatarFrom: string;
  avatarTo: string;
  lft?: boolean;
};

export const games: Game[] = [
  {
    id: "helldivers2",
    source: "PlayStation",
    title: "Helldivers 2",
    genres: ["Shooter", "Co-op"],
    platforms: ["PC", "PS5"],
    rating: 92,
    price: 39.99,
    coverFrom: "#f97316",
    coverTo: "#1e293b",
    coop: true,
    status: "Playing with Friends",
    playtime: 84,
  },
  {
    id: "hades2",
    source: "Steam",
    title: "Hades II",
    genres: ["Roguelike", "Action"],
    platforms: ["PC"],
    rating: 95,
    price: 29.99,
    coverFrom: "#7c3aed",
    coverTo: "#0f172a",
    status: "Playing",
    playtime: 42,
  },
  {
    id: "bg3",
    source: "Steam",
    title: "Baldur's Gate 3",
    genres: ["RPG", "Co-op"],
    platforms: ["PC", "PS5", "Xbox"],
    rating: 96,
    price: 59.99,
    coverFrom: "#dc2626",
    coverTo: "#1c1917",
    coop: true,
    status: "Playing with Friends",
    playtime: 128,
  },
  {
    id: "eldenring",
    source: "PlayStation",
    title: "Elden Ring",
    genres: ["RPG", "Souls-like"],
    platforms: ["PC", "PS5", "Xbox"],
    rating: 96,
    price: 41.99,
    originalPrice: 59.99,
    discount: 30,
    coverFrom: "#ca8a04",
    coverTo: "#1c1917",
    status: "Completed",
    playtime: 156,
  },
  {
    id: "drg",
    source: "Steam",
    title: "Deep Rock Galactic",
    genres: ["Co-op", "Shooter"],
    platforms: ["PC", "Xbox"],
    rating: 93,
    price: 14.99,
    originalPrice: 29.99,
    discount: 50,
    coverFrom: "#f59e0b",
    coverTo: "#111827",
    coop: true,
    status: "Playing with Friends",
    playtime: 67,
  },
  {
    id: "cyberpunk",
    title: "Cyberpunk 2077",
    genres: ["RPG", "Sci-fi"],
    platforms: ["PC", "PS5"],
    rating: 86,
    price: 29.99,
    originalPrice: 59.99,
    discount: 50,
    coverFrom: "#eab308",
    coverTo: "#450a0a",
  },
  {
    id: "sekiro",
    title: "Sekiro: Shadows Die Twice",
    genres: ["Action", "Souls-like"],
    platforms: ["PC", "PS5"],
    rating: 91,
    price: 29.99,
    originalPrice: 59.99,
    discount: 50,
    coverFrom: "#b91c1c",
    coverTo: "#111827",
  },
  {
    id: "stardew",
    source: "Steam",
    title: "Stardew Valley",
    genres: ["Sim", "Co-op"],
    platforms: ["PC", "Switch"],
    rating: 94,
    price: 14.99,
    coverFrom: "#65a30d",
    coverTo: "#1e3a2b",
    coop: true,
    status: "Paused",
    playtime: 34,
  },
  {
    id: "sots2",
    title: "Slay the Spire 2",
    genres: ["Roguelike", "Deckbuilder"],
    platforms: ["PC"],
    rating: 0,
    price: 24.99,
    coverFrom: "#8b5cf6",
    coverTo: "#0c0a1a",
    status: "Want to Play",
  },
  {
    id: "hollow",
    title: "Hollow Knight: Silksong",
    genres: ["Metroidvania"],
    platforms: ["PC", "Switch"],
    rating: 0,
    price: 29.99,
    coverFrom: "#0ea5e9",
    coverTo: "#0c1425",
    status: "Want to Play",
  },
  {
    id: "factorio",
    source: "Steam",
    title: "Factorio",
    genres: ["Sim", "Co-op"],
    platforms: ["PC"],
    rating: 96,
    price: 35.0,
    coverFrom: "#ea580c",
    coverTo: "#1a0f0a",
    coop: true,
    status: "Paused",
    playtime: 210,
  },
  {
    id: "monsterhunter",
    title: "Monster Hunter Wilds",
    genres: ["Action", "Co-op"],
    platforms: ["PC", "PS5"],
    rating: 88,
    price: 49.99,
    originalPrice: 69.99,
    discount: 28,
    coverFrom: "#ef4444",
    coverTo: "#1c1917",
    coop: true,
  },
];

export const friends: Friend[] = [
  {
    id: "sasha",
    name: "Sasha K.",
    handle: "sasha_k",
    online: true,
    activity: "In Hades II",
    compatibility: 92,
    sharedGames: 38,
    genres: ["Roguelike", "RPG"],
    platforms: ["PC"],
    avatarFrom: "#22d3ee",
    avatarTo: "#4f46e5",
  },
  {
    id: "marcus",
    name: "Marcus V.",
    handle: "marcusv",
    online: true,
    activity: "Online — looking for group",
    compatibility: 88,
    sharedGames: 44,
    genres: ["Shooter", "Co-op"],
    platforms: ["PC", "PS5"],
    avatarFrom: "#22c55e",
    avatarTo: "#0f766e",
    lft: true,
  },
  {
    id: "maria",
    name: "Maria L.",
    handle: "maria.l",
    online: true,
    activity: "LFG: Helldivers 2 (2/4)",
    compatibility: 84,
    sharedGames: 27,
    genres: ["Shooter", "Sim"],
    platforms: ["PC"],
    avatarFrom: "#f472b6",
    avatarTo: "#7c3aed",
    lft: true,
  },
  {
    id: "alex",
    name: "Alex G.",
    handle: "alex_g",
    online: true,
    activity: "In Deep Rock Galactic",
    compatibility: 79,
    sharedGames: 31,
    genres: ["Co-op", "Sim"],
    platforms: ["PC", "Xbox"],
    avatarFrom: "#fbbf24",
    avatarTo: "#b45309",
  },
  {
    id: "leo",
    name: "Leo B.",
    handle: "leo_b",
    online: false,
    activity: "Last seen 2h ago",
    compatibility: 71,
    sharedGames: 19,
    genres: ["RPG", "Metroidvania"],
    platforms: ["PC", "Switch"],
    avatarFrom: "#a78bfa",
    avatarTo: "#1e1b4b",
  },
  {
    id: "maya",
    name: "Maya R.",
    handle: "maya.r",
    online: false,
    activity: "Last seen yesterday",
    compatibility: 66,
    sharedGames: 14,
    genres: ["Action", "Souls-like"],
    platforms: ["PS5"],
    avatarFrom: "#fb923c",
    avatarTo: "#7c2d12",
  },
];

export const activity = [
  { id: 1, who: "sasha", verb: "added", target: "Hades II", tag: "to wishlist", time: "2m ago" },
  {
    id: 2,
    who: "marcus",
    verb: "is looking for",
    target: "Helldivers 2",
    tag: "teammates (2 slots)",
    time: "14m ago",
  },
  { id: 3, who: "maria", verb: "completed", target: "Elden Ring", tag: "in 156h", time: "1h ago" },
  {
    id: 4,
    who: "alex",
    verb: "started",
    target: "Deep Rock Galactic",
    tag: "with Marcus",
    time: "3h ago",
  },
  {
    id: 5,
    who: "leo",
    verb: "added",
    target: "Cyberpunk 2077",
    tag: "to library",
    time: "Yesterday",
  },
];

export const aiRecommendations = [
  { gameId: "hades2", reason: "Based on your 200h in Hades and Sasha's recent activity." },
  {
    gameId: "monsterhunter",
    reason: "Marcus, Alex and Maria all own this — perfect for a 4-stack.",
  },
  { gameId: "factorio", reason: "You loved Deep Rock. Try slower, deeper co-op." },
];

export const priceHistory = [
  { date: "Jan", price: 59.99 },
  { date: "Feb", price: 59.99 },
  { date: "Mar", price: 44.99 },
  { date: "Apr", price: 59.99 },
  { date: "May", price: 39.99 },
  { date: "Jun", price: 59.99 },
  { date: "Jul", price: 29.99 },
];

/** Signed-out guest state — matches the live product: accounts are optional. */
export const account = {
  signedIn: true,
  name: "Alex Reyes",
  handle: "alexreyes",
  avatarFrom: "#f97316",
  avatarTo: "#1c1917",
  region: "US",
};

export const regions = ["US", "EU", "UK", "TR", "AR", "KZ"] as const;

export type Deal = {
  id: string;
  title: string;
  store: "Steam";
  price: number;
  originalPrice: number;
  discount: number;
  currency: "USD";
  coverFrom: string;
  coverTo: string;
  storeUrl: string;
};

/** Live price drops — the core of the signed-out home screen. */
export const deals: Deal[] = [
  {
    id: "orc-problem",
    title: "Sir, We Have an Orc Problem",
    store: "Steam",
    price: 8.99,
    originalPrice: 9.99,
    discount: 10,
    currency: "USD",
    coverFrom: "#65a30d",
    coverTo: "#1c1917",
    storeUrl: "https://store.steampowered.com/app/4594150/",
  },
  {
    id: "lemans-us",
    title: "Le Mans Ultimate — US Track Pass",
    store: "Steam",
    price: 40.49,
    originalPrice: 44.99,
    discount: 10,
    currency: "USD",
    coverFrom: "#2563eb",
    coverTo: "#0f172a",
    storeUrl: "https://store.steampowered.com/app/4906890/",
  },
  {
    id: "cyberpunk",
    title: "Cyberpunk 2077",
    store: "Steam",
    price: 17.99,
    originalPrice: 59.99,
    discount: 70,
    currency: "USD",
    coverFrom: "#eab308",
    coverTo: "#450a0a",
    storeUrl: "https://store.steampowered.com/app/1091500/",
  },
  {
    id: "phantom-liberty",
    title: "Cyberpunk 2077: Phantom Liberty",
    store: "Steam",
    price: 17.99,
    originalPrice: 29.99,
    discount: 40,
    currency: "USD",
    coverFrom: "#dc2626",
    coverTo: "#1c1917",
    storeUrl: "https://store.steampowered.com/app/2138330/",
  },
  {
    id: "mgs-delta",
    title: "Metal Gear Solid Δ: Snake Eater",
    store: "Steam",
    price: 47.99,
    originalPrice: 69.99,
    discount: 31,
    currency: "USD",
    coverFrom: "#3f6212",
    coverTo: "#0c0a09",
    storeUrl: "https://store.steampowered.com/",
  },
  {
    id: "shift-midnight",
    title: "Shift at Midnight",
    store: "Steam",
    price: 6.79,
    originalPrice: 7.99,
    discount: 15,
    currency: "USD",
    coverFrom: "#b91c1c",
    coverTo: "#111827",
    storeUrl: "https://store.steampowered.com/",
  },
  {
    id: "eldenring-deal",
    title: "Elden Ring",
    store: "Steam",
    price: 29.99,
    originalPrice: 59.99,
    discount: 50,
    currency: "USD",
    coverFrom: "#ca8a04",
    coverTo: "#1c1917",
    storeUrl: "https://store.steampowered.com/",
  },
  {
    id: "drg-deal",
    title: "Deep Rock Galactic",
    store: "Steam",
    price: 11.99,
    originalPrice: 29.99,
    discount: 60,
    currency: "USD",
    coverFrom: "#f59e0b",
    coverTo: "#111827",
    storeUrl: "https://store.steampowered.com/",
  },
];

/** Deterministic mock profile payload for a friend. */
export function friendGames(friendId: string) {
  const owned = games.filter((g) => g.source);
  const seed = friendId.length;
  return owned.filter((_, i) => (i + seed) % 4 !== 0);
}

export const friendBios: Record<string, string> = {
  sasha: "Roguelike completionist. Always down for a late-night Hades run.",
  marcus: "Squad shooter main. Organises the weekly 4-stack.",
  maria: "Sim and shooter mix — usually hosting LFG lobbies.",
  alex: "Co-op only. Deep Rock veteran, Rock and Stone.",
  leo: "Slow-burn RPGs and metroidvanias, mostly on Switch.",
  maya: "Souls-like grinder on PS5. Trophy hunter.",
};
