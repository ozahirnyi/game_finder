import { n as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { a as currentUser, s as games } from "./mockData-Dh60Pm9c.mjs";
import { E as Check, g as PenLine } from "../_libs/lucide-react.mjs";
import { n as Avatar, r as GameCover, t as AppShell } from "./AppShell-CDLTuKs8.mjs";
import { r as SectionHeader, t as Chip } from "./ui-bits-Bm3wDQpy.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/profile-BJfFRYFe.js
var import_jsx_runtime = require_jsx_runtime();
function ProfilePage() {
	const favs = games.filter((g) => [
		"hades2",
		"eldenring",
		"bg3",
		"drg"
	].includes(g.id));
	const wl = games.filter((g) => g.status === "Want to Play" || g.discount).slice(0, 3);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative mb-10 overflow-hidden rounded-3xl border border-border",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "h-40",
				style: { background: `radial-gradient(60% 100% at 30% 0%, ${currentUser.avatarFrom}55 0%, transparent 60%), linear-gradient(135deg, ${currentUser.avatarTo} 0%, hsl(240 10% 3.5%) 100%)` }
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col items-start gap-4 px-6 pb-6 sm:flex-row sm:items-end sm:gap-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Avatar, {
						from: currentUser.avatarFrom,
						to: currentUser.avatarTo,
						name: currentUser.name,
						className: "-mt-12 size-24 shrink-0 rounded-2xl ring-4 ring-background"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1 pt-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "text-3xl font-extrabold tracking-tight",
								children: currentUser.name
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "font-mono text-xs text-muted-foreground",
								children: ["@", currentUser.handle]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 max-w-lg text-sm text-muted-foreground",
								children: currentUser.bio
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						className: "flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold hover:bg-white/5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, { className: "size-3.5" }), " Edit profile"]
					})
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-2 gap-4 sm:grid-cols-4",
			children: [
				{
					l: "Library",
					v: currentUser.stats.library
				},
				{
					l: "Friends",
					v: currentUser.stats.friends
				},
				{
					l: "Shared games",
					v: currentUser.stats.shared
				},
				{
					l: "Playtime",
					v: `${currentUser.stats.playtime}h`
				}
			].map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl border border-border bg-surface p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-[10px] uppercase tracking-widest text-muted-foreground",
					children: s.l
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-3xl font-black",
					children: s.v
				})]
			}, s.l))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-10 lg:col-span-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, { title: "Preferences" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-2xl border border-border bg-surface p-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground",
								children: "Favorite genres"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mb-6 flex flex-wrap gap-2",
								children: currentUser.favoriteGenres.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
									tone: "primary",
									children: g
								}, g))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground",
								children: "Platforms"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-wrap gap-2",
								children: currentUser.platforms.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
									tone: "outline",
									children: p
								}, p))
							})
						]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, { title: "Favorite games" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-2 gap-4 md:grid-cols-4",
						children: favs.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "overflow-hidden rounded-xl border border-border bg-surface",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCover, {
								from: g.coverFrom,
								to: g.coverTo,
								title: g.title,
								className: "aspect-[3/4] w-full"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "truncate text-sm font-bold",
									children: g.title
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-0.5 text-[11px] text-muted-foreground",
									children: [g.playtime ?? "—", "h played"]
								})]
							})]
						}, g.id))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, { title: "Active wishlist" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-3",
						children: wl.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-4 rounded-xl border border-border bg-surface p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCover, {
									from: g.coverFrom,
									to: g.coverTo,
									title: g.title,
									compact: true,
									className: "size-14 rounded-md"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "truncate text-sm font-bold",
										children: g.title
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-muted-foreground",
										children: g.genres.join(" · ")
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "font-mono text-sm font-bold text-primary",
									children: ["$", g.price]
								})
							]
						}, g.id))
					})] })
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-8 lg:col-span-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-2xl border border-border bg-surface p-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, { title: "Integrations" }), [
						{
							name: "Steam",
							connected: currentUser.integrations.steam,
							note: "342 games synced"
						},
						{
							name: "PlayStation Network",
							connected: currentUser.integrations.psn,
							note: "128 games · 47 platinums"
						},
						{
							name: "Telegram",
							connected: currentUser.integrations.telegram,
							note: "Price-drop alerts"
						},
						{
							name: "Google",
							connected: currentUser.integrations.google,
							note: "Sign-in"
						}
					].map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between border-t border-border py-3 first:border-t-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-bold",
							children: i.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground",
							children: i.note
						})] }), i.connected ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
							tone: "primary",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "mr-1 size-3" }), " Connected"]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground",
							children: "Connect"
						})]
					}, i.name))]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-2xl border border-border bg-surface p-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, { title: "Privacy" }), [
						{
							l: "Library visible to friends",
							v: true
						},
						{
							l: "Wishlist visible to friends",
							v: true
						},
						{
							l: "Activity feed",
							v: true
						},
						{
							l: "Allow friend requests",
							v: false
						}
					].map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex cursor-pointer items-center justify-between border-t border-border py-3 first:border-t-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm",
							children: p.l
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: `grid h-6 w-11 place-items-start rounded-full p-0.5 transition ${p.v ? "bg-primary" : "bg-muted"} ${p.v ? "justify-items-end" : "justify-items-start"}`,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-5 rounded-full bg-background" })
						})]
					}, p.l))]
				})]
			})]
		})
	] });
}
//#endregion
export { ProfilePage as component };
