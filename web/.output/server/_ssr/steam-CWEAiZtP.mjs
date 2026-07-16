import { n as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { a as currentUser } from "./mockData-Dh60Pm9c.mjs";
import { E as Check, b as Library, d as Shield, m as RefreshCw, t as Users, y as Lock } from "../_libs/lucide-react.mjs";
import { t as AppShell } from "./AppShell-CDLTuKs8.mjs";
import { r as SectionHeader, t as Chip } from "./ui-bits-Bm3wDQpy.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/steam-CWEAiZtP.js
var import_jsx_runtime = require_jsx_runtime();
function SteamPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
			title: "Steam integration",
			hint: "Sync your library so we can surface shared games and multiplayer opportunities."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-1 gap-6 lg:grid-cols-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 to-transparent p-8 lg:col-span-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute -right-10 -top-10 size-48 rounded-full bg-primary/20 blur-3xl" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-4 flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px] uppercase tracking-[0.25em] text-primary",
								children: "Connected · Last sync 4m ago"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
							className: "text-3xl font-extrabold tracking-tight",
							children: [currentUser.stats.library, " games synced"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 max-w-md text-sm text-muted-foreground",
							children: "We refresh every 15 minutes. Your library, wishlist, and playtime feed the shared-games engine and AI recommendations."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-8 grid grid-cols-3 gap-6 border-t border-border pt-6 font-mono",
							children: [
								{
									l: "Games",
									v: currentUser.stats.library,
									i: Library
								},
								{
									l: "Friends matched",
									v: 47,
									i: Users
								},
								{
									l: "Playtime",
									v: "2,140h",
									i: RefreshCw
								}
							].map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(s.i, { className: "mb-2 size-4 text-primary" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[10px] uppercase tracking-widest text-muted-foreground",
									children: s.l
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xl font-black",
									children: s.v
								})
							] }, s.l))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-8 flex flex-wrap gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground",
								children: "Sync now"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "rounded-lg border border-border bg-surface px-4 py-2 text-sm font-bold",
								children: "Disconnect"
							})]
						})
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-3xl border border-border bg-surface p-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "mb-4 size-5 text-primary" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
						className: "mb-2 font-bold",
						children: "Privacy in plain words"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "space-y-3 text-sm text-muted-foreground",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "mt-0.5 size-4 shrink-0 text-primary" }), " Read-only. We never post or modify anything on Steam."]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "mt-0.5 size-4 shrink-0 text-primary" }), " Only your library, wishlist, and playtime are used."]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "mt-0.5 size-4 shrink-0 text-primary" }), " Friends only see what you allow in your privacy settings."]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "mt-0.5 size-4 shrink-0 text-primary" }), " Disconnect anytime — we wipe your synced data within 24 hours."]
							})
						]
					})
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-10",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, { title: "Recent sync activity" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-2 font-mono text-xs",
				children: [
					{
						t: "4m ago",
						m: "Sync complete · 342 titles · +2 new"
					},
					{
						t: "19m ago",
						m: "Detected Helldivers 2 launched (2h session)"
					},
					{
						t: "1h ago",
						m: "Playtime updated for 8 titles"
					},
					{
						t: "3h ago",
						m: "Wishlist item added: Slay the Spire 2"
					}
				].map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-4 rounded-lg border border-border bg-surface px-4 py-2.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
						tone: "primary",
						children: r.t
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground",
						children: r.m
					})]
				}, r.t))
			})]
		})
	] });
}
//#endregion
export { SteamPage as component };
