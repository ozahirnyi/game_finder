import { n as __toESM } from "../_runtime.mjs";
import { n as require_jsx_runtime, r as require_react, t as QueryClientProvider } from "../_libs/react+tanstack__react-query.mjs";
import { t as ThemeProvider } from "./mockData-Dh60Pm9c.mjs";
import { _ as useRouter, c as HeadContent, d as createRouter, f as Outlet, g as Link, h as createRootRouteWithContext, m as createFileRoute, p as lazyRouteComponent, s as Scripts } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as Route$10 } from "./games._gameId-C3AGJTl5.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-dFbGnmO-.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var styles_default = "/assets/styles-CeWaM3PH.css";
function reportLovableError(error, context = {}) {
	if (typeof window === "undefined") return;
	window.__lovableEvents?.captureException?.(error, {
		source: "react_error_boundary",
		route: window.location.pathname,
		...context
	}, {
		mechanism: "react_error_boundary",
		handled: false,
		severity: "error"
	});
}
function NotFoundComponent() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-xs uppercase tracking-widest text-primary",
					children: "404"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-4 text-3xl font-bold text-foreground",
					children: "Level not found"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "This page rolled a natural 1. Head back to your dashboard."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90",
						children: "Return home"
					})
				})
			]
		})
	});
}
function ErrorComponent({ error, reset }) {
	console.error(error);
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		reportLovableError(error, { boundary: "tanstack_root_error_component" });
	}, [error]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-xl font-semibold text-foreground",
					children: "This page didn't load"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "Something went wrong. Try again or head back home."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-wrap justify-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							router.invalidate();
							reset();
						},
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90",
						children: "Try again"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "/",
						className: "inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent",
						children: "Go home"
					})]
				})
			]
		})
	});
}
var Route$9 = createRootRouteWithContext()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: "GameFinder — Discover games. Play with friends." },
			{
				name: "description",
				content: "GameFinder is a social game discovery platform. See what you and your friends both own, get AI recommendations, track deals, and jump into a session together."
			},
			{
				property: "og:title",
				content: "GameFinder — Discover games. Play with friends."
			},
			{
				property: "og:description",
				content: "Social game discovery: shared libraries, AI recs, wishlist deals, Steam sync, and quick co-op matchmaking with your friends."
			},
			{
				property: "og:type",
				content: "website"
			},
			{
				name: "twitter:card",
				content: "summary_large_image"
			}
		],
		links: [
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: ""
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap"
			},
			{
				rel: "icon",
				href: "/favicon.ico",
				type: "image/x-icon"
			}
		]
	}),
	shellComponent: RootShell,
	component: RootComponent,
	notFoundComponent: NotFoundComponent,
	errorComponent: ErrorComponent
});
function RootShell({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		className: "dark",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})] })]
	});
}
function RootComponent() {
	const { queryClient } = Route$9.useRouteContext();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientProvider, {
		client: queryClient,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) })
	});
}
var $$splitComponentImporter$8 = () => import("./wishlist-CG33c0KV.mjs");
var Route$8 = createFileRoute("/wishlist")({
	head: () => ({ meta: [{ title: "Wishlist — GameFinder" }, {
		name: "description",
		content: "Track wishlist items with live price history and Telegram drop alerts."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$8, "component")
});
var $$splitComponentImporter$7 = () => import("./steam-CWEAiZtP.mjs");
var Route$7 = createFileRoute("/steam")({
	head: () => ({ meta: [{ title: "Steam Integration — GameFinder" }, {
		name: "description",
		content: "Connect Steam to unlock shared-game tracking, friend compatibility, and co-op matchmaking."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$7, "component")
});
var $$splitComponentImporter$6 = () => import("./search-BYzmyKig.mjs");
var Route$6 = createFileRoute("/search")({
	head: () => ({ meta: [{ title: "Search — GameFinder" }, {
		name: "description",
		content: "Search games by title, genre, platform, mood, and active deals."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$6, "component")
});
var $$splitComponentImporter$5 = () => import("./psn-CBSPNsk8.mjs");
var Route$5 = createFileRoute("/psn")({
	head: () => ({ meta: [{ title: "PlayStation Network — GameFinder" }, {
		name: "description",
		content: "Connect PlayStation Network to sync your PS5 library, trophies, and co-op sessions with friends."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$5, "component")
});
var $$splitComponentImporter$4 = () => import("./profile-BJfFRYFe.mjs");
var Route$4 = createFileRoute("/profile")({
	head: () => ({ meta: [{ title: "Profile — GameFinder" }, {
		name: "description",
		content: "Your GameFinder profile: stats, favorite games, integrations, and privacy controls."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$4, "component")
});
var $$splitComponentImporter$3 = () => import("./library-C_HVRET3.mjs");
var Route$3 = createFileRoute("/library")({
	head: () => ({ meta: [{ title: "Library — GameFinder" }, {
		name: "description",
		content: "Your synced library across storefronts, with statuses and shared-with-friends visibility."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
var $$splitComponentImporter$2 = () => import("./friends-roVNp5uS.mjs");
var Route$2 = createFileRoute("/friends")({
	head: () => ({ meta: [{ title: "Friends — GameFinder" }, {
		name: "description",
		content: "Your gaming circle: shared libraries, LFG opportunities, compatibility, and quick invites."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
var $$splitComponentImporter$1 = () => import("./deals-BHY86RTg.mjs");
var Route$1 = createFileRoute("/deals")({
	head: () => ({ meta: [{ title: "Deals — GameFinder" }, {
		name: "description",
		content: "Live discounts across storefronts, prioritized by your wishlist and friend overlap."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
var $$splitComponentImporter = () => import("./routes-djzOmsOi.mjs");
var Route = createFileRoute("/")({
	head: () => ({ meta: [{ title: "Dashboard — GameFinder" }, {
		name: "description",
		content: "Tonight with friends: shared games, LFG opportunities, AI picks, and wishlist deals in one dark, focused view."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
var WishlistRoute = Route$8.update({
	id: "/wishlist",
	path: "/wishlist",
	getParentRoute: () => Route$9
});
var SteamRoute = Route$7.update({
	id: "/steam",
	path: "/steam",
	getParentRoute: () => Route$9
});
var SearchRoute = Route$6.update({
	id: "/search",
	path: "/search",
	getParentRoute: () => Route$9
});
var PsnRoute = Route$5.update({
	id: "/psn",
	path: "/psn",
	getParentRoute: () => Route$9
});
var ProfileRoute = Route$4.update({
	id: "/profile",
	path: "/profile",
	getParentRoute: () => Route$9
});
var LibraryRoute = Route$3.update({
	id: "/library",
	path: "/library",
	getParentRoute: () => Route$9
});
var FriendsRoute = Route$2.update({
	id: "/friends",
	path: "/friends",
	getParentRoute: () => Route$9
});
var DealsRoute = Route$1.update({
	id: "/deals",
	path: "/deals",
	getParentRoute: () => Route$9
});
var rootRouteChildren = {
	IndexRoute: Route.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$9
	}),
	DealsRoute,
	FriendsRoute,
	LibraryRoute,
	ProfileRoute,
	PsnRoute,
	SearchRoute,
	SteamRoute,
	WishlistRoute,
	GamesGameIdRoute: Route$10.update({
		id: "/games/$gameId",
		path: "/games/$gameId",
		getParentRoute: () => Route$9
	})
};
var routeTree = Route$9._addFileChildren(rootRouteChildren)._addFileTypes();
var getRouter = () => {
	return createRouter({
		routeTree,
		context: { queryClient: new QueryClient() },
		scrollRestoration: true,
		defaultPreloadStaleTime: 0
	});
};
//#endregion
export { getRouter };
