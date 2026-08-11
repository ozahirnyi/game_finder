import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
                    { title: "Recommended title", reason: "Fits your prompt", tags: ["Co-op"] },
                  ],
                }
              : { results: [] },
          ),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
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
    fireEvent.click(screen.getByRole("button", { name: "PS5" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("feature=co_op"),
        expect.anything(),
      ),
    );
    expect(screen.getByPlaceholderText(/search by title/i)).toHaveValue("");
    expect(window.location.search).toContain("feature=co_op");
    expect(window.location.search).toContain("platform=ps5");
    expect(screen.getByRole("button", { name: "Co-op" })).toHaveClass("border-primary");
  });

  it("offers a title-search fallback for every AI recommendation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              url.includes("/recommendations")
                ? {
                    recommendations: [
                      { title: "Hades", reason: "Match", tags: [] },
                      { title: "Unknown Game", reason: "Match", tags: [] },
                    ],
                  }
                : { results: [] },
            ),
          ),
        ),
      ),
    );
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: /ai search/i }));
    fireEvent.change(await screen.findByPlaceholderText(/describe what you want/i), {
      target: { value: "roguelike" },
    });
    fireEvent.submit(screen.getByRole("form", { name: /search form/i }));

    expect(await screen.findByRole("link", { name: "Search for Hades" })).toHaveAttribute(
      "href",
      "/search?q=Hades",
    );
    expect(screen.getByRole("link", { name: "Search for Unknown Game" })).toHaveAttribute(
      "href",
      "/search?q=Unknown%20Game",
    );
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
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: /ai search/i }));
    fireEvent.change(await screen.findByPlaceholderText(/describe what you want/i), {
      target: { value: "obscure niche" },
    });
    fireEvent.submit(screen.getByRole("form", { name: /search form/i }));

    expect(await screen.findByText("No AI matches found")).toBeInTheDocument();
  });
});
