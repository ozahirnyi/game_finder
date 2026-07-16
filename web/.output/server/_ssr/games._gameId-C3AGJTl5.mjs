import { s as games } from "./mockData-Dh60Pm9c.mjs";
import { j as notFound, m as createFileRoute, p as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/games._gameId-C3AGJTl5.js
var $$splitNotFoundComponentImporter = () => import("./games._gameId-B5JkODyg.mjs");
var $$splitComponentImporter = () => import("./games._gameId-7NkH_EsA.mjs");
var Route = createFileRoute("/games/$gameId")({
	loader: ({ params }) => {
		const game = games.find((g) => g.id === params.gameId);
		if (!game) throw notFound();
		return { game };
	},
	head: ({ loaderData }) => ({ meta: loaderData ? [{ title: `${loaderData.game.title} — GameFinder` }, {
		name: "description",
		content: `${loaderData.game.title} · ${loaderData.game.genres.join(", ")} · ${loaderData.game.platforms.join(", ")}. Shared with your friends on GameFinder.`
	}] : [{ title: "Game not found — GameFinder" }, {
		name: "robots",
		content: "noindex"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter, "component"),
	notFoundComponent: lazyRouteComponent($$splitNotFoundComponentImporter, "notFoundComponent")
});
//#endregion
export { Route as t };
