import { n as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { c as priceHistory, o as friends, s as games } from "./mockData-Dh60Pm9c.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { A as ArrowLeft, D as Bell, S as Heart, c as Star, f as Share2, h as Plus, i as Trophy, l as Sparkles, t as Users } from "../_libs/lucide-react.mjs";
import { n as Avatar, r as GameCover, t as AppShell } from "./AppShell-CDLTuKs8.mjs";
import { n as PresenceDot, r as SectionHeader, t as Chip } from "./ui-bits-Bm3wDQpy.mjs";
import { t as Route } from "./games._gameId-C3AGJTl5.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/games._gameId-7NkH_EsA.js
var import_jsx_runtime = require_jsx_runtime();
function Sparkline() {
	const w = 320;
	const h = 60;
	const max = Math.max(...priceHistory.map((p) => p.price));
	const min = Math.min(...priceHistory.map((p) => p.price));
	const pts = priceHistory.map((p, i) => {
		return `${i / (priceHistory.length - 1) * w},${h - (p.price - min) / (max - min || 1) * (h - 8) - 4}`;
	}).join(" ");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "100%",
		height: h,
		viewBox: `0 0 ${w} ${h}`,
		className: "text-primary",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", {
			points: pts,
			fill: "none",
			stroke: "currentColor",
			strokeWidth: 1.5
		}), priceHistory.map((p, i) => {
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: i / (priceHistory.length - 1) * w,
				cy: h - (p.price - min) / (max - min || 1) * (h - 8) - 4,
				r: 2,
				fill: "currentColor"
			}, i);
		})]
	});
}
function GameDetail() {
	const { game } = Route.useLoaderData();
	const owners = friends.slice(0, 4);
	const similar = games.filter((g) => g.id !== game.id && g.genres.some((x) => game.genres.includes(x))).slice(0, 4);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
			to: "/search",
			className: "mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-3.5" }), " Back to search"]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "relative mb-10 overflow-hidden rounded-3xl border border-border",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCover, {
				from: game.coverFrom,
				to: game.coverTo,
				title: game.title,
				className: "h-72 w-full sm:h-96"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent p-6 sm:p-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-3 flex flex-wrap items-center gap-2",
						children: [
							game.coop && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
								tone: "primary",
								children: "Co-op · 4p"
							}),
							game.discount && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
								tone: "primary",
								children: [
									"-",
									game.discount,
									"%"
								]
							}),
							game.status === "Playing with Friends" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
								tone: "primary",
								children: "Squad active"
							}),
							game.genres.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
								tone: "outline",
								children: g
							}, g))
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-4xl font-extrabold tracking-tight sm:text-5xl",
						children: game.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 max-w-2xl text-sm text-muted-foreground",
						children: [
							game.platforms.join(" · "),
							" · ",
							owners.length,
							" friends own it ·",
							" ",
							game.rating > 0 ? `${game.rating} critic score` : "Unreleased"
						]
					})
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-1 gap-10 lg:grid-cols-12",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-10 lg:col-span-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, { title: "About" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm leading-relaxed text-muted-foreground",
						children: [
							game.title,
							" is a ",
							game.genres.join(" / ").toLowerCase(),
							" experience built for ",
							game.platforms.join(" and "),
							". GameFinder ranks it against your library and your circle's shared titles to surface the best moments to play together tonight. Cross-referenced with 12 professional reviews and 4,821 friends' playtime."
						]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, { title: "Friends who own it" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-1 gap-3 sm:grid-cols-2",
						children: owners.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3 rounded-xl border border-border bg-surface p-3",
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
										children: f.online ? f.activity : "Offline"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									className: "rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-bold hover:bg-white/5",
									children: "Invite"
								})
							]
						}, f.id))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
						title: "Price history",
						hint: "6-month trend across storefronts."
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-2xl border border-border bg-surface p-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mb-4 flex items-end justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [game.originalPrice && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "font-mono text-xs text-muted-foreground line-through",
									children: ["$", game.originalPrice]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "font-mono text-3xl font-black text-primary",
									children: ["$", game.price]
								})] }), game.discount && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-right font-mono text-[10px] uppercase tracking-widest text-primary",
									children: "Lowest in 6 months"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkline, {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-3 flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground",
								children: priceHistory.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: p.date }, p.date))
							})
						]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, { title: "You might also like" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-2 gap-4 md:grid-cols-4",
						children: similar.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/games/$gameId",
							params: { gameId: g.id },
							className: "group overflow-hidden rounded-xl border border-border bg-surface transition hover:border-white/20",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GameCover, {
								from: g.coverFrom,
								to: g.coverTo,
								title: g.title,
								className: "aspect-[3/4] w-full"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mb-1 flex items-center gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-mono text-[9px] uppercase tracking-widest text-primary",
											children: "Similar"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "truncate text-sm font-bold group-hover:text-primary",
										children: g.title
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "mt-1 font-mono text-xs",
										children: ["$", g.price]
									})
								]
							})]
						}, g.id))
					})] })
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-6 lg:col-span-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-2xl border border-border bg-surface p-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground",
								children: "Buy · Best price"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-end justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "font-mono text-3xl font-black text-primary",
									children: ["$", game.price]
								}), game.discount && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
									tone: "primary",
									children: [
										"-",
										game.discount,
										"%"
									]
								})]
							}),
							game.originalPrice && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 font-mono text-xs text-muted-foreground line-through",
								children: ["was $", game.originalPrice]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90",
								children: "Buy on Steam"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								className: "mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-bold hover:bg-white/5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "size-4" }), " Invite friends to buy together"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4 grid grid-cols-3 gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										className: "flex items-center justify-center gap-1 rounded-md border border-border bg-secondary py-2 text-xs font-bold hover:bg-white/5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, { className: "size-3.5" }), " Wish"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										className: "flex items-center justify-center gap-1 rounded-md border border-border bg-secondary py-2 text-xs font-bold hover:bg-white/5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "size-3.5" }), " Alert"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										className: "flex items-center justify-center gap-1 rounded-md border border-border bg-secondary py-2 text-xs font-bold hover:bg-white/5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Share2, { className: "size-3.5" }), " Share"]
									})
								]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-2xl border border-border bg-surface p-6",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, { title: "At a glance" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dl", {
							className: "space-y-3 text-sm",
							children: [
								{
									l: "Platforms",
									v: game.platforms.join(", "),
									icon: Plus
								},
								{
									l: "Genres",
									v: game.genres.join(", "),
									icon: Sparkles
								},
								{
									l: "Critic score",
									v: game.rating > 0 ? `${game.rating} / 100` : "TBD",
									icon: Star
								},
								{
									l: "Playtime avg.",
									v: `${game.playtime ?? 32}h`,
									icon: Trophy
								}
							].map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-muted-foreground",
									children: r.l
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-right font-bold",
									children: r.v
								})]
							}, r.l))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-6",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-2 flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[10px] uppercase tracking-widest text-primary",
								children: "Why for your squad"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm text-muted-foreground",
							children: [
								"Marcus, Alex, and Sasha all own ",
								game.title,
								". Their combined playtime is 234h — a great candidate for tonight's session."
							]
						})]
					})
				]
			})]
		})
	] });
}
//#endregion
export { GameDetail as component };
