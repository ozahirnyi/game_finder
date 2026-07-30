// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getDeals: vi.fn() }));
vi.mock("@/lib/api", () => api);
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/GameCover", () => ({ GameCover: () => <div /> }));

import { Route } from "./deals";

it("links a Steam deal without a catalog match to an in-site Steam game page", async () => {
  api.getDeals.mockResolvedValue({ results: [
    { id: null, steam_appid: 620, name: "Portal 2", current: { shop: "Steam", url: "https://store.steampowered.com/app/620", price: { amount: 1, currency: "USD" } } },
  ] });
  const root = createRootRoute({ component: Outlet });
  const route = createRoute({ getParentRoute: () => root, path: "/", component: Route.options.component });
  const router = createRouter({ routeTree: root.addChildren([route]), history: createMemoryHistory({ initialEntries: ["/"] }) });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);

  expect((await screen.findByRole("link", { name: "Open Portal 2 on Playfinder" })).getAttribute("href")).toBe("/games/620?source=steam&title=Portal+2");
  expect(screen.queryByRole("link", { name: "View on Playfinder" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open in Steam" })).toHaveAttribute("href", "https://store.steampowered.com/app/620");
  expect(screen.getByRole("link", { name: "Open in Steam" })).toHaveAttribute("target", "_blank");
});
