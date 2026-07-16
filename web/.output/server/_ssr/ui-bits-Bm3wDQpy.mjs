import { n as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ui-bits-Bm3wDQpy.js
var import_jsx_runtime = require_jsx_runtime();
function SectionHeader({ title, hint, action }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mb-6 flex items-end justify-between gap-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-xl font-bold tracking-tight",
				children: title
			}), hint && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted-foreground",
				children: hint
			})]
		}), action]
	});
}
function Chip({ children, tone = "muted" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: `inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest ${tone === "primary" ? "bg-primary/15 text-primary" : tone === "outline" ? "border border-border text-muted-foreground" : "bg-white/5 text-muted-foreground"}`,
		children
	});
}
function PresenceDot({ online }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `inline-block size-2 rounded-full ring-2 ring-background ${online ? "bg-primary animate-pulse-soft" : "bg-muted-foreground/40"}` });
}
//#endregion
export { PresenceDot as n, SectionHeader as r, Chip as t };
