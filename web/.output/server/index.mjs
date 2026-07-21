globalThis.__nitro_main__ = import.meta.url;
import { a as toEventHandler, c as serve, i as defineLazyEventHandler, n as HTTPError, r as defineHandler, s as NodeResponse, t as H3Core } from "./_libs/h3+rou3+srvx.mjs";
import { i as withoutTrailingSlash, n as joinURL, r as withLeadingSlash, t as decodePath } from "./_libs/ufo.mjs";
import { promises } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
//#region #nitro-vite-setup
function lazyService(loader) {
	let promise, mod;
	return { fetch(req) {
		if (mod) return mod.fetch(req);
		if (!promise) promise = loader().then((_mod) => mod = _mod.default || _mod);
		return promise.then((mod) => mod.fetch(req));
	} };
}
var services = { ["ssr"]: lazyService(() => import("./_ssr/ssr.mjs")) };
globalThis.__nitro_vite_envs__ = services;
//#endregion
//#region node_modules/nitro/dist/runtime/internal/route-rules.mjs
var headers = ((m) => function headersRouteRule(event) {
	for (const [key, value] of Object.entries(m.options || {})) event.res.headers.set(key, value);
});
//#endregion
//#region #nitro/virtual/public-assets-data
var public_assets_data_default = {
	"/file.svg": {
		"type": "image/svg+xml",
		"etag": "\"187-+zgO7/6H1QtZc4NmTAKYKWTQ0ow\"",
		"mtime": "2026-07-01T12:57:32.756Z",
		"size": 391,
		"path": "../public/file.svg"
	},
	"/globe.svg": {
		"type": "image/svg+xml",
		"etag": "\"40b-LrojsBpGczu4Qj5tOOv19+lavsU\"",
		"mtime": "2026-07-01T12:57:32.777Z",
		"size": 1035,
		"path": "../public/globe.svg"
	},
	"/vercel.svg": {
		"type": "image/svg+xml",
		"etag": "\"80-zruIUtWMiIa+PpBRomlX9Cu4Lxo\"",
		"mtime": "2026-07-01T12:57:32.818Z",
		"size": 128,
		"path": "../public/vercel.svg"
	},
	"/window.svg": {
		"type": "image/svg+xml",
		"etag": "\"181-VMSODapsqjF/4bTEGQB/2T6Ujbk\"",
		"mtime": "2026-07-01T12:57:32.836Z",
		"size": 385,
		"path": "../public/window.svg"
	},
	"/next.svg": {
		"type": "image/svg+xml",
		"etag": "\"55f-Pz6VYiYSuYnFvWoDKZowjG88fms\"",
		"mtime": "2026-07-01T12:57:32.798Z",
		"size": 1375,
		"path": "../public/next.svg"
	},
	"/assets/check-6g3s2cNl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"74-VugasBnk4V3oR6nZ4rzbCIRBJtg\"",
		"mtime": "2026-07-19T15:44:48.469Z",
		"size": 116,
		"path": "../public/assets/check-6g3s2cNl.js"
	},
	"/assets/AppShell-CJZYpPzc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2b21-kkqffUaNlD3ctIHvQHX6VOW4XT4\"",
		"mtime": "2026-07-19T15:44:48.469Z",
		"size": 11041,
		"path": "../public/assets/AppShell-CJZYpPzc.js"
	},
	"/assets/deals-DSU8YBEj.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d5a-x7R+t1lPmUY/0tyfvUVVbvLjUAM\"",
		"mtime": "2026-07-19T15:44:48.470Z",
		"size": 3418,
		"path": "../public/assets/deals-DSU8YBEj.js"
	},
	"/assets/friends-MQE_4hxX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a8e-FW8zG2sBupEmWiTuj/Nh4O5XR0I\"",
		"mtime": "2026-07-19T15:44:48.472Z",
		"size": 6798,
		"path": "../public/assets/friends-MQE_4hxX.js"
	},
	"/assets/games._gameId-DiyjNaNQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"24b2-cx4gr0EV5HLvzgHDJpGj5YDKP18\"",
		"mtime": "2026-07-19T15:44:48.473Z",
		"size": 9394,
		"path": "../public/assets/games._gameId-DiyjNaNQ.js"
	},
	"/assets/games._gameId-TuSPkzMl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2c9-uazaCMZc3IepTTsxTaPxaCqjNs0\"",
		"mtime": "2026-07-19T15:44:48.474Z",
		"size": 713,
		"path": "../public/assets/games._gameId-TuSPkzMl.js"
	},
	"/assets/library-CuExuiTC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a01-0sy47BCsF4aED/vfQVRI/iH2yrs\"",
		"mtime": "2026-07-19T15:44:48.474Z",
		"size": 2561,
		"path": "../public/assets/library-CuExuiTC.js"
	},
	"/assets/plus-UplZ9BVf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"91-CpVyIZIB+Pjw8K5aUZYMNS5HFPI\"",
		"mtime": "2026-07-19T15:44:48.475Z",
		"size": 145,
		"path": "../public/assets/plus-UplZ9BVf.js"
	},
	"/assets/profile-DK5zA4bK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"179f-+1dQE40c3Q5p9Fk0a2NBHufvY+U\"",
		"mtime": "2026-07-19T15:44:48.475Z",
		"size": 6047,
		"path": "../public/assets/profile-DK5zA4bK.js"
	},
	"/assets/psn-BGgjthWq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"145b-DV1/JTQMDUgu8/L9uzyYR8Tn/2g\"",
		"mtime": "2026-07-19T15:44:48.475Z",
		"size": 5211,
		"path": "../public/assets/psn-BGgjthWq.js"
	},
	"/assets/routes-CKvNcdeJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2844-Qm5lVieED1n1ni6lxyjZKU9ZShw\"",
		"mtime": "2026-07-19T15:44:48.476Z",
		"size": 10308,
		"path": "../public/assets/routes-CKvNcdeJ.js"
	},
	"/assets/search-BDMJ5AGB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1249-9ldcVty7w7P9+BFJ4NwOcdalM8o\"",
		"mtime": "2026-07-19T15:44:48.476Z",
		"size": 4681,
		"path": "../public/assets/search-BDMJ5AGB.js"
	},
	"/assets/shield-rTczAJ43.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2a3-DzJP4Vmn/R0YnYzUs+vDn+16WhA\"",
		"mtime": "2026-07-19T15:44:48.477Z",
		"size": 675,
		"path": "../public/assets/shield-rTczAJ43.js"
	},
	"/assets/sparkles-BIY9dL9u.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1e6-Vt4l6/yeuurDzY7JqFppYxO0fUA\"",
		"mtime": "2026-07-19T15:44:48.477Z",
		"size": 486,
		"path": "../public/assets/sparkles-BIY9dL9u.js"
	},
	"/assets/steam-Dr6oEP5t.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f0f-LrpCtPzsHVaBuQI2MhW/62GFjrI\"",
		"mtime": "2026-07-19T15:44:48.478Z",
		"size": 3855,
		"path": "../public/assets/steam-Dr6oEP5t.js"
	},
	"/assets/ui-bits-BUKaDaCJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"39e-QP+NQPy+HfWJ0YH/oJ8DiQmKhY4\"",
		"mtime": "2026-07-19T15:44:48.478Z",
		"size": 926,
		"path": "../public/assets/ui-bits-BUKaDaCJ.js"
	},
	"/assets/index-CVyjcO_q.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"56c5d-wYHRASRFRp04+/0/8vkCn6Wrofc\"",
		"mtime": "2026-07-19T15:44:48.468Z",
		"size": 355421,
		"path": "../public/assets/index-CVyjcO_q.js"
	},
	"/assets/styles-CeWaM3PH.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"158b2-K6E2I3Vlc7a8TsNLLgpxGbSrGNA\"",
		"mtime": "2026-07-19T15:44:48.479Z",
		"size": 88242,
		"path": "../public/assets/styles-CeWaM3PH.css"
	},
	"/assets/wishlist-N0hQlRO9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a0f-FQwb02qVAhqpkbfw4aXvCU1sDS4\"",
		"mtime": "2026-07-19T15:44:48.479Z",
		"size": 2575,
		"path": "../public/assets/wishlist-N0hQlRO9.js"
	}
};
//#endregion
//#region #nitro/virtual/public-assets-node
function readAsset(id) {
	const serverDir = dirname(fileURLToPath(globalThis.__nitro_main__));
	return promises.readFile(resolve(serverDir, public_assets_data_default[id].path));
}
//#endregion
//#region #nitro/virtual/public-assets
var publicAssetBases = {};
function isPublicAssetURL(id = "") {
	if (public_assets_data_default[id]) return true;
	for (const base in publicAssetBases) if (id.startsWith(base)) return true;
	return false;
}
function getAsset(id) {
	return public_assets_data_default[id];
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/static.mjs
var METHODS = /* @__PURE__ */ new Set(["HEAD", "GET"]);
var EncodingMap = {
	gzip: ".gz",
	br: ".br",
	zstd: ".zst"
};
var static_default = defineHandler((event) => {
	if (event.req.method && !METHODS.has(event.req.method)) return;
	let id = decodePath(withLeadingSlash(withoutTrailingSlash(event.url.pathname)));
	let asset;
	const encodings = [...(event.req.headers.get("accept-encoding") || "").split(",").map((e) => EncodingMap[e.trim()]).filter(Boolean).sort(), ""];
	for (const encoding of encodings) for (const _id of [id + encoding, joinURL(id, "index.html" + encoding)]) {
		const _asset = getAsset(_id);
		if (_asset) {
			asset = _asset;
			id = _id;
			break;
		}
	}
	if (!asset) {
		if (isPublicAssetURL(id)) {
			event.res.headers.delete("Cache-Control");
			throw new HTTPError({ status: 404 });
		}
		return;
	}
	if (encodings.length > 1) event.res.headers.append("Vary", "Accept-Encoding");
	if (event.req.headers.get("if-none-match") === asset.etag) {
		event.res.status = 304;
		event.res.statusText = "Not Modified";
		return "";
	}
	const ifModifiedSinceH = event.req.headers.get("if-modified-since");
	const mtimeDate = new Date(asset.mtime);
	if (ifModifiedSinceH && asset.mtime && new Date(ifModifiedSinceH) >= mtimeDate) {
		event.res.status = 304;
		event.res.statusText = "Not Modified";
		return "";
	}
	if (asset.type) event.res.headers.set("Content-Type", asset.type);
	if (asset.etag && !event.res.headers.has("ETag")) event.res.headers.set("ETag", asset.etag);
	if (asset.mtime && !event.res.headers.has("Last-Modified")) event.res.headers.set("Last-Modified", mtimeDate.toUTCString());
	if (asset.encoding && !event.res.headers.has("Content-Encoding")) event.res.headers.set("Content-Encoding", asset.encoding);
	if (asset.size > 0 && !event.res.headers.has("Content-Length")) event.res.headers.set("Content-Length", asset.size.toString());
	return readAsset(id);
});
//#endregion
//#region #nitro/virtual/routing
var findRouteRules = /* @__PURE__ */ (() => {
	const $0 = [{
		name: "headers",
		route: "/assets/**",
		handler: headers,
		options: { "cache-control": "public, max-age=31536000, immutable" }
	}];
	return (m, p) => {
		let r = [];
		if (p.charCodeAt(p.length - 1) === 47) p = p.slice(0, -1) || "/";
		let s = p.split("/");
		if (s.length > 1) {
			if (s[1] === "assets") r.unshift({
				data: $0,
				params: { "_": s.slice(2).join("/") }
			});
		}
		return r;
	};
})();
var _lazy_EZ0xOZ = defineLazyEventHandler(() => import("./_chunks/ssr-renderer.mjs"));
var findRoute = /* @__PURE__ */ (() => {
	const data = {
		route: "/**",
		handler: _lazy_EZ0xOZ
	};
	return ((_m, p) => {
		return {
			data,
			params: { "_": p.slice(1) }
		};
	});
})();
var globalMiddleware = [toEventHandler(static_default)].filter(Boolean);
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/prod.mjs
var errorHandler = (error, event) => {
	const res = defaultHandler(error, event);
	return new NodeResponse(typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2), res);
};
function defaultHandler(error, event) {
	const unhandled = error.unhandled ?? !HTTPError.isError(error);
	const { status = 500, statusText = "" } = unhandled ? {} : error;
	if (status === 404) {
		const url = event.url || new URL(event.req.url);
		const baseURL = "/";
		if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) return {
			status: 302,
			headers: new Headers({ location: `${baseURL}${url.pathname.slice(1)}${url.search}` })
		};
	}
	const headers = new Headers(unhandled ? {} : error.headers);
	headers.set("content-type", "application/json; charset=utf-8");
	return {
		status,
		statusText,
		headers,
		body: {
			error: true,
			...unhandled ? {
				status,
				unhandled: true
			} : typeof error.toJSON === "function" ? error.toJSON() : {
				status,
				statusText,
				message: error.message
			}
		}
	};
}
//#endregion
//#region #nitro/virtual/error-handler
var errorHandlers = [errorHandler];
async function error_handler_default(error, event) {
	for (const handler of errorHandlers) try {
		const response = await handler(error, event, { defaultHandler });
		if (response) return response;
	} catch (error) {
		console.error(error);
	}
}
//#endregion
//#region #nitro/virtual/app
function createNitroApp() {
	const captureError = (error, errorCtx) => {
		if (errorCtx?.event) {
			const errors = errorCtx.event.req.context?.nitro?.errors;
			if (errors) errors.push({
				error,
				context: errorCtx
			});
		}
	};
	const h3App = createH3App({ onError(error, event) {
		return error_handler_default(error, event);
	} });
	let appHandler = (req) => {
		req.context ||= {};
		req.context.nitro = req.context.nitro || { errors: [] };
		return h3App.fetch(req);
	};
	return {
		fetch: appHandler,
		h3: h3App,
		hooks: void 0,
		captureError
	};
}
function createH3App(config) {
	const h3App = new H3Core(config);
	h3App["~findRoute"] = (event) => findRoute(event.req.method, event.url.pathname);
	h3App["~middleware"].push(...globalMiddleware);
	h3App["~getMiddleware"] = (event, route) => {
		const pathname = event.url.pathname;
		const method = event.req.method;
		const middleware = [];
		const routeRules = getRouteRules(method, pathname);
		event.context.routeRules = routeRules?.routeRules;
		if (routeRules?.routeRuleMiddleware.length) middleware.push(...routeRules.routeRuleMiddleware);
		middleware.push(...h3App["~middleware"]);
		if (route?.data?.middleware?.length) middleware.push(...route.data.middleware);
		return middleware;
	};
	return h3App;
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/app.mjs
var APP_ID = "default";
function useNitroApp() {
	let instance = useNitroApp._instance;
	if (instance) return instance;
	instance = useNitroApp._instance = createNitroApp();
	globalThis.__nitro__ = globalThis.__nitro__ || {};
	globalThis.__nitro__[APP_ID] = instance;
	return instance;
}
function getRouteRules(method, pathname) {
	const m = findRouteRules(method, pathname);
	if (!m?.length) return { routeRuleMiddleware: [] };
	const routeRules = {};
	for (const layer of m) for (const rule of layer.data) {
		const currentRule = routeRules[rule.name];
		if (currentRule) {
			if (rule.options === false) {
				delete routeRules[rule.name];
				continue;
			}
			if (typeof currentRule.options === "object" && typeof rule.options === "object") currentRule.options = {
				...currentRule.options,
				...rule.options
			};
			else currentRule.options = rule.options;
			currentRule.route = rule.route;
			currentRule.params = {
				...currentRule.params,
				...layer.params
			};
		} else if (rule.options !== false) routeRules[rule.name] = {
			...rule,
			params: layer.params
		};
	}
	const middleware = [];
	const orderedRules = Object.values(routeRules).sort((a, b) => (a.handler?.order || 0) - (b.handler?.order || 0));
	for (const rule of orderedRules) {
		if (rule.options === false || !rule.handler) continue;
		middleware.push(rule.handler(rule));
	}
	return {
		routeRules,
		routeRuleMiddleware: middleware
	};
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/hooks.mjs
function _captureError(error, type) {
	console.error(`[${type}]`, error);
	useNitroApp().captureError?.(error, { tags: [type] });
}
function trapUnhandledErrors() {
	process.on("unhandledRejection", (error) => _captureError(error, "unhandledRejection"));
	process.on("uncaughtException", (error) => _captureError(error, "uncaughtException"));
}
//#endregion
//#region #nitro/virtual/tracing
var tracingSrvxPlugins = [];
//#endregion
//#region node_modules/nitro/dist/presets/node/runtime/node-server.mjs
var _parsedPort = Number.parseInt(process.env.NITRO_PORT ?? process.env.PORT ?? "");
var port = Number.isNaN(_parsedPort) ? 3e3 : _parsedPort;
var host = process.env.NITRO_HOST || process.env.HOST;
var cert = process.env.NITRO_SSL_CERT;
var key = process.env.NITRO_SSL_KEY;
var nitroApp = useNitroApp();
serve({
	port,
	hostname: host,
	tls: cert && key ? {
		cert,
		key
	} : void 0,
	fetch: nitroApp.fetch,
	plugins: [...tracingSrvxPlugins]
});
trapUnhandledErrors();
var node_server_default = {};
//#endregion
export { node_server_default as default };
