import { n as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { a as currentUser, l as useTheme, n as accents } from "./mockData-Dh60Pm9c.mjs";
import { g as Link, l as useRouterState } from "../_libs/@tanstack/react-router+[...].mjs";
import { C as Gamepad2, D as Bell, S as Heart, _ as Moon, b as Library, i as Trophy, n as User, o as Tag, p as Search, s as Sun, t as Users, x as House } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/AppShell-CDLTuKs8.js
var import_jsx_runtime = require_jsx_runtime();
function GameCover({ from, to, title, className = "", compact = false }) {
	const initials = title.split(/\s|:/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `relative overflow-hidden ${className}`,
		style: { background: `radial-gradient(120% 90% at 15% 10%, ${from}55 0%, transparent 55%), linear-gradient(135deg, ${to} 0%, ${from}22 100%), ${to}` },
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_80%_90%,rgba(255,255,255,0.08),transparent_50%)]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "absolute inset-0 flex flex-col justify-between p-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "font-mono text-[9px] uppercase tracking-[0.2em] text-white/50",
				children: ["GF · ", title.split(" ")[0].slice(0, 4).toUpperCase()]
			}), compact ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-black text-2xl tracking-tighter text-white/90 leading-none",
				children: initials
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-black text-3xl tracking-tighter text-white/95 leading-[0.9]",
				children: title
			})]
		})]
	});
}
function Avatar({ from, to, name, className = "" }) {
	const initials = name.split(/\s|\./).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: `grid place-items-center font-bold text-white/95 ${className}`,
		style: { background: `linear-gradient(135deg, ${from}, ${to})` },
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-xs",
			children: initials
		})
	});
}
function ThemeSelector({ compact = false }) {
	const { mode, accent, setMode, setAccent } = useTheme();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `rounded-xl border border-border bg-surface-2 p-3 ${compact ? "" : "space-y-3"}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-mono text-[10px] uppercase tracking-widest text-muted-foreground",
				children: "Theme"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center rounded-md border border-border bg-background p-0.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => setMode("dark"),
					"aria-label": "Dark mode",
					"aria-pressed": mode === "dark",
					className: `grid size-6 place-items-center rounded transition ${mode === "dark" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, { className: "size-3.5" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => setMode("light"),
					"aria-label": "Light mode",
					"aria-pressed": mode === "light",
					className: `grid size-6 place-items-center rounded transition ${mode === "light" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, { className: "size-3.5" })
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: `flex items-center gap-1.5 ${compact ? "mt-2" : ""}`,
			children: accents.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: () => setAccent(a.id),
				"aria-label": `Accent ${a.name}`,
				"aria-pressed": accent.id === a.id,
				title: a.name,
				className: `size-5 rounded-full ring-offset-2 ring-offset-surface-2 transition ${accent.id === a.id ? "ring-2 ring-foreground" : ""}`,
				style: {
					background: a.adaptiveSwatch ? "linear-gradient(135deg, #ffffff 0 50%, #0a0a0f 50% 100%)" : a.swatch,
					border: a.adaptiveSwatch ? "1px solid var(--border)" : void 0
				}
			}, a.id))
		})]
	});
}
var nav = [
	{
		to: "/",
		label: "Home",
		icon: House
	},
	{
		to: "/search",
		label: "Search",
		icon: Search
	},
	{
		to: "/library",
		label: "Library",
		icon: Library
	},
	{
		to: "/wishlist",
		label: "Wishlist",
		icon: Heart
	},
	{
		to: "/deals",
		label: "Deals",
		icon: Tag
	},
	{
		to: "/friends",
		label: "Friends",
		icon: Users
	},
	{
		to: "/steam",
		label: "Steam",
		icon: Gamepad2
	},
	{
		to: "/psn",
		label: "PSN",
		icon: Trophy
	},
	{
		to: "/profile",
		label: "Profile",
		icon: User
	}
];
function AppShell({ children }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen bg-background text-foreground selection:bg-primary/30",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "fixed left-0 top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface p-6 lg:flex z-40",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/",
						className: "mb-10 flex items-center gap-3 px-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid size-8 place-items-center rounded-lg bg-primary",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-4 rounded-sm bg-background" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xl font-bold uppercase tracking-tight",
							children: "GameFinder"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "space-y-1",
						children: nav.map((item) => {
							const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
							const Icon = item.icon;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: item.to,
								className: `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-white/5 text-foreground" : "text-muted-foreground hover:text-foreground"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" }), item.label]
							}, item.to);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-auto space-y-4 pt-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeSelector, {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative overflow-hidden rounded-xl border border-border bg-surface-2 p-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute -right-6 -bottom-6 size-24 rounded-full bg-primary/10 blur-3xl" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mb-1 font-mono text-[10px] uppercase tracking-widest text-primary",
										children: "Steam · Synced"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-xs text-muted-foreground",
										children: [currentUser.stats.library, " games · updated 4m ago"]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/profile",
								className: "flex items-center gap-3 rounded-lg border border-transparent p-2 hover:border-border",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Avatar, {
									from: currentUser.avatarFrom,
									to: currentUser.avatarTo,
									name: currentUser.name,
									className: "size-10 shrink-0 rounded-full"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "truncate text-sm font-semibold",
										children: currentUser.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "truncate text-xs text-muted-foreground",
										children: ["@", currentUser.handle]
									})]
								})]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/",
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid size-7 place-items-center rounded-md bg-primary",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-3.5 rounded-sm bg-background" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-bold uppercase tracking-tight",
						children: "GameFinder"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: "grid size-9 place-items-center rounded-md border border-border",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "size-4" })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
				className: "lg:pl-64",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mx-auto max-w-7xl px-5 py-8 pb-28 lg:px-10 lg:py-10",
					children
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-surface/90 px-2 py-2 backdrop-blur lg:hidden",
				children: nav.slice(0, 5).map((item) => {
					const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
					const Icon = item.icon;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: item.to,
						className: `flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-2 py-1.5 ${active ? "text-primary" : "text-muted-foreground"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] font-semibold uppercase tracking-tight",
							children: item.label
						})]
					}, item.to);
				})
			})
		]
	});
}
//#endregion
export { Avatar as n, GameCover as r, AppShell as t };
