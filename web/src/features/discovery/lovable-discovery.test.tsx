import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { getHomepageDeals, searchGames } from "@/lib/api";
import { DealsPage } from "@/routes/deals";
import { SearchPage } from "@/routes/search";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/components/GameCover", () => ({
  GameCover: ({ title }: { title: string }) => (
    <div aria-label={`${title} artwork`} />
  ),
}));

vi.mock("@/lib/api", () => ({
  searchGames: vi.fn(),
  getHomepageDeals: vi.fn(),
}));

function renderRoute(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("Lovable discovery routes", () => {
  it("renders search results from the search API", async () => {
    vi.mocked(searchGames).mockResolvedValue({
      results: [
        {
          id: 1,
          name: "Hades",
          released: "2020-09-17",
          background_image: "https://example.test/hades.jpg",
        },
      ],
    });

    renderRoute(<SearchPage />);

    expect(await screen.findByText("Hades")).toBeInTheDocument();
    expect(screen.getByText("2020-09-17")).toBeInTheDocument();
    expect(screen.getByLabelText("Hades artwork")).toBeInTheDocument();
    expect(searchGames).toHaveBeenCalledWith("co-op roguelike");
  });

  it("retries a failed deals request", async () => {
    vi.mocked(getHomepageDeals)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        results: [
          {
            id: 2,
            name: "Celeste",
            released: "2018-01-25",
            background_image: "https://example.test/celeste.jpg",
            url: "https://store.example.test/celeste",
            current: {
              shop: "Example Store",
              price: { amount: 4.99, currency: "USD" },
              regular: null,
              cut: 50,
              url: null,
              timestamp: null,
            },
            history_low_all: null,
          },
        ],
      });

    renderRoute(<DealsPage />);

    expect(
      await screen.findByText("Failed to load deals."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() =>
      expect(screen.getByText("Celeste")).toBeInTheDocument(),
    );
    expect(getHomepageDeals).toHaveBeenCalledTimes(2);
  });
});
