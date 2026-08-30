// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { previewPsnImport, confirmPsnImport } = vi.hoisted(() => ({ previewPsnImport: vi.fn(), confirmPsnImport: vi.fn() }));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/api", () => ({ previewPsnImport, confirmPsnImport }));
import { Route } from "./psn-import";

const previewItems = [
  { source_title: "Hades", status: "matched", recommended_action: "catalog", igdb_id: 1, title: "Hades", candidate_token: "a", suggestions: [] },
  { source_title: "Unknown", status: "needs_mapping", recommended_action: "raw", candidate_token: "b", suggestions: [] },
  { source_title: "Celeste", status: "catalog_unavailable", recommended_action: "raw", candidate_token: "c", suggestions: [], reason: "Catalog temporarily unavailable." },
  { source_title: "Spotify", status: "suggested_skip", recommended_action: "skip", candidate_token: "d", suggestions: [], reason: "Known PlayStation app." },
] as const;

function renderPage() { const root = createRootRoute({ component: Outlet }); const route = createRoute({ getParentRoute: () => root, path: "/", component: Route.options.component }); const router = createRouter({ routeTree: root.addChildren([route]), history: createMemoryHistory({ initialEntries: ["/"] }) }); return render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>); }
async function upload(container: HTMLElement) { await screen.findByText("Choose an export file"); fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["x"], "export.xlsx")] } }); await screen.findByText("Games to import (3)"); }

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("PsnImportPage", () => {
  it("groups every plausible title as selected games and leaves suggested non-games unselected", async () => {
    previewPsnImport.mockResolvedValueOnce({ items: previewItems, games: [], total: 4, confirmed_total: 3 });
    const { container } = renderPage(); await upload(container);
    expect(screen.getByText("Suggested non-games (1)")).toBeInTheDocument();
    expect(screen.getByText("3 selected · 1 skipped")).toBeInTheDocument();
    expect((screen.getByLabelText("Select Hades") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Select Unknown") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Select Celeste") as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByText("Catalog unavailable (1)")).not.toBeInTheDocument();
    expect(screen.getByText("Catalog temporarily unavailable")).toBeInTheDocument();
  });

  it("select all games excludes unrestored non-games and restore selects Spotify as raw", async () => {
    previewPsnImport.mockResolvedValueOnce({ items: previewItems, games: [], total: 4, confirmed_total: 3 });
    const { container } = renderPage(); await upload(container);
    fireEvent.click(screen.getByLabelText("Select Unknown"));
    fireEvent.click(screen.getByRole("button", { name: "Select all games" }));
    expect(screen.getByText("3 selected · 1 skipped")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore and select" }));
    expect(screen.getByText("4 selected · 0 skipped")).toBeInTheDocument();
  });

  it("confirms catalog and raw choices without a second dialog", async () => {
    previewPsnImport.mockResolvedValueOnce({ items: previewItems, games: [], total: 4, confirmed_total: 3 });
    confirmPsnImport.mockResolvedValueOnce({ created: 3, updated: 0, skipped: 0, total: 3 });
    const confirmDialog = vi.spyOn(window, "confirm");
    const { container } = renderPage(); await upload(container);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: "Import 3 games" }));
    await waitFor(() => expect(confirmPsnImport.mock.calls[0]?.[0]).toEqual([
      { candidate_token: "a", action: "catalog", catalog_id: 1 },
      { candidate_token: "b", action: "raw" },
      { candidate_token: "c", action: "raw" },
    ]));
    expect(confirmDialog).not.toHaveBeenCalled();
  });

  it("preserves manual unchecked and restored state while retry enriches selected titles", async () => {
    previewPsnImport.mockResolvedValueOnce({ items: previewItems, games: [], total: 4, confirmed_total: 3 });
    previewPsnImport.mockResolvedValueOnce({ items: [
      previewItems[0], { ...previewItems[1], igdb_id: 2, title: "Unknown", recommended_action: "catalog", status: "matched", candidate_token: "b2" }, previewItems[2], previewItems[3],
    ], games: [], total: 4, confirmed_total: 3 });
    const { container } = renderPage(); await upload(container);
    fireEvent.click(screen.getByLabelText("Select Unknown"));
    fireEvent.click(screen.getByRole("button", { name: "Restore and select" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry catalog enrichment" }));
    await waitFor(() => expect(previewPsnImport).toHaveBeenCalledTimes(2));
    expect((screen.getByLabelText("Select Unknown") as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText("3 selected · 1 skipped")).toBeInTheDocument();
  });

  it("disables confirmation while import is in flight", async () => {
    previewPsnImport.mockResolvedValueOnce({ items: previewItems, games: [], total: 4, confirmed_total: 3 });
    let resolveImport: (value: unknown) => void = () => undefined;
    confirmPsnImport.mockImplementationOnce(() => new Promise(resolve => { resolveImport = resolve; }));
    const { container } = renderPage(); await upload(container);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: "Import 3 games" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Importing…" })).toBeDisabled());
    resolveImport({ created: 3, updated: 0, skipped: 0, total: 3 });
  });
});
