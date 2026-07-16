import { n as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { s as games } from "./mockData-Dh60Pm9c.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { S as Heart, h as Plus, p as Search, t as Users, u as SlidersHorizontal } from "../_libs/lucide-react.mjs";
import { r as GameCover, t as AppShell } from "./AppShell-CDLTuKs8.mjs";
import { r as SectionHeader, t as Chip } from "./ui-bits-Bm3wDQpy.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/search-BYzmyKig.js
var import_jsx_runtime = require_jsx_runtime();
var filters = [
	{
		label: "All",
		active: true
	},
	{ label: "Co-op" },
	{ label: "PC" },
	{ label: "PS5" },
	{ label: "Under $30" },
	{ label: "On sale" },
	{ label: "Roguelike" },
	{ label: "RPG" },
	{ label: "Multiplayer" }
];
function SearchPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
			title: "Search",
			hint: "42,184 games indexed across 8 storefronts."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-6 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-4 text-muted-foreground" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					defaultValue: "co-op roguelike",
					className: "flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground",
					placeholder: "Search by title, genre, mood…"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					className: "flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlidersHorizontal, { className: "size-3.5" }), " Filters"]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mb-8 flex flex-wrap gap-2",
			children: filters.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				className: `rounded-full border px-3 py-1.5 text-xs font-semibold transition ${f.active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`,
				children: f.label
			}, f.label))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-4 flex items-center justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "font-mono text-[11px] uppercase tracking-widest text-muted-foreground",
				children: [games.length, " results · sorted by relevance"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
				className: "rounded-md border border-border bg-surface px-2 py-1 text-xs",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Relevance" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Price ↑" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Discount" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: "Rating" })
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4",
			children: games.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
				className: "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition hover:border-white/20",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/games/$gameId",
					params: { gameId: g.id },
					className: "relative block",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCover, {
							from: g.coverFrom,
							to: g.coverTo,
							title: g.title,
							className: "aspect-[3/4] w-full"
						}),
						g.discount && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "absolute left-3 top-3 rounded bg-primary px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-primary-foreground",
							children: [
								"-",
								g.discount,
								"%"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-2 items-center gap-1.5 bg-gradient-to-t from-background/95 to-transparent p-3 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "grid size-8 place-items-center rounded-md bg-primary text-primary-foreground",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "grid size-8 place-items-center rounded-md border border-border bg-background/80 backdrop-blur",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, { className: "size-4" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "grid size-8 place-items-center rounded-md border border-border bg-background/80 backdrop-blur",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "size-4" })
								})
							]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/games/$gameId",
					params: { gameId: g.id },
					className: "flex flex-1 flex-col p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h5", {
							className: "font-bold leading-tight group-hover:text-primary",
							children: g.title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-muted-foreground",
							children: g.genres.join(" · ")
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 flex flex-wrap gap-1",
							children: g.platforms.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { children: p }, p))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-auto flex items-end justify-between pt-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: g.rating > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "font-mono text-[10px] uppercase tracking-widest text-muted-foreground",
								children: [g.rating, " · Score"]
							}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-right",
								children: [g.originalPrice && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "font-mono text-[10px] text-muted-foreground line-through",
									children: ["$", g.originalPrice]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "font-mono text-sm font-bold",
									children: ["$", g.price]
								})]
							})]
						})
					]
				})]
			}, g.id))
		})
	] });
}
//#endregion
export { SearchPage as component };
