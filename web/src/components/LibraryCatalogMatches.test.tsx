import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getToken: vi.fn(() => "test-token"),
  startLibraryCatalogMatchingJob: vi.fn(),
  getCurrentLibraryCatalogMatchingJob: vi.fn(),
  dismissLibraryCatalogMatchingJob: vi.fn(),
  applyLibraryCatalogMatches: vi.fn(),
  searchGames: vi.fn(),
}));
const previewRequest = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => api);
import { LibraryCatalogMatches } from "./LibraryCatalogMatches";

const preview = {
  items: [
    {
      game_id: "psn",
      title: "Ведьмак 3",
      source: "psn",
      link_state: "raw",
      catalog_game_id: null,
      status: "review",
      suggestions: [
        { id: 1942, title: "The Witcher 3", confidence: "likely", platforms: ["PlayStation 4"] },
      ],
    },
    {
      game_id: "manual",
      title: "Portal 2",
      source: "manual",
      link_state: "raw",
      catalog_game_id: null,
      status: "matched",
      suggestions: [{ id: 72, title: "Portal 2", confidence: "exact", platforms: ["PC"] }],
    },
    {
      game_id: "missing",
      title: "Unknown",
      source: "manual",
      link_state: "raw",
      status: "no_match",
      suggestions: [],
    },
  ],
};
function show() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <LibraryCatalogMatches />
    </QueryClientProvider>,
  );
  return client;
}
beforeEach(() => {
  vi.resetAllMocks();
  previewRequest.mockResolvedValue(preview);
  api.getCurrentLibraryCatalogMatchingJob.mockResolvedValue(null);
  api.dismissLibraryCatalogMatchingJob.mockResolvedValue({ dismissed: true });
  api.startLibraryCatalogMatchingJob.mockImplementation(async (...args) => {
    const result = await previewRequest(...args);
    return {
      id: "job",
      status: "succeeded",
      result: {
        ...result,
        total: result.items.length,
        processed: result.items.length,
        remaining: 0,
        matched: result.items.filter((item: { suggestions: unknown[] }) => item.suggestions.length)
          .length,
        include_linked: args[0],
      },
    };
  });
  api.applyLibraryCatalogMatches.mockResolvedValue({ updated: 2 });
  api.searchGames.mockResolvedValue({ results: [] });
});
afterEach(cleanup);
describe("library catalog confirmation", () => {
  it("explains catalog matching without offering AI translation", () => {
    show();
    expect(screen.getByText(/You confirm every link/)).toBeInTheDocument();
    expect(screen.queryByText(/AI may suggest/)).not.toBeInTheDocument();
  });

  it("distinguishes same-name catalog choices by release year and platform", async () => {
    previewRequest.mockResolvedValue({
      items: [
        {
          ...preview.items[0],
          suggestions: [
            {
              id: 1,
              title: "Hades",
              released: "1995-05-01",
              platforms: ["PC"],
              confidence: "likely",
            },
            {
              id: 2,
              title: "Hades",
              released: "2018-12-06",
              platforms: ["PlayStation 4"],
              confidence: "likely",
            },
          ],
        },
      ],
    });
    show();
    fireEvent.click(screen.getByRole("button", { name: "Find catalog matches" }));
    const intended = await screen.findByRole("button", {
      name: "Choose Hades, 2018, PlayStation 4",
    });
    expect(screen.getByRole("button", { name: "Choose Hades, 1995, PC" })).toBeInTheDocument();
    fireEvent.click(intended);
    expect(intended).toHaveAttribute("aria-pressed", "true");
  });

  it.each(["review", "unavailable"])(
    "requires uncertainty confirmation for %s rows even with exact proposal flags",
    async (status) => {
      previewRequest.mockResolvedValue({
        items: [{ ...preview.items[1], status }],
      });
      show();
      fireEvent.click(screen.getByRole("button", { name: "Find catalog matches" }));
      await screen.findByRole("heading", { name: "Portal 2" });
      fireEvent.click(screen.getByRole("button", { name: /Select all matches/ }));
      fireEvent.click(screen.getByRole("button", { name: "Apply selected (1)" }));
      expect(screen.getByRole("alertdialog")).toHaveTextContent(
        "1 selected matches include 1 uncertain match",
      );
      expect(api.applyLibraryCatalogMatches).not.toHaveBeenCalled();
    },
  );
  it("invalidates collections after a partial apply failure and requires a fresh preview", async () => {
    previewRequest.mockResolvedValue({ items: [preview.items[1]] });
    api.applyLibraryCatalogMatches.mockRejectedValue(
      new Error(
        "Applied 100 entries; next batch failed: Catalog unavailable. Refresh catalog matches before trying again.",
      ),
    );
    const client = show();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    fireEvent.click(screen.getByRole("button", { name: "Find catalog matches" }));
    await screen.findByRole("heading", { name: "Portal 2" });
    fireEvent.click(screen.getByRole("button", { name: /Select all matches/ }));
    fireEvent.click(screen.getByRole("button", { name: "Apply selected (1)" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Applied 100 entries; next batch failed: Catalog unavailable",
    );
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["library"] }));
    expect(screen.queryByRole("button", { name: /Apply selected/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Find catalog matches" }));
    await waitFor(() => expect(previewRequest).toHaveBeenCalledTimes(2));
  });
  it("starts only on request, selects all proposals and requires a counted uncertain confirmation", async () => {
    show();
    expect(previewRequest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Find catalog matches" }));
    await screen.findByText("Ведьмак 3");
    fireEvent.click(screen.getByRole("button", { name: /Select all matches/ }));
    expect(screen.getByLabelText("Select Unknown")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Apply selected (2)" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "2 selected matches include 1 uncertain match",
    );
    expect(api.applyLibraryCatalogMatches).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(api.applyLibraryCatalogMatches).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply selected (2)" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm selected matches" }));
    await waitFor(() =>
      expect(api.applyLibraryCatalogMatches).toHaveBeenCalledWith([
        { game_id: "psn", action: "link", catalog_id: 1942, expected_catalog_game_id: null },
        { game_id: "manual", action: "link", catalog_id: 72, expected_catalog_game_id: null },
      ]),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Updated 2 library entries");
  });
  it("allows replacing an uncertain proposal through catalog search before applying", async () => {
    api.searchGames.mockResolvedValue({ results: [{ id: 90, name: "Different game" }] });
    show();
    fireEvent.click(screen.getByRole("button", { name: "Find catalog matches" }));
    await screen.findByText("Ведьмак 3");
    fireEvent.change(screen.getByLabelText("Search catalog for Ведьмак 3"), {
      target: { value: "Different" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search for Ведьмак 3" }));
    fireEvent.click(await screen.findByRole("button", { name: "Choose Different game" }));
    fireEvent.click(screen.getByLabelText("Select Ведьмак 3"));
    fireEvent.click(screen.getByRole("button", { name: "Apply selected (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm selected matches" }));
    await waitFor(() =>
      expect(api.applyLibraryCatalogMatches).toHaveBeenCalledWith([
        { game_id: "psn", action: "link", catalog_id: 90, expected_catalog_game_id: null },
      ]),
    );
  });
  it("loads linked entries for correction and unlinks without deleting the library row", async () => {
    previewRequest.mockResolvedValue({
      items: [{ ...preview.items[1], catalog_game_id: 72, link_state: "linked", suggestions: [] }],
    });
    show();
    fireEvent.click(screen.getByLabelText("Recheck already matched games"));
    fireEvent.click(screen.getByRole("button", { name: "Find catalog matches" }));
    await screen.findByRole("heading", { name: "Portal 2" });
    expect(previewRequest).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Remove link for Portal 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply selected (1)" }));
    await waitFor(() =>
      expect(api.applyLibraryCatalogMatches).toHaveBeenCalledWith([
        { game_id: "manual", action: "unlink", expected_catalog_game_id: 72 },
      ]),
    );
  });
  it("distinguishes lookup failure and permits retry without changing entries", async () => {
    previewRequest.mockRejectedValueOnce(new Error("Catalog unavailable"));
    show();
    fireEvent.click(screen.getByRole("button", { name: "Find catalog matches" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Catalog unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Find catalog matches" }));
    await screen.findByText("Ведьмак 3");
    expect(api.applyLibraryCatalogMatches).not.toHaveBeenCalled();
  });
});
