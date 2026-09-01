import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import {
  getAuthSnapshot,
  getRecommendationQuota,
  getRecommendations,
  searchGames,
} from "@/lib/api";
import { ThemeProvider } from "@/lib/theme";
import { Route as SearchRoute } from "./search";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getAuthSnapshot: vi.fn(),
    subscribeToAuthChanges: vi.fn(() => () => undefined),
    getRecommendationQuota: vi.fn(),
    getRecommendations: vi.fn(),
    searchGames: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

it("loads ordinary catalog results from the q URL parameter", async () => {
  vi.mocked(getAuthSnapshot).mockReturnValue(false);
  vi.mocked(searchGames).mockResolvedValue({
    results: [
      {
        id: 8,
        name: "Hades II",
        released: "2025-09-25",
        background_image: "cover.jpg",
        platforms: ["PC"],
      },
    ],
  });
  const history = createMemoryHistory({
    initialEntries: ["/search?q=Hades%20II"],
  });
  const rootRoute = createRootRoute({
    component: () => (
      <ThemeProvider>
        <Outlet />
      </ThemeProvider>
    ),
  });
  const searchRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/search",
    validateSearch: SearchRoute.options.validateSearch,
    component: SearchRoute.options.component,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([searchRoute]),
    history,
  });

  render(<RouterProvider router={router} />);

  expect(
    await screen.findByRole("link", { name: /Hades II/i }),
  ).toHaveAttribute("href", "/games/8");
  expect(searchGames).toHaveBeenCalledWith("Hades II");
  expect(screen.getByRole("img", { name: "Hades II cover" })).toHaveAttribute(
    "src",
    "cover.jpg",
  );
  expect(getRecommendationQuota).not.toHaveBeenCalled();
  expect(getRecommendations).not.toHaveBeenCalled();
});
