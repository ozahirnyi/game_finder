import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getAuthSnapshot: vi.fn(() => true),
  subscribeToAuthChanges: vi.fn(() => () => {}),
  getLibraryOverview: vi.fn(),
  getLibraryOverviewPage: vi.fn(),
  searchGames: vi.fn(),
  applyPsnLibraryRepair: vi.fn(),
  deletePsnLibrary: vi.fn(),
  findPsnCatalogTitles: vi.fn(),
  getCurrentPsnCatalogEnrichment: vi.fn(),
  previewLibraryCatalogMatches: vi.fn(),
}));

vi.mock("@/lib/api", () => api);
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/GameCover", () => ({
  GameCover: ({ title, image }: { title: string; image?: string }) => (
    <div data-testid="game-cover">{image ? <img alt={title} src={image} /> : title}</div>
  ),
}));

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
  vi.clearAllMocks();
  api.getLibraryOverview.mockResolvedValue({
    games: [],
    steam_available: false,
    steam_error: null,
    raw_count: 0,
    quarantined_count: 0,
    pending_catalog_count: 0,
  });
  api.getLibraryOverviewPage.mockImplementation(() => api.getLibraryOverview());
  api.getCurrentPsnCatalogEnrichment.mockRejectedValue(new Error("Background job not found"));
});
afterEach(cleanup);

describe("Library", () => {
  it("shows covers for individual catalog choices and keeps choices usable without images", async () => {
    api.getLibraryOverview.mockResolvedValue({
      games: [{ id: "raw", title: "Imported game", source: "psn", link_state: "raw" }],
      raw_count: 1,
    });
    api.searchGames.mockResolvedValue({
      results: [
        {
          id: 101,
          name: "Cover game",
          cover_image: "https://covers/portrait.jpg",
          background_image: "https://covers/banner.jpg",
        },
        { id: 102, name: "Legacy game", background_image: "https://covers/legacy.jpg" },
        { id: 103, name: "No image game", background_image: null },
      ],
    });
    renderLibrary();
    fireEvent.click(await screen.findByRole("button", { name: "PlayStation" }));
    fireEvent.click(await screen.findByRole("button", { name: "Find in catalog" }));
    fireEvent.click(screen.getByRole("button", { name: "Search catalog" }));

    const cover = await screen.findByRole("button", { name: "Use Cover game" });
    expect(within(cover).getByRole("img", { name: "Cover game" })).toHaveAttribute(
      "src",
      "https://covers/portrait.jpg",
    );
    const legacy = screen.getByRole("button", { name: "Use Legacy game" });
    expect(within(legacy).getByRole("img", { name: "Legacy game" })).toHaveAttribute(
      "src",
      "https://covers/legacy.jpg",
    );
    expect(screen.getByRole("button", { name: "Use No image game" })).toBeEnabled();
    expect(api.applyPsnLibraryRepair).not.toHaveBeenCalled();
  });

  it("guides users from All games to PlayStation without starting catalog matching", async () => {
    api.getLibraryOverview.mockResolvedValue({
      games: [{ id: "psn-raw", title: "Imported game", source: "psn", link_state: "raw" }],
      raw_count: 1,
    });
    renderLibrary();

    const guidance = await screen.findByRole("region", { name: "PlayStation game details" });
    expect(guidance).toHaveTextContent(/PlayStation tab.*Match PlayStation games/);
    expect(api.getCurrentPsnCatalogEnrichment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Open PlayStation library" }));

    expect(await screen.findByRole("button", { name: "Match PlayStation games" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "PlayStation game details" })).toBeNull();
    expect(api.previewLibraryCatalogMatches).not.toHaveBeenCalled();
    expect(api.applyPsnLibraryRepair).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Steam" }));
    expect(screen.queryByRole("button", { name: "Open PlayStation library" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "All games" }));
    expect(screen.getByRole("button", { name: "Open PlayStation library" })).toBeVisible();
  });

  it("keeps the PlayStation entry discoverable when the loaded page only contains Steam", async () => {
    api.getLibraryOverview.mockResolvedValue({
      games: [{ id: "psn-raw", source: "psn", link_state: "raw" }],
    });
    api.getLibraryOverviewPage.mockResolvedValue({
      games: [{ id: "steam-1", title: "Steam game", source: "steam" }],
      total: 1,
      has_more: false,
    });
    renderLibrary();

    expect(await screen.findByRole("button", { name: "Open PlayStation library" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Steam game" })).toBeVisible();
  });

  it("does not offer PlayStation matching guidance without imported PlayStation games", async () => {
    renderLibrary();
    await screen.findByText("Your library is empty");
    expect(screen.queryByRole("button", { name: "Open PlayStation library" })).toBeNull();
  });

  it("hides guidance when every PlayStation game is matched even if a manual game is raw", async () => {
    api.getLibraryOverview.mockResolvedValue({
      games: [
        {
          id: "psn-linked",
          title: "Matched game",
          source: "psn",
          link_state: "linked",
          catalog_game_id: 101,
        },
        { id: "manual-raw", title: "Manual game", source: "manual", link_state: "raw" },
      ],
    });
    renderLibrary();
    await screen.findByRole("heading", { name: "Matched game" });
    expect(screen.queryByRole("region", { name: "PlayStation game details" })).toBeNull();
  });

  it("shows PlayStation matching and repair tools only inside the PlayStation tab", async () => {
    api.getLibraryOverview.mockResolvedValue({
      games: [{ id: "psn-raw", title: "Imported game", source: "psn", link_state: "raw" }],
      raw_count: 1,
      quarantined_count: 1,
    });
    api.previewLibraryCatalogMatches.mockResolvedValue({ items: [] });
    renderLibrary();
    await screen.findByRole("heading", { name: "Imported game" });
    expect(screen.queryByRole("button", { name: /Match .*games/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Find in catalog" })).not.toBeInTheDocument();
    expect(screen.queryByText("Improve PlayStation details")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "PlayStation" }));
    fireEvent.click(await screen.findByRole("button", { name: "Match PlayStation games" }));
    fireEvent.click(screen.getByRole("button", { name: "Find catalog matches" }));
    await waitFor(() =>
      expect(api.previewLibraryCatalogMatches).toHaveBeenCalledWith(false, "psn"),
    );
    expect(screen.getByRole("button", { name: "Find in catalog" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Steam" }));
    expect(screen.queryByRole("button", { name: "Find in catalog" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Find catalog matches" })).not.toBeInTheDocument();
  });

  it("describes linked PlayStation records as file imports", async () => {
    api.getLibraryOverview.mockResolvedValue({
      games: [
        {
          id: "psn-linked",
          source: "psn",
          title: "Imported game",
          catalog_game_id: 101,
          detail_game_id: "101",
          link_state: "linked",
        },
      ],
      steam_available: false,
      raw_count: 0,
    });
    renderLibrary();
    expect(await screen.findByText("Imported from your PlayStation export")).toBeInTheDocument();
    expect(screen.queryByText("Synced from your connected library")).not.toBeInTheDocument();
  });
  it("shows a Library skeleton while its first request is pending", async () => {
    api.getLibraryOverview.mockImplementation(() => new Promise(() => {}));

    renderLibrary();

    expect(await screen.findByTestId("library-loading")).toBeInTheDocument();
  });

  it("shows aggregate counts rather than the first loaded page", async () => {
    api.getLibraryOverview.mockResolvedValue({
      games: [
        { id: "steam-1", source: "steam", title: "Steam One" },
        { id: "steam-2", source: "steam", title: "Steam Two" },
        { id: "psn-1", source: "psn", title: "PSN One" },
      ],
      steam_available: true,
      raw_count: 0,
      quarantined_count: 0,
      pending_catalog_count: 0,
    });
    api.getLibraryOverviewPage.mockResolvedValue({
      games: [{ id: "steam-1", source: "steam", title: "Steam One" }],
      total: 3,
      has_more: false,
      steam_available: true,
      raw_count: 0,
      quarantined_count: 0,
      pending_catalog_count: 0,
    });

    renderLibrary();

    await waitFor(() => {
      expect(screen.getByText("Games").parentElement).toHaveTextContent("3");
      expect(screen.getAllByText("Steam")[0].parentElement).toHaveTextContent("2");
      expect(screen.getAllByText("PlayStation")[0].parentElement).toHaveTextContent("1");
    });
  });

  it("keeps PSN deletion behind library management only on the PlayStation tab", async () => {
    api.deletePsnLibrary.mockResolvedValue({ deleted: 2 });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderLibrary();

    await screen.findByText("Library");
    expect(screen.queryByRole("button", { name: "Manage" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete all PlayStation games" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "PlayStation" }));
    const management = await screen.findByRole("button", { name: "Manage" });
    expect(screen.queryByRole("menuitem", { name: "Delete all PlayStation games" })).toBeNull();
    expect(api.deletePsnLibrary).not.toHaveBeenCalled();
    fireEvent.keyDown(management, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete all PlayStation games" }));

    await waitFor(() => expect(api.deletePsnLibrary).toHaveBeenCalledOnce());
    expect(window.confirm).toHaveBeenCalledWith(
      "Delete every PlayStation entry from your library? This cannot be undone.",
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Deleted 2 PlayStation games.");
    fireEvent.click(screen.getByRole("button", { name: "Steam" }));
    expect(screen.queryByRole("button", { name: "Manage" })).toBeNull();
  });

  it("keeps the library when deletion confirmation is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderLibrary();
    fireEvent.click(await screen.findByRole("button", { name: "PlayStation" }));
    fireEvent.keyDown(await screen.findByRole("button", { name: "Manage" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete all PlayStation games" }));
    expect(window.confirm).toHaveBeenCalled();
    expect(api.deletePsnLibrary).not.toHaveBeenCalled();
  });

  it("shows deletion errors after the management menu closes", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.deletePsnLibrary.mockRejectedValue(new Error("Service unavailable"));
    renderLibrary();
    fireEvent.click(await screen.findByRole("button", { name: "PlayStation" }));
    fireEvent.keyDown(await screen.findByRole("button", { name: "Manage" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete all PlayStation games" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Could not delete PlayStation games: Service unavailable",
    );
    expect(screen.queryByRole("menuitem", { name: "Delete all PlayStation games" })).toBeNull();
    expect(screen.getByRole("button", { name: "Manage" })).toBeEnabled();
  });

  it("renders raw PSN entries without catalog links and keeps linked entries navigable", async () => {
    api.getLibraryOverview.mockResolvedValue({
      games: [
        {
          id: "raw",
          source: "psn",
          title: "Unknown Game",
          link_state: "raw",
          detail_game_id: null,
          cover_url: null,
        },
        {
          id: "linked",
          source: "psn",
          title: "Hades",
          link_state: "linked",
          detail_game_id: "101",
          cover_url: "https://cover",
        },
      ],
      raw_count: 1,
      quarantined_count: 0,
      pending_catalog_count: 0,
    });

    renderLibrary();

    await screen.findByRole("heading", { name: "Unknown Game" });
    expect(
      screen.getByText("PlayStation title — catalog details can be added later"),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("game-cover")[0]).toHaveTextContent("Unknown Game");
    expect(screen.getByRole("heading", { name: "Unknown Game" }).closest("a")).toBeNull();
    expect(screen.getByRole("heading", { name: "Hades" }).closest("a")).toHaveAttribute(
      "href",
      expect.stringContaining("/games/101"),
    );
  });

  it("leaves pending PSN catalog rows to the durable worker", async () => {
    api.getLibraryOverview.mockResolvedValue({
      games: [],
      steam_available: false,
      steam_error: null,
      raw_count: 3,
      quarantined_count: 0,
      pending_catalog_count: 3,
    });
    renderLibrary();
    fireEvent.click(await screen.findByRole("button", { name: "PlayStation" }));
    expect(await screen.findByText(/Find catalog matches to add covers/)).toBeInTheDocument();
  });

  it("does not expose a browser retry when catalog matching is pending", async () => {
    api.getLibraryOverview.mockResolvedValue({
      games: [],
      steam_available: false,
      steam_error: null,
      raw_count: 1,
      quarantined_count: 0,
      pending_catalog_count: 1,
    });
    renderLibrary();
    fireEvent.click(await screen.findByRole("button", { name: "PlayStation" }));
    expect(await screen.findByText(/Find catalog matches to add covers/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Retry catalog matching" }),
    ).not.toBeInTheDocument();
  });

  it("polls and displays durable PlayStation catalog progress", async () => {
    api.getLibraryOverview.mockResolvedValue({
      games: [],
      steam_available: false,
      steam_error: null,
      raw_count: 10,
      quarantined_count: 0,
      pending_catalog_count: 6,
    });
    api.getCurrentPsnCatalogEnrichment.mockResolvedValue({
      id: "job",
      status: "running",
      result: { total: 10, attempted: 3, linked: 2, review: 1, quarantined: 0, remaining: 6 },
    });

    renderLibrary();
    fireEvent.click(await screen.findByRole("button", { name: "PlayStation" }));

    expect(await screen.findByText(/Checking 3 of 10 PlayStation titles/)).toBeInTheDocument();
    expect(screen.getByText(/2 linked, 1 for review, 6 remaining/)).toBeInTheDocument();
  });

  it("shows zero completed titles before the first durable catalog batch", async () => {
    api.getLibraryOverview.mockResolvedValue({
      games: [],
      steam_available: false,
      steam_error: null,
      raw_count: 10,
      quarantined_count: 0,
      pending_catalog_count: 10,
    });
    api.getCurrentPsnCatalogEnrichment.mockResolvedValue({
      id: "job",
      status: "queued",
      result: { total: 10, attempted: 0, linked: 0, review: 0, quarantined: 0, remaining: 10 },
    });

    renderLibrary();
    fireEvent.click(await screen.findByRole("button", { name: "PlayStation" }));

    expect(await screen.findByText(/Checking 0 of 10 PlayStation titles/)).toBeInTheDocument();
  });

  it("chooses a catalog game inline for a raw PSN entry", async () => {
    api.getLibraryOverview.mockResolvedValue({
      games: [
        {
          id: "raw",
          source: "psn",
          title: "STAR WARS Battlefront",
          link_state: "raw",
          catalog_lookup_state: "review",
          detail_game_id: null,
          catalog_game_id: null,
          external_id: "psn:manual:battlefront",
          cover_url: null,
          playtime_forever: null,
        },
      ],
      steam_available: false,
      steam_error: null,
      raw_count: 1,
      quarantined_count: 0,
      pending_catalog_count: 0,
    });
    api.searchGames.mockResolvedValue({
      results: [
        {
          id: 777,
          name: "Star Wars Battlefront",
          released: "2015-11-17",
          background_image: "https://covers/battlefront.jpg",
          description_raw: null,
          rating: 75,
          genres: ["Shooter"],
          platforms: ["PlayStation 4"],
        },
      ],
    });
    api.applyPsnLibraryRepair.mockImplementation(async () => {
      api.getLibraryOverview.mockResolvedValue({
        games: [
          {
            id: "raw",
            title: "STAR WARS Battlefront",
            source: "psn",
            link_state: "linked",
            catalog_game_id: 777,
          },
        ],
        raw_count: 0,
      });
      return { updated: 1 };
    });

    renderLibrary();
    fireEvent.click(await screen.findByRole("button", { name: "PlayStation" }));

    fireEvent.click(await screen.findByRole("button", { name: "Find in catalog" }));
    fireEvent.change(screen.getByLabelText("Catalog search for STAR WARS Battlefront"), {
      target: { value: "Star Wars Battlefront 2015" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search catalog" }));
    fireEvent.click(await screen.findByRole("button", { name: "Use Star Wars Battlefront" }));

    await waitFor(() =>
      expect(api.applyPsnLibraryRepair).toHaveBeenCalledWith([
        { game_id: "raw", action: "link", catalog_id: 777 },
      ]),
    );
    expect(api.searchGames).toHaveBeenCalledWith({ query: "Star Wars Battlefront 2015" });
    fireEvent.click(screen.getByRole("button", { name: "All games" }));
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "PlayStation game details" })).toBeNull(),
    );
  });

  it("starts manual catalog search from the cleaned backend query", async () => {
    api.getLibraryOverview.mockResolvedValue({
      games: [
        {
          id: "raw",
          source: "psn",
          title: "EA SPORTS™ FIFA 16",
          link_state: "raw",
          catalog_lookup_state: "review",
          catalog_search_query: "FIFA 16",
          detail_game_id: null,
          catalog_game_id: null,
          external_id: "psn:manual:fifa",
          cover_url: null,
        },
      ],
      steam_available: false,
      steam_error: null,
      raw_count: 1,
      quarantined_count: 0,
      pending_catalog_count: 0,
    });

    renderLibrary();
    fireEvent.click(await screen.findByRole("button", { name: "PlayStation" }));

    fireEvent.click(await screen.findByRole("button", { name: "Find in catalog" }));
    expect(screen.getByLabelText("Catalog search for EA SPORTS™ FIFA 16")).toHaveValue("FIFA 16");
  });

  it("uses a catalog-backed title and immediately searches it", async () => {
    api.getLibraryOverview.mockResolvedValue({
      games: [
        {
          id: "raw",
          source: "psn",
          title: "Ведьмак 3",
          link_state: "raw",
          catalog_search_query: "Ведьмак 3",
        },
      ],
      raw_count: 1,
      quarantined_count: 0,
      pending_catalog_count: 0,
    });
    api.findPsnCatalogTitles.mockResolvedValue({ suggestions: ["The Witcher 3: Wild Hunt"] });
    api.searchGames.mockResolvedValue({ results: [] });

    renderLibrary();
    fireEvent.click(await screen.findByRole("button", { name: "PlayStation" }));
    fireEvent.click(await screen.findByRole("button", { name: "Find in catalog" }));
    fireEvent.click(screen.getByRole("button", { name: "Find catalog title" }));

    expect(
      await screen.findByRole("button", { name: "Use The Witcher 3: Wild Hunt" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use The Witcher 3: Wild Hunt" }));
    await waitFor(() =>
      expect(api.searchGames).toHaveBeenCalledWith({ query: "The Witcher 3: Wild Hunt" }),
    );
  });

  it("does not reprocess a stale review row in the browser", async () => {
    api.getLibraryOverview.mockResolvedValue({
      games: [
        {
          id: "stale",
          source: "psn",
          title: "Example",
          link_state: "raw",
          catalog_lookup_state: "review",
          catalog_search_query: "Example",
          detail_game_id: null,
          catalog_game_id: null,
          external_id: "psn:manual:example",
          cover_url: null,
        },
      ],
      steam_available: false,
      steam_error: null,
      raw_count: 1,
      quarantined_count: 0,
      pending_catalog_count: 1,
    });
    renderLibrary();
    fireEvent.click(await screen.findByRole("button", { name: "PlayStation" }));
    expect(await screen.findByText(/Find catalog matches to add covers/)).toBeInTheDocument();
  });
});
