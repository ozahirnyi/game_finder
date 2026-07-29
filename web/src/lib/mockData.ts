export type Game = {
  id: string;
  title: string;
  genres: string[];
  platforms: string[];
  rating: number;
  price: number;
  originalPrice?: number;
  discount?: number;
  /** Currency of price / originalPrice. */
  currency?: string;
  /** Storefront the price comes from. */
  store?: string;
  /** External storefront link — only used on the game detail page. */
  storeUrl?: string;
  /** Real cover art. When absent the gradient fallback is used. */
  coverUrl?: string;
  coverFrom: string;
  coverTo: string;
  description?: string;
  releaseDate?: string;
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

const steamCover = (appId: number) =>
  `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;

export const games: Game[] = [
  {
    id: "helldivers2",
    source: "PlayStation",
    title: "Helldivers 2",
    genres: ["Shooter", "Co-op"],
    platforms: ["PC", "PS5"],
    rating: 92,
    price: 39.99,
    currency: "USD",
    store: "Steam",
    storeUrl: "https://store.steampowered.com/app/553850/",
    coverUrl: steamCover(553850),
    coverFrom: "#f97316",
    coverTo: "#1e293b",
    coop: true,
    status: "Playing with Friends",
    playtime: 84,
    releaseDate: "8 Feb 2024",
    description:
      "A squad-based third-person shooter about spreading managed democracy across a hostile galaxy.",
  },
  {
    id: "hades2",
    source: "Steam",
    title: "Hades II",
    genres: ["Roguelike", "Action"],
    platforms: ["PC"],
    rating: 95,
    price: 29.99,
    currency: "USD",
    store: "Steam",
    storeUrl: "https://store.steampowered.com/app/1145350/",
    coverUrl: steamCover(1145350),
    coverFrom: "#7c3aed",
    coverTo: "#0f172a",
    status: "Playing",
    playtime: 42,
    releaseDate: "6 May 2024",
    description:
      "Battle beyond the Underworld as the immortal Princess of the Underworld in this action roguelike sequel.",
  },
  {
    id: "bg3",
    source: "Steam",
    title: "Baldur's Gate 3",
    genres: ["RPG", "Co-op"],
    platforms: ["PC", "PS5", "Xbox"],
    rating: 96,
    price: 59.99,
    currency: "USD",
    store: "Steam",
    storeUrl: "https://store.steampowered.com/app/1086940/",
    coverUrl: steamCover(1086940),
    coverFrom: "#dc2626",
    coverTo: "#1c1917",
    coop: true,
    status: "Playing with Friends",
    playtime: 128,
    releaseDate: "3 Aug 2023",
    description:
      "A party-based RPG set in the Forgotten Realms, with turn-based combat and deep branching choices.",
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
    currency: "USD",
    store: "Steam",
    storeUrl: "https://store.steampowered.com/app/1245620/",
    coverUrl: steamCover(1245620),
    coverFrom: "#ca8a04",
    coverTo: "#1c1917",
    status: "Completed",
    playtime: 156,
    releaseDate: "25 Feb 2022",
    description: "An open-world action RPG from FromSoftware set in the Lands Between.",
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
    currency: "USD",
    store: "Steam",
    storeUrl: "https://store.steampowered.com/app/548430/",
    coverUrl: steamCover(548430),
    coverFrom: "#f59e0b",
    coverTo: "#111827",
    coop: true,
    status: "Playing with Friends",
    playtime: 67,
    releaseDate: "13 May 2020",
    description: "Four-player co-op mining in fully destructible procedural caves. Rock and Stone.",
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
    currency: "USD",
    store: "Steam",
    storeUrl: "https://store.steampowered.com/app/1091500/",
    coverUrl: steamCover(1091500),
    coverFrom: "#eab308",
    coverTo: "#450a0a",
    releaseDate: "10 Dec 2020",
    description:
      "An open-world action-adventure set in Night City, a megalopolis obsessed with power and body modification.",
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
    currency: "USD",
    store: "Steam",
    storeUrl: "https://store.steampowered.com/app/814380/",
    coverUrl: steamCover(814380),
    coverFrom: "#b91c1c",
    coverTo: "#111827",
    releaseDate: "21 Mar 2019",
    description:
      "Carve your own clever path to vengeance in a reimagined late-1500s Sengoku Japan.",
  },
  {
    id: "stardew",
    source: "Steam",
    title: "Stardew Valley",
    genres: ["Sim", "Co-op"],
    platforms: ["PC", "Switch"],
    rating: 94,
    price: 14.99,
    currency: "USD",
    store: "Steam",
    storeUrl: "https://store.steampowered.com/app/413150/",
    coverUrl: steamCover(413150),
    coverFrom: "#65a30d",
    coverTo: "#1e3a2b",
    coop: true,
    status: "Paused",
    playtime: 34,
    releaseDate: "26 Feb 2016",
    description:
      "Build the farm of your dreams, raise animals and become part of the local community.",
  },
  {
    id: "sots2",
    title: "Slay the Spire 2",
    genres: ["Roguelike", "Deckbuilder"],
    platforms: ["PC"],
    rating: 0,
    price: 24.99,
    currency: "USD",
    store: "Steam",
    storeUrl: "https://store.steampowered.com/app/2868840/",
    coverUrl: steamCover(2868840),
    coverFrom: "#8b5cf6",
    coverTo: "#0c0a1a",
    status: "Want to Play",
    releaseDate: "TBA",
    description: "The deckbuilding roguelike returns with new characters, cards and relics.",
  },
  {
    id: "hollow",
    title: "Hollow Knight: Silksong",
    genres: ["Metroidvania"],
    platforms: ["PC", "Switch"],
    rating: 0,
    price: 29.99,
    currency: "USD",
    store: "Steam",
    storeUrl: "https://store.steampowered.com/app/1030300/",
    coverUrl: steamCover(1030300),
    coverFrom: "#0ea5e9",
    coverTo: "#0c1425",
    status: "Want to Play",
    releaseDate: "TBA",
    description:
      "Ascend to the peak of a haunted kingdom as Hornet, princess-protector of Hallownest.",
  },
  {
    id: "factorio",
    source: "Steam",
    title: "Factorio",
    genres: ["Sim", "Co-op"],
    platforms: ["PC"],
    rating: 96,
    price: 35.0,
    currency: "USD",
    store: "Steam",
    storeUrl: "https://store.steampowered.com/app/427520/",
    coverUrl: steamCover(427520),
    coverFrom: "#ea580c",
    coverTo: "#1a0f0a",
    coop: true,
    status: "Paused",
    playtime: 210,
    releaseDate: "14 Aug 2020",
    description: "Build and maintain factories of ever-growing complexity on an alien planet.",
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
    currency: "USD",
    store: "Steam",
    storeUrl: "https://store.steampowered.com/app/2246340/",
    coverUrl: steamCover(2246340),
    coverFrom: "#ef4444",
    coverTo: "#1c1917",
    coop: true,
    releaseDate: "28 Feb 2025",
    description:
      "Hunt colossal monsters across a living, shifting frontier — solo or with a party of four.",
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
    tag: "teammates",
    time: "14m ago",
  },
  { id: 3, who: "maria", verb: "completed", target: "Elden Ring", tag: "", time: "1h ago" },
  { id: 4, who: "alex", verb: "started", target: "Deep Rock Galactic", tag: "", time: "3h ago" },
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

/** Placeholder shape for the identity/store connections shown in the profile. */
export type ConnectionState = "connected" | "disconnected";

export const connectedServices: {
  google: { state: ConnectionState; email?: string };
  steam: {
    state: ConnectionState;
    personaName?: string;
    avatarFrom: string;
    avatarTo: string;
    lastSyncedAt?: string;
    gameCount?: number;
  };
  playstation: { imported: boolean; gameCount?: number; importedAt?: string };
} = {
  google: { state: "connected", email: "alex.reyes@gmail.com" },
  steam: {
    state: "connected",
    personaName: "alexreyes",
    avatarFrom: "#38bdf8",
    avatarTo: "#0f172a",
    lastSyncedAt: "Today, 14:20",
    gameCount: 6,
  },
  playstation: { imported: true, gameCount: 2, importedAt: "12 Jul 2026" },
};

export const regions = ["US", "EU", "UK", "TR", "AR", "KZ"] as const;

export type Deal = {
  id: string;
  /** Internal catalog id when the title exists in the catalog. */
  gameId?: string;
  title: string;
  store: "Steam";
  price: number;
  originalPrice: number;
  discount: number;
  currency: "USD";
  coverUrl?: string;
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
    coverUrl: steamCover(2593880),
    coverFrom: "#65a30d",
    coverTo: "#1c1917",
    storeUrl: "https://store.steampowered.com/app/4594150/",
  },
  {
    id: "lemans-us",
    title: "Le Mans Ultimate",
    store: "Steam",
    price: 40.49,
    originalPrice: 44.99,
    discount: 10,
    currency: "USD",
    coverUrl: steamCover(2399420),
    coverFrom: "#2563eb",
    coverTo: "#0f172a",
    storeUrl: "https://store.steampowered.com/app/2399420/",
  },
  {
    id: "cyberpunk",
    gameId: "cyberpunk",
    title: "Cyberpunk 2077",
    store: "Steam",
    price: 17.99,
    originalPrice: 59.99,
    discount: 70,
    currency: "USD",
    coverUrl: steamCover(1091500),
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
    coverUrl: steamCover(2138330),
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
    coverUrl: steamCover(2417510),
    coverFrom: "#3f6212",
    coverTo: "#0c0a09",
    storeUrl: "https://store.steampowered.com/app/2417510/",
  },
  {
    id: "sekiro-deal",
    gameId: "sekiro",
    title: "Sekiro: Shadows Die Twice",
    store: "Steam",
    price: 29.99,
    originalPrice: 59.99,
    discount: 50,
    currency: "USD",
    coverUrl: steamCover(814380),
    coverFrom: "#b91c1c",
    coverTo: "#111827",
    storeUrl: "https://store.steampowered.com/app/814380/",
  },
  {
    id: "eldenring-deal",
    gameId: "eldenring",
    title: "Elden Ring",
    store: "Steam",
    price: 29.99,
    originalPrice: 59.99,
    discount: 50,
    currency: "USD",
    coverUrl: steamCover(1245620),
    coverFrom: "#ca8a04",
    coverTo: "#1c1917",
    storeUrl: "https://store.steampowered.com/app/1245620/",
  },
  {
    id: "drg-deal",
    gameId: "drg",
    title: "Deep Rock Galactic",
    store: "Steam",
    price: 11.99,
    originalPrice: 29.99,
    discount: 60,
    currency: "USD",
    coverUrl: steamCover(548430),
    coverFrom: "#f59e0b",
    coverTo: "#111827",
    storeUrl: "https://store.steampowered.com/app/548430/",
  },
];

/** Rows a PlayStation export file would produce — used by the import preview UI. */
export const psnImportPreview = [
  { id: "helldivers2", title: "Helldivers 2", platform: "PS5", matched: true },
  { id: "eldenring", title: "Elden Ring", platform: "PS5", matched: true },
  { id: "gow-ragnarok", title: "God of War Ragnarök", platform: "PS5", matched: true },
  { id: "returnal", title: "Returnal", platform: "PS5", matched: true },
  { id: "unknown-title", title: "PS4 Demo Disc 2019", platform: "PS4", matched: false },
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

/** Site notifications shown in the profile — invites, price drops, friend activity. */
export type NotificationKind = "invite" | "price" | "friend" | "system";

export const notifications: {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  time: string;
  unread: boolean;
}[] = [
  {
    id: "n1",
    kind: "invite",
    title: "Mira invited you to play",
    body: "Helldivers 2 · squad of 3, one slot open",
    time: "12m ago",
    unread: true,
  },
  {
    id: "n2",
    kind: "price",
    title: "Price drop on your wishlist",
    body: "Baldur's Gate 3 is down to $41.99 on Steam",
    time: "1h ago",
    unread: true,
  },
  {
    id: "n3",
    kind: "friend",
    title: "Devon added a game you own",
    body: "Hades II — you can jump into a co-op session",
    time: "5h ago",
    unread: false,
  },
  {
    id: "n4",
    kind: "system",
    title: "Steam library synced",
    body: "We refreshed your owned games and playtime",
    time: "Yesterday",
    unread: false,
  },
];

export const notificationSettings: { id: string; label: string; enabled: boolean }[] = [
  { id: "price", label: "Price-drop alerts", enabled: true },
  { id: "invites", label: "Play invites", enabled: true },
  { id: "friends", label: "Friend activity", enabled: true },
  { id: "digest", label: "Weekly deals digest", enabled: false },
];
