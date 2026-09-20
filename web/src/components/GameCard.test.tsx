import { render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { gameDetailSearch } from "@/lib/gameCardPresentation";
import { GameCard } from "./GameCard";

describe("GameCard", () => {
  it("passes portrait-only catalog media to the composed hero treatment", () => {
    render(
      <GameCard
        game={{
          title: "Portrait Only",
          coverUrl: "https://images.example.test/cover.jpg",
          coverFrom: "#111111",
          coverTo: "#222222",
        }}
      />,
    );

    expect(screen.getByRole("img", { name: "Portrait Only" })).toHaveClass("object-contain");
  });

  it("links to the internal game details route instead of a store URL", async () => {
    const rootRoute = createRootRoute({ component: Outlet });
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      component: () => (
        <GameCard
          game={{
            gameId: "42",
            title: "Live game",
            coverFrom: "#111111",
            coverTo: "#222222",
            coverUrl: "https://images.example.test/live-game.jpg",
          }}
        />
      ),
    });
    const gameRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/games/$gameId",
      component: () => null,
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, gameRoute]),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole("link", { name: /live game/i })).toHaveAttribute(
      "href",
      "/games/42?title=Live+game",
    );
  });

  it("links a Steam game to the internal detail route", async () => {
    const rootRoute = createRootRoute({ component: Outlet });
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      component: () => (
        <GameCard
          game={{
            gameId: "1145360",
            source: "steam",
            title: "Hades",
            coverFrom: "#111111",
            coverTo: "#222222",
          }}
        />
      ),
    });
    const gameRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/games/$gameId",
      component: () => null,
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, gameRoute]),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole("link", { name: /hades/i })).toHaveAttribute(
      "href",
      "/games/1145360?title=Hades&source=steam",
    );
  });

  it("shows an optional description in full inside the game card", async () => {
    const rootRoute = createRootRoute({ component: Outlet });
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      component: () => (
        <GameCard
          game={{
            gameId: "42",
            title: "Return game",
            coverFrom: "#111111",
            coverTo: "#222222",
            description: "Matches your roguelike request",
          }}
        />
      ),
    });
    const gameRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/games/$gameId",
      component: () => null,
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, gameRoute]),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByText("Matches your roguelike request")).not.toHaveClass(
      "line-clamp-3",
    );
  });

  it("adds an optional return target to internal detail search parameters", () => {
    expect(
      gameDetailSearch({
        title: "Return game",
        coverFrom: "#111111",
        coverTo: "#222222",
        returnTo: "/search?mode=ai&q=roguelike",
      }),
    ).toEqual({ title: "Return game", returnTo: "/search?mode=ai&q=roguelike" });
  });

  it("opens the verified store URL when no internal catalog identity exists", async () => {
    const rootRoute = createRootRoute({ component: Outlet });
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      component: () => (
        <GameCard
          game={{
            title: "Unmatched deal",
            coverFrom: "#111111",
            coverTo: "#222222",
            externalUrl: "https://store.steampowered.com/app/123/",
          }}
        />
      ),
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute]),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole("link", { name: /unmatched deal/i })).toHaveAttribute(
      "href",
      "https://store.steampowered.com/app/123/",
    );
  });
});
