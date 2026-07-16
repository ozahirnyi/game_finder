import { n as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { c as priceHistory, s as games } from "./mockData-Dh60Pm9c.mjs";
import { D as Bell, a as TrendingDown } from "../_libs/lucide-react.mjs";
import { r as GameCover, t as AppShell } from "./AppShell-CDLTuKs8.mjs";
import { r as SectionHeader, t as Chip } from "./ui-bits-Bm3wDQpy.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/wishlist-CG33c0KV.js
var import_jsx_runtime = require_jsx_runtime();
function Sparkline() {
	const w = 200;
	const h = 44;
	const max = Math.max(...priceHistory.map((p) => p.price));
	const min = Math.min(...priceHistory.map((p) => p.price));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		width: w,
		height: h,
		className: "text-primary",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", {
			points: priceHistory.map((p, i) => {
				return `${i / (priceHistory.length - 1) * w},${h - (p.price - min) / (max - min || 1) * h}`;
			}).join(" "),
			fill: "none",
			stroke: "currentColor",
			strokeWidth: 1.5
		})
	});
}
function WishlistPage() {
	const wl = games.filter((g) => g.status === "Want to Play" || g.discount);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
		title: "Wishlist",
		hint: "14 items · 4 currently on sale",
		action: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			className: "flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold hover:bg-white/5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "size-3.5" }), " Alerts via Telegram"]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "space-y-4",
		children: wl.map((g) => {
			const drop = g.discount ? true : false;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 gap-6 rounded-2xl border border-border bg-surface p-5 md:grid-cols-[auto_minmax(0,1fr)_auto_auto] md:items-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCover, {
						from: g.coverFrom,
						to: g.coverTo,
						title: g.title,
						compact: true,
						className: "size-20 rounded-lg"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
									className: "truncate text-lg font-bold",
									children: g.title
								}), drop && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
									tone: "primary",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrendingDown, { className: "mr-1 size-3" }), " Lowest ever"]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 text-xs text-muted-foreground",
								children: [
									g.genres.join(" · "),
									" · ",
									g.platforms.join(", ")
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-xs text-muted-foreground",
								children: drop ? "3 friends also have this in wishlist." : "Not yet released · Notify on launch."
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground",
						children: "Price · 6mo"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkline, {})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-right",
						children: [
							g.originalPrice && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "font-mono text-xs text-muted-foreground line-through",
								children: ["$", g.originalPrice]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "font-mono text-2xl font-black text-primary",
								children: ["$", g.price]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground",
								children: "View deal"
							})
						]
					})
				]
			}, g.id);
		})
	})] });
}
//#endregion
export { WishlistPage as component };
