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
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { Route } from "./psn-import";

describe("PsnImportPage", () => {
  it("offers only a real export upload", async () => {
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

    expect(await screen.findByText(/choose an export file/i)).toBeInTheDocument();
    expect(
      screen.getByText(/not a complete PSN library sync/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/use sample export/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/preview empty state/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/preview error state/i)).not.toBeInTheDocument();
  });
});
