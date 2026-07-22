import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchPage } from "@/routes/search";

const api = vi.hoisted(() => ({
  getRecommendations: vi.fn(),
  searchGames: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({
    children,
    to,
    params,
    ...props
  }: React.ComponentProps<"a"> & {
    to?: string;
    params?: { gameId?: string };
  }) => (
    <a href={params?.gameId ? `/games/${params.gameId}` : to} {...props}>
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

function renderSearch() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <SearchPage />
    </QueryClientProvider>,
  );
}

describe("AI search", () => {
  it("sends a natural-language prompt to the recommendations API and displays its results", async () => {
    api.searchGames.mockResolvedValue({ results: [] });
    api.getRecommendations.mockResolvedValue({
      recommendations: [
        {
          title: "Balatro",
          reason: "Deck-building roguelike",
          tags: ["Cards"],
        },
      ],
    });
    renderSearch();

    fireEvent.click(screen.getByRole("button", { name: /ai search/i }));
    fireEvent.change(screen.getByPlaceholderText(/describe what you want/i), {
      target: { value: "co-op roguelike for two" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ask ai/i }));

    await waitFor(() =>
      expect(api.getRecommendations).toHaveBeenCalledWith(
        "co-op roguelike for two",
      ),
    );
    expect(await screen.findByText("Balatro")).toBeVisible();
  });

  it("links a recommendation to its matching catalog game when a result is available", async () => {
    api.getRecommendations.mockResolvedValue({
      recommendations: [
        {
          title: "Balatro",
          reason: "Deck-building roguelike",
          tags: ["Cards"],
        },
      ],
    });
    api.searchGames.mockResolvedValue({
      results: [
        {
          id: 316377,
          name: "Balatro",
          released: "2024-02-20",
          background_image: null,
        },
      ],
    });
    renderSearch();

    fireEvent.click(screen.getByRole("button", { name: /ai search/i }));
    fireEvent.change(screen.getByPlaceholderText(/describe what you want/i), {
      target: { value: "deck-building roguelike" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ask ai/i }));

    expect(
      await screen.findByRole("link", {
        name: /view game details for balatro/i,
      }),
    ).toHaveAttribute("href", "/games/316377");
  });
});
