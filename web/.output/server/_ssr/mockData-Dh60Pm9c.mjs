import { r as __toESM } from "../_runtime.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/mockData-Dh60Pm9c.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var accents = [
	{
		id: "mono",
		name: "Mono",
		swatch: "#ffffff",
		adaptiveSwatch: true,
		primary: "hsl(0 0% 100%)",
		primaryForeground: "hsl(240 10% 4%)",
		darkPrimary: "hsl(0 0% 100%)",
		darkPrimaryForeground: "hsl(240 10% 4%)",
		lightPrimary: "hsl(240 10% 4%)",
		lightPrimaryForeground: "hsl(0 0% 100%)"
	},
	{
		id: "emerald",
		name: "Emerald",
		swatch: "#22c55e",
		primary: "hsl(142 76% 45%)",
		primaryForeground: "hsl(240 10% 4%)"
	},
	{
		id: "cyan",
		name: "Cyan",
		swatch: "#06b6d4",
		primary: "hsl(189 94% 43%)",
		primaryForeground: "hsl(240 10% 4%)"
	},
	{
		id: "violet",
		name: "Violet",
		swatch: "#8b5cf6",
		primary: "hsl(262 83% 62%)",
		primaryForeground: "hsl(0 0% 100%)"
	},
	{
		id: "orange",
		name: "Orange",
		swatch: "#f97316",
		primary: "hsl(24 95% 55%)",
		primaryForeground: "hsl(240 10% 4%)"
	},
	{
		id: "rose",
		name: "Rose",
		swatch: "#f43f5e",
		primary: "hsl(346 84% 58%)",
		primaryForeground: "hsl(0 0% 100%)"
	}
];
var Ctx = (0, import_react.createContext)(null);
var KEY = "gf.theme";
function ThemeProvider({ children }) {
	const [mode, setModeState] = (0, import_react.useState)("dark");
	const [accent, setAccentState] = (0, import_react.useState)(accents[1]);
	(0, import_react.useEffect)(() => {
		try {
			const raw = localStorage.getItem(KEY);
			if (raw) {
				const p = JSON.parse(raw);
				if (p.mode) setModeState(p.mode);
				if (p.accentId) {
					const a = accents.find((x) => x.id === p.accentId);
					if (a) setAccentState(a);
				}
			}
		} catch {}
	}, []);
	(0, import_react.useEffect)(() => {
		const html = document.documentElement;
		html.classList.toggle("dark", mode === "dark");
		html.classList.toggle("light", mode === "light");
		const primary = (mode === "dark" ? accent.darkPrimary : accent.lightPrimary) ?? accent.primary;
		const primaryForeground = (mode === "dark" ? accent.darkPrimaryForeground : accent.lightPrimaryForeground) ?? accent.primaryForeground;
		html.style.setProperty("--primary", primary);
		html.style.setProperty("--ring", primary);
		html.style.setProperty("--primary-foreground", primaryForeground);
		try {
			localStorage.setItem(KEY, JSON.stringify({
				mode,
				accentId: accent.id
			}));
		} catch {}
	}, [mode, accent]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ctx.Provider, {
		value: {
			mode,
			accent,
			setMode: setModeState,
			setAccent: (id) => {
				const a = accents.find((x) => x.id === id);
				if (a) setAccentState(a);
			}
		},
		children
	});
}
function useTheme() {
	const c = (0, import_react.useContext)(Ctx);
	if (!c) throw new Error("useTheme must be inside ThemeProvider");
	return c;
}
var games = [
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
		playtime: 84
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
		playtime: 42
	},
	{
		id: "bg3",
		title: "Baldur's Gate 3",
		genres: ["RPG", "Co-op"],
		platforms: [
			"PC",
			"PS5",
			"Xbox"
		],
		rating: 96,
		price: 59.99,
		coverFrom: "#dc2626",
		coverTo: "#1c1917",
		coop: true,
		status: "Playing with Friends",
		playtime: 128
	},
	{
		id: "eldenring",
		title: "Elden Ring",
		genres: ["RPG", "Souls-like"],
		platforms: [
			"PC",
			"PS5",
			"Xbox"
		],
		rating: 96,
		price: 41.99,
		originalPrice: 59.99,
		discount: 30,
		coverFrom: "#ca8a04",
		coverTo: "#1c1917",
		status: "Completed",
		playtime: 156
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
		playtime: 67
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
		coverTo: "#450a0a"
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
		coverTo: "#111827"
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
		playtime: 34
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
		status: "Want to Play"
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
		status: "Want to Play"
	},
	{
		id: "factorio",
		title: "Factorio",
		genres: ["Sim", "Co-op"],
		platforms: ["PC"],
		rating: 96,
		price: 35,
		coverFrom: "#ea580c",
		coverTo: "#1a0f0a",
		coop: true,
		status: "Paused",
		playtime: 210
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
		coop: true
	}
];
var friends = [
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
		avatarTo: "#4f46e5"
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
		lft: true
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
		lft: true
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
		avatarTo: "#b45309"
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
		avatarTo: "#1e1b4b"
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
		avatarTo: "#7c2d12"
	}
];
var activity = [
	{
		id: 1,
		who: "sasha",
		verb: "added",
		target: "Hades II",
		tag: "to wishlist",
		time: "2m ago"
	},
	{
		id: 2,
		who: "marcus",
		verb: "is looking for",
		target: "Helldivers 2",
		tag: "teammates (2 slots)",
		time: "14m ago"
	},
	{
		id: 3,
		who: "maria",
		verb: "completed",
		target: "Elden Ring",
		tag: "in 156h",
		time: "1h ago"
	},
	{
		id: 4,
		who: "alex",
		verb: "started",
		target: "Deep Rock Galactic",
		tag: "with Marcus",
		time: "3h ago"
	},
	{
		id: 5,
		who: "leo",
		verb: "added",
		target: "Cyberpunk 2077",
		tag: "to library",
		time: "Yesterday"
	}
];
var aiRecommendations = [
	{
		gameId: "hades2",
		reason: "Based on your 200h in Hades and Sasha's recent activity."
	},
	{
		gameId: "monsterhunter",
		reason: "Marcus, Alex and Maria all own this — perfect for a 4-stack."
	},
	{
		gameId: "factorio",
		reason: "You loved Deep Rock. Try slower, deeper co-op."
	}
];
var priceHistory = [
	{
		date: "Jan",
		price: 59.99
	},
	{
		date: "Feb",
		price: 59.99
	},
	{
		date: "Mar",
		price: 44.99
	},
	{
		date: "Apr",
		price: 59.99
	},
	{
		date: "May",
		price: 39.99
	},
	{
		date: "Jun",
		price: 59.99
	},
	{
		date: "Jul",
		price: 29.99
	}
];
var currentUser = {
	name: "Alex Vance",
	handle: "alex.vance",
	bio: "Co-op maxi. Roguelikes, tactical shooters, immersive sims.",
	avatarFrom: "#22c55e",
	avatarTo: "#0f766e",
	stats: {
		library: 342,
		friends: 47,
		shared: 118,
		playtime: 2140
	},
	favoriteGenres: [
		"Roguelike",
		"Co-op",
		"RPG",
		"Sim"
	],
	platforms: ["PC", "PS5"],
	integrations: {
		steam: true,
		telegram: true,
		google: false,
		psn: true
	}
};
//#endregion
export { currentUser as a, priceHistory as c, aiRecommendations as i, useTheme as l, accents as n, friends as o, activity as r, games as s, ThemeProvider as t };
