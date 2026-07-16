import { n as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { s as games } from "./mockData-Dh60Pm9c.mjs";
import { T as Clock, w as Flame } from "../_libs/lucide-react.mjs";
import { r as GameCover, t as AppShell } from "./AppShell-CDLTuKs8.mjs";
import { r as SectionHeader, t as Chip } from "./ui-bits-Bm3wDQpy.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/deals-BHY86RTg.js
var import_jsx_runtime = require_jsx_runtime();
function DealsPage() {
	const deals = games.filter((g) => g.discount);
	const hero = deals[0];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
			title: "Deals",
			hint: `${deals.length} active discounts · refreshed 2 min ago`
		}),
		hero && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-10 grid grid-cols-1 gap-6 overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-transparent to-transparent p-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:p-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-4 flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flame, { className: "size-4 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-[11px] uppercase tracking-[0.25em] text-primary",
						children: "Deal of the day"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-4xl font-extrabold tracking-tight",
					children: hero.title
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 max-w-md text-sm text-muted-foreground",
					children: "Matches your wishlist and 3 friends already own it. Sale ends in 2 days."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-wrap items-end gap-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-mono text-xs text-muted-foreground line-through",
							children: ["$", hero.originalPrice]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-mono text-5xl font-black text-primary",
							children: ["$", hero.price]
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
							tone: "primary",
							children: [
								"-",
								hero.discount,
								"%"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1.5 text-xs text-muted-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "size-3.5" }), " Ends in 47:12:04"]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-8 flex flex-wrap gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground",
						children: "View deal"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-bold hover:bg-white/5",
						children: "Invite friends to buy together"
					})]
				})
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCover, {
				from: hero.coverFrom,
				to: hero.coverTo,
				title: hero.title,
				className: "aspect-video min-h-56 w-full rounded-2xl"
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-1 gap-4 md:grid-cols-2",
			children: deals.slice(1).map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition hover:border-white/20",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCover, {
						from: g.coverFrom,
						to: g.coverTo,
						title: g.title,
						compact: true,
						className: "size-24 shrink-0 rounded-xl"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
								className: "truncate text-lg font-bold",
								children: g.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-0.5 text-xs text-muted-foreground",
								children: g.genres.join(" · ")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-2 flex items-center gap-2",
								children: g.platforms.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { children: p }, p))
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-right",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
								tone: "primary",
								children: [
									"-",
									g.discount,
									"%"
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 font-mono text-[10px] text-muted-foreground line-through",
								children: ["$", g.originalPrice]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "font-mono text-lg font-black text-primary",
								children: ["$", g.price]
							})
						]
					})
				]
			}, g.id))
		})
	] });
}
//#endregion
export { DealsPage as component };
