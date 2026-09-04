import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/GameCard", () => ({
  GameCard: ({ game }: { game: { gameId?: string; title: string } }) => (
    <a href={`/games/${game.gameId}`}>{game.title}</a>
  ),
}));
import { Route } from "./search";

function renderSearch() {
  const SearchPage = Route.options.component!;
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <SearchPage />
    </QueryClientProvider>,
  );
}

describe("SearchPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.localStorage.removeItem("game_finder_token");
    window.history.replaceState({}, "", "/search");
  });

  it("shows search progress instead of an empty result while catalog search is pending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderSearch();

    fireEvent.change(screen.getByPlaceholderText(/search by title/i), {
      target: { value: "Hades" },
    });

    expect(await screen.findByText("Searching games…")).toBeInTheDocument();
    expect(screen.queryByText("No games match your search")).not.toBeInTheDocument();
  });

  it("submits an AI prompt and displays returned recommendations", async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.includes("/recommendations")
              ? {
                  recommendations: [
                    {
                      title: "Recommended title",
                      reason: "Fits your prompt",
                      tags: ["Co-op"],
                      game: {
                        id: 42,
                        name: "Recommended title",
                        released: null,
                        background_image: null,
                        platforms: [],
                      },
                    },
                  ],
                }
              : { results: [] },
          ),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.setItem("game_finder_token", "test-token");
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: /ai search/i }));
    const prompt = await screen.findByPlaceholderText(/describe what you want/i);
    fireEvent.change(prompt, { target: { value: "co-op games for two" } });
    fireEvent.submit(screen.getByRole("form", { name: /search form/i }));
    expect(await screen.findByText("Recommended title")).toBeInTheDocument();
    expect(screen.getByText("Fits your prompt")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/recommendations"),
      expect.any(Object),
    );
  });

  it("uses chips as multi-select discovery filters without changing the text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] })));
    vi.stubGlobal("fetch", fetchMock);
    renderSearch();

    fireEvent.click(screen.getByRole("button", { name: "Co-op" }));
    fireEvent.click(screen.getByRole("button", { name: "Consoles" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("feature=co_op"),
        expect.anything(),
      ),
    );
    expect(screen.getByPlaceholderText(/search by title/i)).toHaveValue("");
    expect(window.location.search).toContain("feature=co_op");
    expect(window.location.search).toContain("platform=console");
    expect(screen.getByRole("button", { name: "Co-op" })).toHaveClass("border-primary");
  });

  it("offers Solo and a console group instead of a single promoted console", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] })));
    vi.stubGlobal("fetch", fetchMock);
    renderSearch();

    fireEvent.click(screen.getByRole("button", { name: "Solo" }));
    fireEvent.click(screen.getByRole("button", { name: "Consoles" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(
          /feature=single_player.*platform=console|platform=console.*feature=single_player/,
        ),
        expect.anything(),
      ),
    );
    expect(screen.queryByRole("button", { name: "PS5" })).not.toBeInTheDocument();
  });

  it("offers additional catalog genres as structured filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] })));
    vi.stubGlobal("fetch", fetchMock);
    renderSearch();

    fireEvent.click(screen.getByRole("button", { name: "Shooter" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("genre=shooter"),
        expect.anything(),
      ),
    );
    expect(screen.getByRole("button", { name: "Adventure" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Strategy" })).toBeInTheDocument();
  });

  it("requests only real sale discovery results alongside selected catalog filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] })));
    vi.stubGlobal("fetch", fetchMock);
    renderSearch();

    fireEvent.click(screen.getByRole("button", { name: "On sale" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("on_sale=true"),
        expect.anything(),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Consoles" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/on_sale=true.*platform=console|platform=console.*on_sale=true/),
        expect.anything(),
      ),
    );
  });

  it("renders only resolved AI results as catalog cards", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              url.includes("/recommendations")
                ? {
                    recommendations: [
                      {
                        title: "Hades",
                        reason: "Match",
                        tags: [],
                        game: {
                          id: 30,
                          name: "Hades",
                          genres: ["Roguelike"],
                          platforms: ["PC"],
                          hero_image: null,
                          background_image: null,
                        },
                      },
                      { title: "Unknown Game", reason: "Match", tags: [] },
                    ],
                  }
                : { results: [] },
            ),
          ),
        ),
      ),
    );
    window.localStorage.setItem("game_finder_token", "test-token");
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: /ai search/i }));
    fireEvent.change(await screen.findByPlaceholderText(/describe what you want/i), {
      target: { value: "roguelike" },
    });
    fireEvent.submit(screen.getByRole("form", { name: /search form/i }));

    expect(await screen.findByRole("link", { name: /hades/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/games/30"),
    );
    expect(screen.queryByText("Unknown Game")).not.toBeInTheDocument();
  });

  it("distinguishes an AI no-match response from provider unavailability", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              url.includes("/recommendations") ? { recommendations: [] } : { results: [] },
            ),
          ),
        ),
      ),
    );
    window.localStorage.setItem("game_finder_token", "test-token");
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: /ai search/i }));
    fireEvent.change(await screen.findByPlaceholderText(/describe what you want/i), {
      target: { value: "obscure niche" },
    });
    fireEvent.submit(screen.getByRole("form", { name: /search form/i }));

    expect(await screen.findByText("No AI matches found")).toBeInTheDocument();
  });

  it("explains when the daily AI quota is exhausted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ detail: { code: "ai_daily_quota_exhausted" } }), {
            status: 429,
          }),
        ),
      ),
    );
    window.localStorage.setItem("game_finder_token", "test-token");
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: /ai search/i }));
    fireEvent.change(await screen.findByPlaceholderText(/describe what you want/i), {
      target: { value: "co-op" },
    });
    fireEvent.submit(screen.getByRole("form", { name: /search form/i }));

    expect(await screen.findByText("Daily AI search limit reached")).toBeInTheDocument();
  });

  it("explains when the AI provider is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ detail: { code: "ai_recommendations_unavailable" } }), {
            status: 503,
          }),
        ),
      ),
    );
    window.localStorage.setItem("game_finder_token", "test-token");
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: /ai search/i }));
    fireEvent.change(await screen.findByPlaceholderText(/describe what you want/i), {
      target: { value: "co-op" },
    });
    fireEvent.submit(screen.getByRole("form", { name: /search form/i }));

    expect(await screen.findByText("AI provider is temporarily unavailable")).toBeInTheDocument();
  });
});
