import { n as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { o as friends, r as activity, s as games } from "./mockData-Dh60Pm9c.mjs";
import { C as Gamepad2, p as Search, r as UserPlus, v as MessageCircle } from "../_libs/lucide-react.mjs";
import { n as Avatar, r as GameCover, t as AppShell } from "./AppShell-CDLTuKs8.mjs";
import { n as PresenceDot, r as SectionHeader, t as Chip } from "./ui-bits-Bm3wDQpy.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/friends-roVNp5uS.js
var import_jsx_runtime = require_jsx_runtime();
function FriendsPage() {
	const focus = friends[0];
	const sharedGames = games.filter((g) => [
		"helldivers2",
		"bg3",
		"drg",
		"hades2",
		"eldenring",
		"stardew"
	].includes(g.id));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid grid-cols-1 gap-10 lg:grid-cols-12",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-10 lg:col-span-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
					title: "Friends",
					hint: `${friends.length} friends · ${friends.filter((f) => f.online).length} online now`,
					action: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						className: "flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserPlus, { className: "size-3.5" }), " Add friend"]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-6 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-4 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						placeholder: "Find players by game, language, platform, play style…",
						className: "flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-3",
					children: friends.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition hover:border-white/20 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative shrink-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Avatar, {
									from: f.avatarFrom,
									to: f.avatarTo,
									name: f.name,
									className: "size-14 rounded-full"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "absolute -bottom-0.5 -right-0.5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PresenceDot, { online: f.online })
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-wrap items-center gap-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "truncate font-bold",
												children: f.name
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "font-mono text-[10px] text-muted-foreground",
												children: ["@", f.handle]
											}),
											f.lft && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
												tone: "primary",
												children: "LFG"
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-0.5 truncate text-xs text-muted-foreground",
										children: f.activity
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-2 flex flex-wrap gap-1",
										children: [f.genres.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { children: g }, g)), f.platforms.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
											tone: "outline",
											children: p
										}, p))]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "hidden text-right sm:block",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-mono text-[10px] uppercase tracking-widest text-muted-foreground",
										children: "Compat"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "font-mono text-lg font-black text-primary",
										children: [f.compatibility, "%"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "mt-0.5 font-mono text-[10px] text-muted-foreground",
										children: [f.sharedGames, " shared"]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									className: "rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground",
									children: "Invite to play"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									className: "rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-bold",
									children: "Message"
								})]
							})
						]
					}, f.id))
				})
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
				title: "Play together with Sasha",
				hint: "Filtered to games you both own · 2–4 players · co-op"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-2 gap-4 md:grid-cols-3",
				children: sharedGames.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "overflow-hidden rounded-xl border border-border bg-surface",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCover, {
						from: g.coverFrom,
						to: g.coverTo,
						title: g.title,
						className: "aspect-video w-full"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate text-sm font-bold",
								children: g.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
								tone: "primary",
								children: "Both own"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							className: "mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-secondary py-1.5 text-xs font-bold",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gamepad2, { className: "size-3.5" }), " Invite"]
						})]
					})]
				}, g.id))
			})] })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-8 lg:col-span-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-3xl border border-border bg-surface p-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Avatar, {
							from: focus.avatarFrom,
							to: focus.avatarTo,
							name: focus.name,
							className: "size-16 rounded-2xl"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-bold",
							children: focus.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-mono text-xs text-muted-foreground",
							children: ["@", focus.handle]
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "my-6 grid grid-cols-3 gap-3 border-y border-border py-4 text-center font-mono",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[10px] uppercase tracking-widest text-muted-foreground",
								children: "Compat"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xl font-black text-primary",
								children: [focus.compatibility, "%"]
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[10px] uppercase tracking-widest text-muted-foreground",
								children: "Shared"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xl font-black",
								children: focus.sharedGames
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[10px] uppercase tracking-widest text-muted-foreground",
								children: "Wishlist"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xl font-black",
								children: "7"
							})] })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-4 text-sm text-muted-foreground",
						children: "Both play roguelikes and long-run RPGs. High overlap on co-op titles."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground",
							children: "Invite to play"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "grid size-10 place-items-center rounded-lg border border-border",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageCircle, { className: "size-4" })
						})]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, { title: "Feed" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-4 font-mono text-[11px] leading-relaxed",
				children: activity.map((a) => {
					const f = friends.find((x) => x.id === a.who);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Avatar, {
							from: f.avatarFrom,
							to: f.avatarTo,
							name: f.name,
							className: "size-7 shrink-0 rounded-full"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-muted-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-primary",
									children: f.name
								}),
								" ",
								a.verb,
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-foreground",
									children: a.target
								}),
								" ",
								a.tag,
								".",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-muted-foreground/60",
									children: a.time
								})
							]
						})]
					}, a.id);
				})
			})] })]
		})]
	}) });
}
//#endregion
export { FriendsPage as component };
