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

  it("submits catalog IDs for confirmed rows and PSN titles for opted-in review rows", async () => {
    previewPsnImport.mockResolvedValueOnce({
      items: [
        { source_title: "GOD OF WAR", status: "confirmed", igdb_id: 101, title: "God of War" },
        { source_title: "MORTAL KOMBAT X", status: "ambiguous", igdb_id: null, title: null },
        { source_title: "Unknown Game", status: "unmatched", igdb_id: null, title: null },
        { source_title: "Offline Game", status: "catalog_unavailable", igdb_id: null, title: null },
        { source_title: "EA Play", status: "excluded", igdb_id: null, title: null, reason: "Excluded: subscription/demo/DLC or currency purchase." },
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
    expect(screen.getByRole("heading", { name: "Catalog matches (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Need review (3)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Excluded purchases (1)" })).toBeInTheDocument();
    expect(screen.getByText("1 of 4 eligible purchases selected")).toBeInTheDocument();
    expect(screen.getByText("Catalog match")).toBeInTheDocument();
    expect(screen.getByText("Multiple catalog matches — import using PSN title")).toBeInTheDocument();
    expect(screen.getByText("No catalog match — import using PSN title")).toBeInTheDocument();
    expect(screen.getByText("Catalog temporarily unavailable — import using PSN title")).toBeInTheDocument();
    expect(screen.getByText("Excluded: subscription/demo/DLC or currency purchase.")).toBeInTheDocument();
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(5);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[4]).toBeDisabled();
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /import 2 games/i }));

    await waitFor(() => expect(confirmPsnImport.mock.calls[0]?.[0]).toEqual([
      { catalog_id: 101 },
      { source_title: "MORTAL KOMBAT X" },
    ]));
  });
});
