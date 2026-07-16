import { n as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { E as Check, O as Award, d as Shield, i as Trophy, m as RefreshCw, t as Users, y as Lock } from "../_libs/lucide-react.mjs";
import { t as AppShell } from "./AppShell-CDLTuKs8.mjs";
import { r as SectionHeader, t as Chip } from "./ui-bits-Bm3wDQpy.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/psn-CBSPNsk8.js
var import_jsx_runtime = require_jsx_runtime();
function PsnPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
			title: "PlayStation Network",
			hint: "Sync your PSN library so we can match trophies, party sessions, and shared PS5 titles."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-1 gap-6 lg:grid-cols-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative overflow-hidden rounded-3xl border p-8 lg:col-span-2",
				style: {
					borderColor: "rgba(0, 112, 209, 0.35)",
					background: "linear-gradient(135deg, rgba(0,112,209,0.18) 0%, transparent 65%)"
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute -right-10 -top-10 size-56 rounded-full blur-3xl",
					style: { background: "rgba(0,112,209,0.25)" }
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-4 flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
								className: "size-4",
								style: { color: "#4aa3ff" }
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px] uppercase tracking-[0.25em]",
								style: { color: "#4aa3ff" },
								children: "Connected · alex_v_ps · Last sync 12m ago"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-3xl font-extrabold tracking-tight",
							children: "128 PS5 games · 47 platinums"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 max-w-md text-sm text-muted-foreground",
							children: "We match your PSN library with friends' PS accounts, surface Play Together opportunities, and cross-reference PS Plus catalog with your wishlist."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-8 grid grid-cols-3 gap-6 border-t border-border pt-6 font-mono",
							children: [
								{
									l: "PS games",
									v: 128,
									i: Trophy
								},
								{
									l: "Platinums",
									v: 47,
									i: Award
								},
								{
									l: "PS friends",
									v: 21,
									i: Users
								}
							].map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(s.i, {
									className: "mb-2 size-4",
									style: { color: "#4aa3ff" }
								}),
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
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									className: "rounded-lg px-4 py-2 text-sm font-bold text-white",
									style: { background: "#0070d1" },
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "mr-1.5 inline size-3.5" }), " Sync now"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									className: "rounded-lg border border-border bg-surface px-4 py-2 text-sm font-bold",
									children: "Disconnect"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									className: "rounded-lg border border-border bg-surface px-4 py-2 text-sm font-bold",
									children: "Manage PS Plus"
								})
							]
						})
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-3xl border border-border bg-surface p-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, {
						className: "mb-4 size-5",
						style: { color: "#4aa3ff" }
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
						className: "mb-2 font-bold",
						children: "What we read"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "space-y-3 text-sm text-muted-foreground",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
									className: "mt-0.5 size-4 shrink-0",
									style: { color: "#4aa3ff" }
								}), "Owned games, trophy list, and playtime (read-only)."]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
									className: "mt-0.5 size-4 shrink-0",
									style: { color: "#4aa3ff" }
								}), "Online presence and friends list for LFG matching."]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
									className: "mt-0.5 size-4 shrink-0",
									style: { color: "#4aa3ff" }
								}), "PS Plus tier so we surface catalog freebies you already have access to."]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, {
									className: "mt-0.5 size-4 shrink-0",
									style: { color: "#4aa3ff" }
								}), "We never send party invites or messages on your behalf."]
							})
						]
					})
				]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, { title: "Recent PSN activity" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-2 font-mono text-xs",
				children: [
					{
						t: "12m ago",
						m: "Sync complete · 128 titles · +1 trophy"
					},
					{
						t: "1h ago",
						m: "Earned trophy: Path of the Furies (Helldivers 2)"
					},
					{
						t: "3h ago",
						m: "Party with Marcus, Alex (2h 14m)"
					},
					{
						t: "Yesterday",
						m: "PS Plus Essential renewed"
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
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionHeader, {
				title: "Cross-play matches",
				hint: "Friends on PS5 that share PC titles with you."
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-2",
				children: [
					{
						name: "Marcus V.",
						g: "Helldivers 2",
						cross: "PC ↔ PS5"
					},
					{
						name: "Maya R.",
						g: "Elden Ring",
						cross: "PS5 only"
					},
					{
						name: "Sasha K.",
						g: "Baldur's Gate 3",
						cross: "PC ↔ PS5"
					}
				].map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-bold",
						children: r.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: r.g
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
						tone: "outline",
						children: r.cross
					})]
				}, r.name))
			})] })]
		})
	] });
}
//#endregion
export { PsnPage as component };
