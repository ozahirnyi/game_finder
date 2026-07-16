import { n as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { s as games } from "./mockData-Dh60Pm9c.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as GameCover, t as AppShell } from "./AppShell-CDLTuKs8.mjs";
import { r as SectionHeader, t as Chip } from "./ui-bits-Bm3wDQpy.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/library-C_HVRET3.js
var import_jsx_runtime = require_jsx_runtime();
var tabs = [
	"All",
	"Playing with Friends",
	"Playing",
	"Want to Play",
	"Completed",
	"Paused"
];
function LibraryPage() {
	const owned = games.filter((g) => g.status);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-8 flex flex-wrap items-end justify-between gap-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
				title: "Library",
				hint: `${owned.length} games synced · 118 shared with friends`
			}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex items-center gap-6 font-mono",
				children: [
					{
						l: "Playing",
						v: 2
					},
					{
						l: "Completed",
						v: 41
					},
					{
						l: "Backlog",
						v: 87
					},
					{
						l: "Hours",
						v: "2,140"
					}
				].map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[10px] uppercase tracking-widest text-muted-foreground",
					children: s.l
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xl font-bold",
					children: s.v
				})] }, s.l))
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mb-8 flex flex-wrap gap-2 border-b border-border pb-4",
			children: tabs.map((t, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				className: `rounded-full px-3 py-1.5 text-xs font-bold transition ${i === 0 ? "bg-white/5 text-foreground" : "text-muted-foreground hover:text-foreground"}`,
				children: t
			}, t))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "space-y-3",
			children: owned.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/games/$gameId",
				params: { gameId: g.id },
				className: "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-5 rounded-xl border border-border bg-surface p-4 transition hover:border-white/20 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCover, {
						from: g.coverFrom,
						to: g.coverTo,
						title: g.title,
						compact: true,
						className: "size-16 shrink-0 rounded-lg"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
								className: "truncate font-bold",
								children: g.title
							}), g.status === "Playing with Friends" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
								tone: "primary",
								children: "Squad · 3"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-xs text-muted-foreground",
							children: [
								g.genres.join(" · "),
								" · ",
								g.platforms.join(", ")
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "hidden text-right sm:block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-mono text-[10px] uppercase tracking-widest text-muted-foreground",
							children: "Status"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-bold",
							children: g.status
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-right",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-mono text-[10px] uppercase tracking-widest text-muted-foreground",
							children: "Playtime"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-mono text-sm font-bold",
							children: [g.playtime ?? 0, "h"]
						})]
					})
				]
			}, g.id))
		})
	] });
}
//#endregion
export { LibraryPage as component };
