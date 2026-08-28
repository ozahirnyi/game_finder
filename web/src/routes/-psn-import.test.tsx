// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const { previewPsnImport, confirmPsnImport, searchGames } = vi.hoisted(() => ({ previewPsnImport: vi.fn(), confirmPsnImport: vi.fn(), searchGames: vi.fn() }));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/api", () => ({ previewPsnImport, confirmPsnImport, searchGames }));
import { Route } from "./psn-import";
function renderPage() { const root=createRootRoute({component:Outlet}); const route=createRoute({getParentRoute:()=>root,path:"/",component:Route.options.component}); const router=createRouter({routeTree:root.addChildren([route]),history:createMemoryHistory({initialEntries:["/"]})}); return render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router}/></QueryClientProvider>); }
describe("PsnImportPage", () => {
  it("groups matches, mapping, and reversible suggested skips into signed decisions", async () => {
    previewPsnImport.mockResolvedValueOnce({ items:[{source_title:"Hades",status:"matched",igdb_id:1,title:"Hades",candidate_token:"a",suggestions:[]},{source_title:"Unknown",status:"needs_mapping",candidate_token:"b",suggestions:[]},{source_title:"Spotify",status:"suggested_skip",candidate_token:"c",suggestions:[],reason:"known app"}],games:[],total:3,confirmed_total:1 });
    confirmPsnImport.mockResolvedValueOnce({created:2,updated:0,skipped:0,total:2}); const {container}=renderPage(); await screen.findByText("Choose an export file");
    fireEvent.change(container.querySelector('input[type="file"]')!, {target:{files:[new File(["x"],"export.xlsx")]}});
    await waitFor(() => expect(screen.getByText("Catalog matches (1)")).toBeInTheDocument()); expect(screen.getByText("Need mapping (1)")).toBeInTheDocument(); expect(screen.getByText("Suggested skip (1)")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Import as PSN title")); vi.spyOn(window, "confirm").mockReturnValue(true); fireEvent.click(screen.getByText("Import selected"));
    await waitFor(() => expect(confirmPsnImport.mock.calls[0]?.[0]).toEqual([{candidate_token:"a",action:"catalog",catalog_id:1},{candidate_token:"b",action:"raw"}]));
  });
});
