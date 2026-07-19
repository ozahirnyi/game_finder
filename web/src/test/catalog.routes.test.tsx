import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DealsPage } from "@/routes/deals";
import { GameDetailPage } from "@/routes/games.$gameId";

const api = vi.hoisted(() => ({
  getCatalogGame: vi.fn(),
  getGamePriceHistory: vi.fn(),
  getHomepageDeals: vi.fn(),
  getSavedGame: vi.fn(),
  searchGames: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ children, to, params, ...props }: React.ComponentProps<"a"> & { to?: string; params?: { gameId?: string } }) => (
    <a href={params?.gameId ? `/games/${params.gameId}` : to} {...props}>{children}</a>
  ),
}));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/lib/api", () => api);

function renderPage(view: React.ReactElement) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{view}</QueryClientProvider>);
}

describe("catalog routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getHomepageDeals.mockResolvedValue({
      results: [{ id: 274755, name: "Hades II", released: "2024-05-06", background_image: "https://cdn.example/hades.jpg", url: "https://store.steampowered.com/app/1145350", current: { shop: "Steam", price: { amount: 19.99, currency: "USD" }, regular: { amount: 29.99, currency: "USD" }, cut: 33 } }],
    });
    api.getCatalogGame.mockResolvedValue({ id: 274755, name: "Hades II", released: "2024-05-06", background_image: "https://cdn.example/hades.jpg", description_raw: "Fight beyond the Underworld.", rating: 4.8, genres: ["Action"], platforms: ["PC"] });
    api.searchGames.mockResolvedValue({ results: [{ id: 274755, name: "Hades II", released: null, background_image: null }] });
    api.getGamePriceHistory.mockResolvedValue({ itad_id: "hades-ii", title: "Hades II", url: "https://isthereanydeal.com/game/hades-ii", current: { shop: "Steam", price: { amount: 19.99, currency: "USD" }, regular: { amount: 29.99, currency: "USD" }, cut: 33, url: "https://store.steampowered.com/app/1145350", timestamp: null }, history_low_all: { amount: 12.49, currency: "USD" }, history_low_1y: { amount: 14.99, currency: "USD" }, history_low_3m: { amount: 17.99, currency: "USD" }, deals: [] });
  });

  it("links each real deal to the store and its catalog detail", async () => {
    renderPage(<DealsPage />);

    expect((await screen.findAllByText("Hades II")).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /open deal/i })).toHaveAttribute("href", "https://store.steampowered.com/app/1145350");
    expect(screen.getByRole("link", { name: /game details/i })).toHaveAttribute("href", "/games/274755");
    expect(screen.queryByText("Data unavailable")).not.toBeInTheDocument();
  });

  it("renders real catalog metadata and price-low values without placeholder copy", async () => {
    renderPage(<GameDetailPage gameId="274755" />);

    expect(await screen.findByText("Fight beyond the Underworld.")).toBeVisible();
    expect(await screen.findByText("All-time low")).toBeVisible();
    expect(screen.getAllByText(/\$19\.99/).length).toBeGreaterThan(0);
    expect(screen.getByText(/\$12\.49/)).toBeVisible();
    expect(screen.getByRole("link", { name: /open at steam/i })).toHaveAttribute("href", "https://store.steampowered.com/app/1145350");
    await waitFor(() => expect(screen.queryByText("Data unavailable")).not.toBeInTheDocument());
  });

  it("opens a saved library game in its matching catalog page and expands its description", async () => {
    api.getSavedGame.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", title: "Hades II", source: "steam", notes: null, info: null, external_id: "1145350", playtime_forever: 120, playtime_2weeks: null, img_icon_url: null, synced_at: null, created_at: "2026-01-01T00:00:00Z" });
    renderPage(<GameDetailPage gameId="11111111-1111-4111-8111-111111111111" />);
    expect(await screen.findByText("Fight beyond the Underworld.")).toBeVisible();
    expect(api.searchGames).toHaveBeenCalledWith("Hades II");
    fireEvent.click(screen.getByRole("button", { name: /show full description/i }));
    expect(screen.getByRole("button", { name: /collapse description/i })).toBeVisible();
  });
});
