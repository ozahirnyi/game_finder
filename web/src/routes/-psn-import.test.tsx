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
import { describe, expect, it, vi } from "vitest";

const { previewPsnImport, confirmPsnImport } = vi.hoisted(() => ({
  previewPsnImport: vi.fn(),
  confirmPsnImport: vi.fn(),
}));

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/api", () => ({ previewPsnImport, confirmPsnImport }));

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

  it("confirms selected catalog ids instead of source titles", async () => {
    previewPsnImport.mockResolvedValueOnce({
      items: [
        { source_title: "GOD OF WAR", status: "confirmed", igdb_id: 101, title: "God of War" },
        { source_title: "EA Play", status: "review", igdb_id: null, title: null },
      ],
      games: ["GOD OF WAR", "EA Play"],
      total: 2,
      confirmed_total: 1,
    });
    confirmPsnImport.mockResolvedValueOnce({ created: 1, updated: 0, skipped: 0, total: 1 });
    const root = createRootRoute({ component: Outlet });
    const route = createRoute({ getParentRoute: () => root, path: "/", component: Route.options.component });
    const router = createRouter({ routeTree: root.addChildren([route]), history: createMemoryHistory({ initialEntries: ["/"] }) });
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>,
    );

    await screen.findByText(/choose an export file/i);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["x"], "export.xlsx")] } });
    await screen.findByText("God of War");
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /import 1 game/i }));

    await waitFor(() => expect(confirmPsnImport.mock.calls[0]?.[0]).toEqual([101]));
  });
});
