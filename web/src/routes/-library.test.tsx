import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getLibraryOverview: vi.fn() }));

vi.mock("@/lib/api", () => api);
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/GameCover", () => ({ GameCover: ({ title }: { title: string }) => <div data-testid="game-cover">{title}</div> }));

import { Route } from "./library";

function renderLibrary() {
  const root = createRootRoute({ component: Outlet });
  const route = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: Route.options.component,
  });
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.getLibraryOverview.mockResolvedValue({ games: [] });
});
afterEach(cleanup);

describe("Library", () => {
  it("shows a Library skeleton while its first request is pending", async () => {
    api.getLibraryOverview.mockImplementation(() => new Promise(() => {}));

    renderLibrary();

    expect(await screen.findByTestId("library-loading")).toBeInTheDocument();
  });

  it("renders raw PSN entries without catalog links and keeps linked entries navigable", async () => {
    api.getLibraryOverview.mockResolvedValue({
      games: [
        { id: "raw", source: "psn", title: "Unknown Game", link_state: "raw", detail_game_id: null, cover_url: null },
        { id: "linked", source: "psn", title: "Hades", link_state: "linked", detail_game_id: "101", cover_url: "https://cover" },
      ],
      raw_count: 1,
      quarantined_count: 0,
    });

    renderLibrary();

    await screen.findByRole("heading", { name: "Unknown Game" });
    expect(screen.getByText("PlayStation title — catalog details can be added later")).toBeInTheDocument();
    expect(screen.getAllByTestId("game-cover")[0]).toHaveTextContent("Unknown Game");
    expect(screen.getByRole("heading", { name: "Unknown Game" }).closest("a")).toBeNull();
    expect(screen.getByRole("heading", { name: "Hades" }).closest("a")).toHaveAttribute("href", expect.stringContaining("/games/101"));
  });
});
