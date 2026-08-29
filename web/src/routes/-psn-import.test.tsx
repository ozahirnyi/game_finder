// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const { previewPsnImport, confirmPsnImport } = vi.hoisted(() => ({ previewPsnImport: vi.fn(), confirmPsnImport: vi.fn() }));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/api", () => ({ previewPsnImport, confirmPsnImport }));
import { Route } from "./psn-import";
function renderPage() { const root=createRootRoute({component:Outlet}); const route=createRoute({getParentRoute:()=>root,path:"/",component:Route.options.component}); const router=createRouter({routeTree:root.addChildren([route]),history:createMemoryHistory({initialEntries:["/"]})}); return render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router}/></QueryClientProvider>); }
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("PsnImportPage", () => {
  it("keeps the original preview-to-confirm wizard for signed decisions", async () => {
    previewPsnImport.mockResolvedValueOnce({ items:[{source_title:"Hades",status:"matched",igdb_id:1,title:"Hades",candidate_token:"a",suggestions:[]}],games:[],total:1,confirmed_total:1 });
    const {container}=renderPage(); await screen.findByText("Choose an export file");
    fireEvent.change(container.querySelector('input[type="file"]')!, {target:{files:[new File(["x"],"export.xlsx")]}});
    await screen.findByText("Catalog matches (1)");
    fireEvent.click(screen.getByRole("button", {name:/continue/i}));
    expect(screen.getByText("Confirm import")).toBeInTheDocument();
  });

  it("groups matches, mapping, and reversible suggested skips into signed decisions", async () => {
    previewPsnImport.mockResolvedValueOnce({ items:[{source_title:"Hades",status:"matched",igdb_id:1,title:"Hades",candidate_token:"a",suggestions:[]},{source_title:"Unknown",status:"needs_mapping",candidate_token:"b",suggestions:[]},{source_title:"Spotify",status:"suggested_skip",candidate_token:"c",suggestions:[],reason:"known app"}],games:[],total:3,confirmed_total:1 });
    confirmPsnImport.mockResolvedValueOnce({created:2,updated:0,skipped:0,total:2}); const {container}=renderPage(); await screen.findByText("Choose an export file");
    fireEvent.change(container.querySelector('input[type="file"]')!, {target:{files:[new File(["x"],"export.xlsx")]}});
    await waitFor(() => expect(screen.getByText("Catalog matches (1)")).toBeInTheDocument()); expect(screen.getByText("Need mapping (1)")).toBeInTheDocument(); expect(screen.getByText("Suggested skip (1)")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Import as PSN title")); fireEvent.click(screen.getByRole("button", {name:/continue/i})); vi.spyOn(window, "confirm").mockReturnValue(true); fireEvent.click(screen.getByRole("button", {name:"Import 2 games"}));
    await waitFor(() => expect(confirmPsnImport.mock.calls[0]?.[0]).toEqual([{candidate_token:"a",action:"catalog",catalog_id:1},{candidate_token:"b",action:"raw"}]));
  });

  it("selects only matched catalog games and leaves mapping rows unselected", async () => {
    previewPsnImport.mockResolvedValueOnce({ items:[{source_title:"Hades",status:"matched",igdb_id:1,title:"Hades",candidate_token:"a",suggestions:[]},{source_title:"Unknown",status:"needs_mapping",candidate_token:"b",suggestions:[]},{source_title:"Spotify",status:"suggested_skip",candidate_token:"c",suggestions:[],reason:"known app"}],games:[],total:3,confirmed_total:1 });
    const {container}=renderPage(); await screen.findByText("Choose an export file");
    fireEvent.change(container.querySelector('input[type="file"]')!, {target:{files:[new File(["x"],"export.xlsx")]}});
    await screen.findByText("Need mapping (1)");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name:"Select all games"}));
    expect(screen.getByText("1 selected · 2 skipped")).toBeInTheDocument();
  });

  it("separates unavailable titles and retries the same export without selecting RAW", async () => {
    previewPsnImport.mockResolvedValueOnce({ items:[{source_title:"Hades",status:"matched",igdb_id:1,title:"Hades",candidate_token:"a",suggestions:[]},{source_title:"Celeste",status:"catalog_unavailable",candidate_token:"b",suggestions:[],reason:"Catalog temporarily unavailable."}],games:[],total:2,confirmed_total:1 });
    previewPsnImport.mockResolvedValueOnce({ items:[{source_title:"Hades",status:"matched",igdb_id:1,title:"Hades",candidate_token:"a2",suggestions:[]},{source_title:"Celeste",status:"matched",igdb_id:2,title:"Celeste",candidate_token:"b2",suggestions:[]}],games:[],total:2,confirmed_total:2 });
    const {container}=renderPage(); await screen.findByText("Choose an export file");
    fireEvent.change(container.querySelector('input[type="file"]')!, {target:{files:[new File(["x"],"export.xlsx")]} });
    await screen.findByText("Catalog unavailable (1)");
    expect(screen.getByText("1 selected · 1 skipped")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name:"Retry unavailable titles"}));
    await screen.findByText("Catalog matches (2)");
    expect(previewPsnImport).toHaveBeenCalledTimes(2);
  });

  it("returns from confirmation to preview when Escape is pressed", async () => {
    previewPsnImport.mockResolvedValueOnce({ items:[{source_title:"Hades",status:"matched",igdb_id:1,title:"Hades",candidate_token:"a",suggestions:[]}],games:[],total:1,confirmed_total:1 });
    const {container}=renderPage(); await screen.findByText("Choose an export file");
    fireEvent.change(container.querySelector('input[type="file"]')!, {target:{files:[new File(["x"],"export.xlsx")]}});
    await screen.findByText("Catalog matches (1)");
    fireEvent.click(screen.getByRole("button", {name:/continue/i}));
    fireEvent.keyDown(document, {key:"Escape"});
    expect(screen.getByText("Preview games")).toBeInTheDocument();
  });

  it("returns to a fresh upload step when Escape is pressed from preview", async () => {
    previewPsnImport.mockResolvedValueOnce({ items:[{source_title:"Hades",status:"matched",igdb_id:1,title:"Hades",candidate_token:"a",suggestions:[]}],games:[],total:1,confirmed_total:1 });
    const {container}=renderPage(); await screen.findByText("Choose an export file");
    fireEvent.change(container.querySelector('input[type="file"]')!, {target:{files:[new File(["x"],"export.xlsx")]}});
    await screen.findByText("Catalog matches (1)");
    fireEvent.keyDown(document, {key:"Escape"});
    expect(screen.getByText("Choose an export file")).toBeInTheDocument();
  });
});
