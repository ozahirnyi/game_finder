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
  status?:
    | "Playing"
    | "Completed"
    | "Paused"
    | "Want to Play"
    | "Playing with Friends";
  playtime?: number;
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
  {
    id: 1,
    who: "sasha",
    verb: "added",
    target: "Hades II",
    tag: "to wishlist",
    time: "2m ago",
  },
  {
    id: 2,
    who: "marcus",
    verb: "is looking for",
    target: "Helldivers 2",
    tag: "teammates (2 slots)",
    time: "14m ago",
  },
  {
    id: 3,
    who: "maria",
    verb: "completed",
    target: "Elden Ring",
    tag: "in 156h",
    time: "1h ago",
  },
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
  {
    gameId: "hades2",
    reason: "Based on your 200h in Hades and Sasha's recent activity.",
  },
  {
    gameId: "monsterhunter",
    reason: "Marcus, Alex and Maria all own this — perfect for a 4-stack.",
  },
  {
    gameId: "factorio",
    reason: "You loved Deep Rock. Try slower, deeper co-op.",
  },
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

export const currentUser = {
  name: "Alex Vance",
  handle: "alex.vance",
  bio: "Co-op maxi. Roguelikes, tactical shooters, immersive sims.",
  avatarFrom: "#22c55e",
  avatarTo: "#0f766e",
  stats: { library: 342, friends: 47, shared: 118, playtime: 2140 },
  favoriteGenres: ["Roguelike", "Co-op", "RPG", "Sim"],
  platforms: ["PC", "PS5"],
  integrations: { steam: true, telegram: true, google: false, psn: true },
};
