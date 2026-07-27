import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WishlistPage } from "@/routes/wishlist";

const api = vi.hoisted(() => ({
  addWishlistItem: vi.fn(),
  createPriceAlert: vi.fn(),
  getGamePriceHistory: vi.fn(),
  isAuthenticated: vi.fn(),
  listFavorites: vi.fn(),
  listPriceAlerts: vi.fn(),
  listWishlist: vi.fn(),
  removeFavorite: vi.fn(),
  removeWishlistItem: vi.fn(),
  searchGames: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({
    children,
    to,
    ...props
  }: React.ComponentProps<"a"> & { to?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("@/lib/api", () => api);

function renderPage() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <WishlistPage />
    </QueryClientProvider>,
  );
}

describe("wishlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.isAuthenticated.mockReturnValue(true);
    api.listFavorites.mockResolvedValue([]);
    api.listWishlist.mockResolvedValue([
      {
        id: "wish-1",
        catalog_game_id: 274755,
        title: "Hades II",
        cover_url: "https://cdn.example/hades.jpg",
        created_at: "2026-01-01",
        updated_at: null,
      },
    ]);
    api.listPriceAlerts.mockResolvedValue([]);
    api.getGamePriceHistory.mockResolvedValue({
      current: {
        shop: "Steam",
        price: { amount: 19.99, currency: "USD" },
        regular: null,
        cut: 20,
        url: "https://store.steampowered.com",
      },
      history_low_all: { amount: 12.49, currency: "USD" },
      history_low_1y: null,
      history_low_3m: null,
      deals: [],
    });
  });

  it("shows stored wishlist games with real price data and removes an item", async () => {
    api.removeWishlistItem.mockResolvedValue(undefined);
    renderPage();
    expect(await screen.findByText("Hades II")).toBeVisible();
    expect(await screen.findByText(/\$19\.99/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /remove hades ii/i }));
    await waitFor(() =>
      expect(api.removeWishlistItem).toHaveBeenCalledWith(274755),
    );
    expect(screen.queryByText("Data unavailable")).not.toBeInTheDocument();
  });
});
