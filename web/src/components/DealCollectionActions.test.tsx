import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  ApiError: class extends Error {
    status = 409;
  },
  getAuthSnapshot: vi.fn(() => true),
  subscribeToAuthChanges: vi.fn(() => () => {}),
  getLibraryOverview: vi.fn(),
  getWishlist: vi.fn(),
  addSteamWishlist: vi.fn(),
  saveCatalogGameToWishlist: vi.fn(),
}));
vi.mock("@/lib/api", () => api);
import { DealCollectionActions } from "./DealCollectionActions";
const deal = { id: 72, steam_appid: 620, name: "Portal 2" };
function show(value = deal) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <DealCollectionActions deal={value} />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  api.getAuthSnapshot.mockReturnValue(true);
  api.getLibraryOverview.mockResolvedValue({ games: [], steam_available: true });
  api.getWishlist.mockResolvedValue([]);
  api.addSteamWishlist.mockResolvedValue({
    source: "steam",
    external_id: "620",
    catalog_game_id: 620,
  });
});
afterEach(cleanup);
describe("deal collection actions", () => {
  it("uses the verified catalog save endpoint when a deal has no Steam identity", async () => {
    api.saveCatalogGameToWishlist.mockResolvedValue({
      id: "catalog-wish",
      source: "catalog",
      catalog_game_id: 72,
    });
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <DealCollectionActions deal={{ id: 72, name: "Catalog-only offer" }} />
      </QueryClientProvider>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Add Catalog-only offer to wishlist" }),
    );
    await waitFor(() => expect(api.saveCatalogGameToWishlist).toHaveBeenCalledWith(72));
    expect(api.addSteamWishlist).not.toHaveBeenCalled();
  });
  it("shows a failed save and allows retry without claiming success", async () => {
    api.addSteamWishlist.mockRejectedValueOnce(new Error("offline"));
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Add Portal 2 to wishlist" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save this game");
    expect(screen.queryByText("In your wishlist")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add Portal 2 to wishlist" }));
    expect(await screen.findByText("In your wishlist")).toBeInTheDocument();
  });
  it("shows verified PlayStation ownership and keeps the card free of a save action", async () => {
    api.getLibraryOverview.mockResolvedValue({
      games: [{ source: "psn", catalog_game_id: 72, link_state: "linked" }],
      steam_available: true,
    });
    show();
    expect(await screen.findByText("In your library · PlayStation")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add Portal 2 to wishlist" }),
    ).not.toBeInTheDocument();
  });
  it("recognizes Steam wishlist identity without treating its numeric appid as a catalog id", async () => {
    api.getWishlist.mockResolvedValue([
      { source: "steam", external_id: "620", catalog_game_id: 620 },
    ]);
    show();
    expect(await screen.findByText("In your wishlist")).toBeInTheDocument();
  });
  it("does not confuse a Steam id with the same numeric catalog id", async () => {
    api.getWishlist.mockResolvedValue([
      { source: "steam", external_id: "72", catalog_game_id: 72 },
    ]);
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Add Portal 2 to wishlist" }));
    await waitFor(() => expect(api.addSteamWishlist).toHaveBeenCalledWith(620));
    expect(api.saveCatalogGameToWishlist).not.toHaveBeenCalled();
  });
  it("does not claim unlinked same-title records are owned", async () => {
    api.getLibraryOverview.mockResolvedValue({
      games: [{ source: "psn", title: "Portal 2", link_state: "raw" }],
      steam_available: true,
    });
    show();
    expect(
      await screen.findByRole("button", { name: "Add Portal 2 to wishlist" }),
    ).toBeInTheDocument();
  });
  it("shows a recoverable personal-state error instead of a confident save action", async () => {
    api.getLibraryOverview.mockRejectedValue(new Error("offline"));
    show();
    expect(await screen.findByRole("button", { name: "Retry library status" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add Portal 2 to wishlist" }),
    ).not.toBeInTheDocument();
  });
  it("reads personal collections once for multiple cards", async () => {
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <DealCollectionActions deal={deal} />
        <DealCollectionActions deal={{ ...deal, name: "Second offer" }} />
      </QueryClientProvider>,
    );
    await screen.findByRole("button", { name: "Add Second offer to wishlist" });
    expect(api.getLibraryOverview).toHaveBeenCalledTimes(1);
    expect(api.getWishlist).toHaveBeenCalledTimes(1);
  });
  it("does not load collections for guests", () => {
    api.getAuthSnapshot.mockReturnValue(false);
    show();
    expect(api.getLibraryOverview).not.toHaveBeenCalled();
    expect(api.getWishlist).not.toHaveBeenCalled();
  });
});
