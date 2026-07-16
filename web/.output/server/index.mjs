globalThis.__nitro_main__ = import.meta.url;
import { a as FastResponse, n as HTTPError, r as defineLazyEventHandler, t as H3Core } from "./_libs/h3+rou3+srvx.mjs";
import { t as HookableCore } from "./_libs/hookable.mjs";
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
//#region #nitro/virtual/public-assets-data
var public_assets_data_default = {
	"/file.svg": {
		"type": "image/svg+xml",
		"etag": "\"187-+zgO7/6H1QtZc4NmTAKYKWTQ0ow\"",
		"mtime": "2026-07-16T17:32:22.040Z",
		"size": 391,
		"path": "../public/file.svg"
	},
	"/next.svg": {
		"type": "image/svg+xml",
		"etag": "\"55f-Pz6VYiYSuYnFvWoDKZowjG88fms\"",
		"mtime": "2026-07-16T17:32:22.041Z",
		"size": 1375,
		"path": "../public/next.svg"
	},
	"/globe.svg": {
		"type": "image/svg+xml",
		"etag": "\"40b-LrojsBpGczu4Qj5tOOv19+lavsU\"",
		"mtime": "2026-07-16T17:32:22.041Z",
		"size": 1035,
		"path": "../public/globe.svg"
	},
	"/window.svg": {
		"type": "image/svg+xml",
		"etag": "\"181-VMSODapsqjF/4bTEGQB/2T6Ujbk\"",
		"mtime": "2026-07-16T17:32:22.042Z",
		"size": 385,
		"path": "../public/window.svg"
	},
	"/vercel.svg": {
		"type": "image/svg+xml",
		"etag": "\"80-zruIUtWMiIa+PpBRomlX9Cu4Lxo\"",
		"mtime": "2026-07-16T17:32:22.042Z",
		"size": 128,
		"path": "../public/vercel.svg"
	},
	"/assets/AppShell-CJZYpPzc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2b21-kkqffUaNlD3ctIHvQHX6VOW4XT4\"",
		"mtime": "2026-07-16T17:41:24.898Z",
		"size": 11041,
		"path": "../public/assets/AppShell-CJZYpPzc.js"
	},
	"/assets/check-6g3s2cNl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"74-VugasBnk4V3oR6nZ4rzbCIRBJtg\"",
		"mtime": "2026-07-16T17:41:24.899Z",
		"size": 116,
		"path": "../public/assets/check-6g3s2cNl.js"
	},
	"/assets/deals-DSU8YBEj.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"d5a-x7R+t1lPmUY/0tyfvUVVbvLjUAM\"",
		"mtime": "2026-07-16T17:41:24.899Z",
		"size": 3418,
		"path": "../public/assets/deals-DSU8YBEj.js"
	},
	"/assets/friends-MQE_4hxX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a8e-FW8zG2sBupEmWiTuj/Nh4O5XR0I\"",
		"mtime": "2026-07-16T17:41:24.900Z",
		"size": 6798,
		"path": "../public/assets/friends-MQE_4hxX.js"
	},
	"/assets/games._gameId-TuSPkzMl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2c9-uazaCMZc3IepTTsxTaPxaCqjNs0\"",
		"mtime": "2026-07-16T17:41:24.901Z",
		"size": 713,
		"path": "../public/assets/games._gameId-TuSPkzMl.js"
	},
	"/assets/games._gameId-DiyjNaNQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"24b2-cx4gr0EV5HLvzgHDJpGj5YDKP18\"",
		"mtime": "2026-07-16T17:41:24.900Z",
		"size": 9394,
		"path": "../public/assets/games._gameId-DiyjNaNQ.js"
	},
	"/assets/plus-UplZ9BVf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"91-CpVyIZIB+Pjw8K5aUZYMNS5HFPI\"",
		"mtime": "2026-07-16T17:41:24.902Z",
		"size": 145,
		"path": "../public/assets/plus-UplZ9BVf.js"
	},
	"/assets/library-CuExuiTC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a01-0sy47BCsF4aED/vfQVRI/iH2yrs\"",
		"mtime": "2026-07-16T17:41:24.901Z",
		"size": 2561,
		"path": "../public/assets/library-CuExuiTC.js"
	},
	"/assets/profile-DK5zA4bK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"179f-+1dQE40c3Q5p9Fk0a2NBHufvY+U\"",
		"mtime": "2026-07-16T17:41:24.902Z",
		"size": 6047,
		"path": "../public/assets/profile-DK5zA4bK.js"
	},
	"/assets/psn-BGgjthWq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"145b-DV1/JTQMDUgu8/L9uzyYR8Tn/2g\"",
		"mtime": "2026-07-16T17:41:24.903Z",
		"size": 5211,
		"path": "../public/assets/psn-BGgjthWq.js"
	},
	"/assets/index-CVyjcO_q.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"56c5d-wYHRASRFRp04+/0/8vkCn6Wrofc\"",
		"mtime": "2026-07-16T17:41:24.898Z",
		"size": 355421,
		"path": "../public/assets/index-CVyjcO_q.js"
	},
	"/assets/search-BDMJ5AGB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1249-9ldcVty7w7P9+BFJ4NwOcdalM8o\"",
		"mtime": "2026-07-16T17:41:24.904Z",
		"size": 4681,
		"path": "../public/assets/search-BDMJ5AGB.js"
	},
	"/assets/shield-rTczAJ43.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2a3-DzJP4Vmn/R0YnYzUs+vDn+16WhA\"",
		"mtime": "2026-07-16T17:41:24.904Z",
		"size": 675,
		"path": "../public/assets/shield-rTczAJ43.js"
	},
	"/assets/routes-CKvNcdeJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2844-Qm5lVieED1n1ni6lxyjZKU9ZShw\"",
		"mtime": "2026-07-16T17:41:24.903Z",
		"size": 10308,
		"path": "../public/assets/routes-CKvNcdeJ.js"
	},
	"/assets/sparkles-BIY9dL9u.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1e6-Vt4l6/yeuurDzY7JqFppYxO0fUA\"",
		"mtime": "2026-07-16T17:41:24.905Z",
		"size": 486,
		"path": "../public/assets/sparkles-BIY9dL9u.js"
	},
	"/assets/steam-Dr6oEP5t.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f0f-LrpCtPzsHVaBuQI2MhW/62GFjrI\"",
		"mtime": "2026-07-16T17:41:24.905Z",
		"size": 3855,
		"path": "../public/assets/steam-Dr6oEP5t.js"
	},
	"/assets/styles-CeWaM3PH.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"158b2-K6E2I3Vlc7a8TsNLLgpxGbSrGNA\"",
		"mtime": "2026-07-16T17:41:24.906Z",
		"size": 88242,
		"path": "../public/assets/styles-CeWaM3PH.css"
	},
	"/assets/ui-bits-BUKaDaCJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"39e-QP+NQPy+HfWJ0YH/oJ8DiQmKhY4\"",
		"mtime": "2026-07-16T17:41:24.906Z",
		"size": 926,
		"path": "../public/assets/ui-bits-BUKaDaCJ.js"
	},
	"/assets/wishlist-N0hQlRO9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a0f-FQwb02qVAhqpkbfw4aXvCU1sDS4\"",
		"mtime": "2026-07-16T17:41:24.906Z",
		"size": 2575,
		"path": "../public/assets/wishlist-N0hQlRO9.js"
	}
};
//#endregion
//#region #nitro/virtual/public-assets
var publicAssetBases = {};
function isPublicAssetURL(id = "") {
	if (public_assets_data_default[id]) return true;
	for (const base in publicAssetBases) if (id.startsWith(base)) return true;
	return false;
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/route-rules.mjs
var headers = ((m) => function headersRouteRule(event) {
	for (const [key, value] of Object.entries(m.options || {})) event.res.headers.set(key, value);
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
var _lazy_QvisjC = defineLazyEventHandler(() => import("./_chunks/ssr-renderer.mjs"));
var findRoute = /* @__PURE__ */ (() => {
	const data = {
		route: "/**",
		handler: _lazy_QvisjC
	};
	return ((_m, p) => {
		return {
			data,
			params: { "_": p.slice(1) }
		};
	});
})();
[].filter(Boolean);
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/prod.mjs
var errorHandler = (error, event) => {
	const res = defaultHandler(error, event);
	return new FastResponse(typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2), res);
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
	h3App["~getMiddleware"] = (event, route) => {
		const pathname = event.url.pathname;
		const method = event.req.method;
		const middleware = [];
		const routeRules = getRouteRules(method, pathname);
		event.context.routeRules = routeRules?.routeRules;
		if (routeRules?.routeRuleMiddleware.length) middleware.push(...routeRules.routeRuleMiddleware);
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
function useNitroHooks() {
	const nitroApp = useNitroApp();
	const hooks = nitroApp.hooks;
	if (hooks) return hooks;
	return nitroApp.hooks = new HookableCore();
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
//#region node_modules/nitro/dist/presets/cloudflare/runtime/_module-handler.mjs
function createHandler(hooks) {
	const nitroApp = useNitroApp();
	const nitroHooks = useNitroHooks();
	return {
		async fetch(request, env, context) {
			globalThis.__env__ = env;
			augmentReq(request, {
				env,
				context
			});
			const ctxExt = {};
			const url = new URL(request.url);
			if (hooks.fetch) {
				const res = await hooks.fetch(request, env, context, url, ctxExt);
				if (res) return res;
			}
			return await nitroApp.fetch(request);
		},
		scheduled(controller, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:scheduled", {
				controller,
				env,
				context
			}) || Promise.resolve());
		},
		email(message, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:email", {
				message,
				event: message,
				env,
				context
			}) || Promise.resolve());
		},
		queue(batch, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:queue", {
				batch,
				event: batch,
				env,
				context
			}) || Promise.resolve());
		},
		tail(traces, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:tail", {
				traces,
				env,
				context
			}) || Promise.resolve());
		},
		trace(traces, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:trace", {
				traces,
				env,
				context
			}) || Promise.resolve());
		}
	};
}
function augmentReq(cfReq, ctx) {
	const req = cfReq;
	req.ip = cfReq.headers.get("cf-connecting-ip") || void 0;
	req.runtime ??= { name: "cloudflare" };
	req.runtime.cloudflare = {
		...req.runtime.cloudflare,
		...ctx
	};
	req.waitUntil = ctx.context?.waitUntil.bind(ctx.context);
}
//#endregion
//#region node_modules/nitro/dist/presets/cloudflare/runtime/cloudflare-module.mjs
var cloudflare_module_default = createHandler({ fetch(cfRequest, env, context, url) {
	if (env.ASSETS && isPublicAssetURL(url.pathname)) return env.ASSETS.fetch(cfRequest);
} });
//#endregion
export { cloudflare_module_default as default };
