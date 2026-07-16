import { n as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as AppShell } from "./AppShell-CDLTuKs8.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/games._gameId-B5JkODyg.js
var import_jsx_runtime = require_jsx_runtime();
var SplitNotFoundComponent = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
	className: "mx-auto max-w-md py-24 text-center",
	children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "font-mono text-xs uppercase tracking-widest text-primary",
			children: "404"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "mt-3 text-2xl font-bold",
			children: "Game not in catalog"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-sm text-muted-foreground",
			children: "We couldn't find that title. It may have been delisted."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/search",
			className: "mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground",
			children: "Back to search"
		})
	]
}) });
//#endregion
export { SplitNotFoundComponent as notFoundComponent };
