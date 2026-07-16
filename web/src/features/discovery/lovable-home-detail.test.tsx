import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { getCatalogGame, getGamePriceHistory, getTrendingGames } from "@/lib/api";
import { Dashboard } from "@/routes/index";
import { GameDetailPage } from "@/routes/games.$gameId";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options, useParams: () => ({ gameId: "7" }) }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  notFound: () => new Error("not found"),
}));

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/components/GameCover", () => ({
  GameCover: ({ title }: { title: string }) => <div aria-label={`${title} artwork`} />,
  Avatar: () => <div />,
}));

vi.mock("@/lib/api", () => ({
  getTrendingGames: vi.fn(),
  getUpcomingGames: vi.fn(),
  getCatalogGame: vi.fn(),
  getGamePriceHistory: vi.fn(),
}));

function renderRoute(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("Lovable home and game-detail routes", () => {
  it("renders catalog games from the trending API without social claims", async () => {
    vi.mocked(getTrendingGames).mockResolvedValue({
      results: [
        { id: 7, name: "Hades", released: "2020-09-17", background_image: "https://example.test/hades.jpg" },
      ],
    });

    renderRoute(<Dashboard />);

    expect((await screen.findAllByText("Hades")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Connect Steam").length).toBeGreaterThan(0);
    expect(getTrendingGames).toHaveBeenCalledWith(3);
  });

  it("renders game detail from the catalog API", async () => {
    vi.mocked(getCatalogGame).mockResolvedValue({
      id: 7,
      name: "Hades",
      released: "2020-09-17",
      background_image: "https://example.test/hades.jpg",
      description_raw: "Fight out of hell.",
      rating: 4.2,
      genres: ["Action"],
      platforms: ["PC"],
    });
    vi.mocked(getGamePriceHistory).mockResolvedValue({
      itad_id: "hades",
      title: "Hades",
      url: null,
      current: null,
      history_low_all: null,
      history_low_1y: null,
      history_low_3m: null,
      deals: [],
    });

    renderRoute(<GameDetailPage gameId="7" />);

    expect(await screen.findByText("Fight out of hell.")).toBeInTheDocument();
    expect(screen.getAllByText("Action").length).toBeGreaterThan(0);
    expect(getCatalogGame).toHaveBeenCalledWith("7");
  });
});
