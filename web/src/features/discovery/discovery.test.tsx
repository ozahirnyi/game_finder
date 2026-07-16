import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCatalogGame, getGamePriceHistory, getHomepageDeals, getTrendingGames, getUpcomingGames, searchGames } from "@/lib/api";
import { DealsScreen } from "./DealsScreen";
import { DiscoveryScreen } from "./DiscoveryScreen";
import { GameDetailScreen } from "./GameDetailScreen";
import { SearchScreen } from "./SearchScreen";
import SearchPage from "@/app/search/page";

const navigationState = vi.hoisted(() => ({ params: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => navigationState.params,
}));

vi.mock("@/lib/api", () => ({
  getCatalogGame: vi.fn(),
  getGamePriceHistory: vi.fn(),
  getHomepageDeals: vi.fn(),
  getTrendingGames: vi.fn(),
  getUpcomingGames: vi.fn(),
  searchGames: vi.fn(),
}));

describe("discovery API regions", () => {
  beforeEach(() => {
    vi.mocked(getTrendingGames).mockResolvedValue({ results: [] });
    vi.mocked(getUpcomingGames).mockResolvedValue({ results: [] });
    vi.mocked(getGamePriceHistory).mockResolvedValue({
      itad_id: "1", title: "Hades II", url: null, current: null, history_low_all: null, history_low_1y: null, history_low_3m: null, deals: [],
    });
  });

  it("renders search results from api.ts and retries a failed request", async () => {
    vi.mocked(searchGames).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({
      results: [{ id: 1, name: "Hades II", released: null, background_image: null }],
    });
    render(<SearchScreen initialQuery="hades" />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Hades II" })).toBeVisible();
  });

  it("shows the fallback cover when a result has no background image", async () => {
    vi.mocked(getHomepageDeals).mockResolvedValue({
      results: [{ id: 1, name: "Hades II", released: null, background_image: null, url: null, current: null, history_low_all: null }],
    });
    render(<DealsScreen />);
    expect(await screen.findByLabelText("Hades II cover unavailable")).toBeVisible();
  });

  it("renders trending and upcoming games from their API regions", async () => {
    vi.mocked(getTrendingGames).mockResolvedValue({ results: [{ id: 1, name: "Trending game", released: null, background_image: null }] });
    vi.mocked(getUpcomingGames).mockResolvedValue({ results: [{ id: 2, name: "Upcoming game", released: null, background_image: null }] });
    render(<DiscoveryScreen />);
    expect(await screen.findByRole("heading", { name: "Trending game" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "Upcoming game" })).toBeVisible();
  });

  it("retries only the failed discovery region", async () => {
    vi.mocked(getTrendingGames).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ results: [] });
    vi.mocked(getUpcomingGames).mockResolvedValue({ results: [{ id: 2, name: "Stable upcoming", released: null, background_image: null }] });
    const user = render(<DiscoveryScreen />);
    expect(await screen.findByRole("heading", { name: "Stable upcoming" })).toBeVisible();
    const trendingCalls = vi.mocked(getTrendingGames).mock.calls.length;
    const upcomingCalls = vi.mocked(getUpcomingGames).mock.calls.length;
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    await screen.findByText("No trending games yet");
    expect(getTrendingGames).toHaveBeenCalledTimes(trendingCalls + 1);
    expect(getUpcomingGames).toHaveBeenCalledTimes(upcomingCalls);
    user.unmount();
  });

  it("renders game details and price history", async () => {
    vi.mocked(getCatalogGame).mockResolvedValue({
      id: 1, name: "Hades II", released: null, background_image: null, description_raw: null, rating: null, genres: [], platforms: [],
    });
    render(<GameDetailScreen gameId="1" />);
    expect(await screen.findByRole("heading", { name: "Hades II" })).toBeVisible();
    expect(await screen.findByText("Current price")).toBeVisible();
  });

  it("keeps successful price history visible when the catalog request fails", async () => {
    vi.mocked(getCatalogGame).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ id: 1, name: "Hades II", released: null, background_image: null, description_raw: null, rating: null, genres: [], platforms: [] });
    vi.mocked(getGamePriceHistory).mockResolvedValue({ itad_id: "1", title: "Hades II", url: null, current: { shop: "Store", price: { amount: 19, currency: "USD" }, regular: null, cut: null, url: null, timestamp: null }, history_low_all: null, history_low_1y: null, history_low_3m: null, deals: [] });
    render(<GameDetailScreen gameId="1" />);
    expect(await screen.findByText("19 USD")).toBeVisible();
    const catalogCalls = vi.mocked(getCatalogGame).mock.calls.length;
    const priceCalls = vi.mocked(getGamePriceHistory).mock.calls.length;
    fireEvent.click(await screen.findByRole("button", { name: "Retry game details" }));
    expect(await screen.findByRole("heading", { name: "Hades II" })).toBeVisible();
    expect(getCatalogGame).toHaveBeenCalledTimes(catalogCalls + 1);
    expect(getGamePriceHistory).toHaveBeenCalledTimes(priceCalls);
  });

  it("updates search results when App Router query params change", async () => {
    navigationState.params = new URLSearchParams("q=hades");
    vi.mocked(searchGames).mockResolvedValue({ results: [{ id: 1, name: "Hades II", released: null, background_image: null }] });
    const view = render(<SearchPage />);
    expect(await screen.findByRole("heading", { name: "Hades II" })).toBeVisible();
    navigationState.params = new URLSearchParams("q=celeste");
    vi.mocked(searchGames).mockResolvedValue({ results: [{ id: 2, name: "Celeste", released: null, background_image: null }] });
    view.rerender(<SearchPage />);
    expect(await screen.findByRole("heading", { name: "Celeste" })).toBeVisible();
    expect(searchGames).toHaveBeenLastCalledWith("celeste");
  });
});
