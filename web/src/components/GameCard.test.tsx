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

import { GameCard } from "./GameCard";

describe("GameCard", () => {
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
      "/games/42",
    );
  });
});
