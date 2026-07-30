// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getWishlist: vi.fn(),
  removeWishlist: vi.fn(),
}));

vi.mock("@/lib/api", () => api);
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/GameCover", () => ({
  GameCover: () => <div />,
}));

import { Route } from "./wishlist";

const wishlistRecordId = "e03f6ee6-97d8-4dbb-aaee-eecd9c5b1b22";

describe("WishlistPage", () => {
  beforeEach(() => {
    api.getWishlist.mockResolvedValue([
      {
        id: wishlistRecordId,
        catalog_game_id: 274755,
        title: "Hades II",
        cover_url: null,
      },
    ]);
    api.removeWishlist.mockResolvedValue(undefined);
  });

  it("navigates with the catalog ID and removes with the wishlist record UUID", async () => {
    const rootRoute = createRootRoute({ component: Outlet });
    const wishlistRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      component: Route.options.component,
    });
    const gameRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/games/$gameId",
      component: () => null,
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([wishlistRoute, gameRoute]),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("link", { name: "View game" })).toHaveAttribute(
      "href",
      "/games/274755",
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove Hades II from wishlist" }));

    await waitFor(() => expect(api.removeWishlist.mock.calls[0]?.[0]).toBe(wishlistRecordId));
  });
});
