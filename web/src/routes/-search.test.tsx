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
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          recommendations: [
            { title: "Recommended title", reason: "Fits your prompt", tags: ["Co-op"] },
          ],
        }),
        { status: 200 },
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

  it("turns a query suggestion into the catalog query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] })));
    vi.stubGlobal("fetch", fetchMock);
    renderSearch();

    fireEvent.click(screen.getByRole("button", { name: "Co-op" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("q=Co-op"), expect.anything()));
    expect(screen.getByPlaceholderText(/search by title/i)).toHaveValue("Co-op");
    expect(screen.getByRole("button", { name: "Co-op" })).toHaveClass("border-primary");
  });

  it("links identified AI recommendations and offers a title search fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      recommendations: [
        { title: "Hades", reason: "Match", tags: [], igdb_id: 30 },
        { title: "Unknown Game", reason: "Match", tags: [] },
      ],
    }))));
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: /ai search/i }));
    fireEvent.change(await screen.findByPlaceholderText(/describe what you want/i), { target: { value: "roguelike" } });
    fireEvent.submit(screen.getByRole("form", { name: /search form/i }));

    expect(await screen.findByRole("link", { name: "View Hades" })).toHaveAttribute("href", "/games/30");
    expect(screen.getByRole("link", { name: "Search for Unknown Game" })).toHaveAttribute("href", "/search?q=Unknown%20Game");
  });
});
