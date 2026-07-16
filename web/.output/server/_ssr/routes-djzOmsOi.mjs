import { n as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { a as currentUser, i as aiRecommendations, o as friends, r as activity, s as games } from "./mockData-Dh60Pm9c.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { h as Plus, k as ArrowRight, l as Sparkles, p as Search } from "../_libs/lucide-react.mjs";
import { n as Avatar, r as GameCover, t as AppShell } from "./AppShell-CDLTuKs8.mjs";
import { n as PresenceDot, r as SectionHeader, t as Chip } from "./ui-bits-Bm3wDQpy.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-djzOmsOi.js
var import_jsx_runtime = require_jsx_runtime();
function Dashboard() {
	const featured = games.find((g) => g.id === "helldivers2");
	const shared = games.filter((g) => g.status === "Playing with Friends");
	const online = friends.filter((f) => f.online);
	const wishlistDeals = games.filter((g) => g.discount);
	const recs = aiRecommendations.map((r) => ({
		...r,
		game: games.find((g) => g.id === r.gameId)
	}));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "animate-reveal mb-12",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-6 flex flex-wrap items-end justify-between gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mb-2 font-mono text-[11px] uppercase tracking-[0.25em] text-primary",
						children: ["Tonight · ", (/* @__PURE__ */ new Date()).toLocaleDateString("en", { weekday: "long" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-4xl font-extrabold tracking-tight text-balance",
						children: "Play with friends tonight"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-muted-foreground",
						children: [
							online.length,
							" friends online · ",
							shared.length,
							" games your squad already owns."
						]
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex -space-x-3",
						children: online.slice(0, 4).map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Avatar, {
							from: f.avatarFrom,
							to: f.avatarTo,
							name: f.name,
							className: "size-11 rounded-full ring-4 ring-background"
						}, f.id))
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/friends",
						className: "rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90",
						children: "Host a session"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/search",
				className: "mb-8 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-white/20",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "size-4" }),
					"Search 42,000 games by title, genre, mood…",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
						className: "ml-auto rounded border border-border px-1.5 py-0.5 font-mono text-[10px]",
						children: "⌘K"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 gap-6 md:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/games/$gameId",
					params: { gameId: featured.id },
					className: "group relative overflow-hidden rounded-2xl border border-border bg-surface ring-1 ring-white/5 transition hover:ring-white/20",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCover, {
						from: featured.coverFrom,
						to: featured.coverTo,
						title: featured.title,
						className: "aspect-video w-full"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/80 to-transparent p-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mb-2 flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
									tone: "primary",
									children: "Shared · 12 friends"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
									tone: "outline",
									children: "Co-op · 4p"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-2xl font-bold",
								children: featured.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-sm text-muted-foreground",
								children: "Marcus and Alex are looking for 2 more Divers right now."
							})
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-col gap-4",
					children: shared.filter((g) => g.id !== "helldivers2").slice(0, 2).map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/games/$gameId",
						params: { gameId: g.id },
						className: "flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 transition hover:border-white/20",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex min-w-0 items-center gap-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCover, {
								from: g.coverFrom,
								to: g.coverTo,
								title: g.title,
								compact: true,
								className: "size-20 shrink-0 rounded-lg"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
										className: "truncate font-bold",
										children: g.title
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-0.5 text-xs text-muted-foreground",
										children: g.id === "bg3" ? "Marcus is in Act II" : "4/4 slots available in party"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-2 flex items-center gap-1.5",
										children: g.genres.slice(0, 2).map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, { children: x }, x))
									})
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "shrink-0 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-bold",
							children: "Join"
						})]
					}, g.id))
				})]
			})
		]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid grid-cols-1 gap-10 lg:grid-cols-12",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-12 lg:col-span-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "animate-reveal",
				style: { animationDelay: "100ms" },
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
					title: "AI picks for your group",
					hint: "Cross-referenced against everyone's library and mood.",
					action: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/search",
						className: "flex items-center gap-1 text-sm font-semibold text-primary",
						children: ["Explore ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-3.5" })]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid grid-cols-2 gap-5 lg:grid-cols-3",
					children: recs.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/games/$gameId",
						params: { gameId: r.gameId },
						className: "group cursor-pointer overflow-hidden rounded-xl border border-border bg-surface transition hover:border-white/20",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCover, {
							from: r.game.coverFrom,
							to: r.game.coverTo,
							title: r.game.title,
							className: "aspect-[4/5] w-full"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mb-2 flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-mono text-[10px] uppercase tracking-widest text-primary",
										children: "AI pick"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h5", {
									className: "text-sm font-bold group-hover:text-primary",
									children: r.game.title
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 line-clamp-2 text-xs text-muted-foreground",
									children: r.reason
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 flex items-center justify-between",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-mono text-sm",
										children: ["$", r.game.price]
									}), r.game.discount && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
										tone: "primary",
										children: [
											"-",
											r.game.discount,
											"%"
										]
									})]
								})
							]
						})]
					}, r.gameId))
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				className: "animate-reveal",
				style: { animationDelay: "150ms" },
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-6 flex items-center gap-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 animate-pulse-soft rounded-full bg-primary" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-lg font-bold",
								children: "Wishlist drops"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground",
								children: "Price history synced"
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-3",
						children: wishlistDeals.slice(0, 3).map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/games/$gameId",
							params: { gameId: g.id },
							className: "flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-transparent bg-background/40 p-3 transition hover:border-border hover:bg-background/80",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex min-w-0 items-center gap-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCover, {
									from: g.coverFrom,
									to: g.coverTo,
									title: g.title,
									compact: true,
									className: "size-12 shrink-0 rounded-md"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "truncate text-sm font-bold",
										children: g.title
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-muted-foreground",
										children: "Lowest price in 6 months · 2 friends own it"
									})]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-right",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "font-mono text-[10px] text-muted-foreground line-through",
										children: ["$", g.originalPrice]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "font-mono text-sm font-bold text-primary",
										children: ["$", g.price]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "grid size-8 shrink-0 place-items-center rounded-full border border-border",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-3.5" })
								})]
							})]
						}, g.id))
					})]
				})
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-10 lg:col-span-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "animate-reveal",
					style: { animationDelay: "200ms" },
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, { title: "Online now" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-2",
						children: online.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/friends",
							className: "flex items-center gap-3 rounded-xl border border-transparent p-3 transition hover:border-border hover:bg-surface",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "relative shrink-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Avatar, {
										from: f.avatarFrom,
										to: f.avatarTo,
										name: f.name,
										className: "size-11 rounded-full"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "absolute -bottom-0.5 -right-0.5",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PresenceDot, { online: f.online })
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "truncate text-sm font-bold",
										children: f.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "truncate text-xs text-muted-foreground",
										children: f.activity
									})]
								}),
								f.lft ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
									tone: "primary",
									children: "LFG"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "font-mono text-[10px] text-muted-foreground",
									children: [f.compatibility, "%"]
								})
							]
						}, f.id))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "relative overflow-hidden rounded-2xl border border-border bg-surface p-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute -right-8 -bottom-8 size-32 rounded-full bg-primary/20 blur-3xl" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-1 font-mono text-[10px] uppercase tracking-widest text-primary",
								children: "Steam · Connected"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
								className: "mb-2 font-bold",
								children: [currentUser.stats.library, " games imported"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-4 text-sm text-muted-foreground",
								children: "We refresh your library every 15 minutes to spot new shared titles."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/steam",
								className: "inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-bold hover:bg-white/5",
								children: ["Manage sync ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-3.5" })]
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "animate-reveal",
					style: { animationDelay: "250ms" },
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, { title: "Activity" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "space-y-4 font-mono text-[11px] leading-relaxed",
							children: activity.map((a) => {
								const f = friends.find((x) => x.id === a.who);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mt-1 size-1.5 shrink-0 rounded-full bg-primary/60" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
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
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							className: "mt-4 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3" }), " Post an update"]
						})
					]
				})
			]
		})]
	})] });
}
//#endregion
export { Dashboard as component };
