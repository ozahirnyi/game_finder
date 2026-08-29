// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { previewPsnLibraryRepair, deletePsnLibrary } = vi.hoisted(() => ({ previewPsnLibraryRepair: vi.fn(), deletePsnLibrary: vi.fn() }));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/api", () => ({ previewPsnLibraryRepair, deletePsnLibrary, applyPsnLibraryRepair: vi.fn() }));
import { Route } from "./psn-library-repair";

function renderPage() { const root=createRootRoute({component:Outlet}); const route=createRoute({getParentRoute:()=>root,path:"/",component:Route.options.component}); const router=createRouter({routeTree:root.addChildren([route]),history:createMemoryHistory({initialEntries:["/"]})}); return render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router}/></QueryClientProvider>); }
afterEach(() => vi.clearAllMocks());

describe("PsnLibraryRepairPage", () => {
  it("shows deletion success after the confirmed request", async () => {
    previewPsnLibraryRepair.mockResolvedValue({ items: [], raw_count: 2, quarantined_count: 0 });
    deletePsnLibrary.mockResolvedValue({ deleted: 2 });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Delete all PlayStation games" }));
    await waitFor(() => expect(screen.getByText("Deleted 2 PlayStation games.")).toBeInTheDocument());
  });
});
