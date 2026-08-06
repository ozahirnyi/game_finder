import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { searchGames } from "@/lib/api";
import { SearchScreen } from "./SearchScreen";

vi.mock("@/lib/api", () => ({ searchGames: vi.fn() }));

describe("SearchScreen", () => {
  it("keeps loading and unavailable states distinct", async () => {
    let rejectSearch: (reason?: unknown) => void = () => undefined;
    vi.mocked(searchGames).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectSearch = reject;
        }),
    );

    render(<SearchScreen initialQuery="hades" />);

    expect(await screen.findByText("Searching games")).toBeVisible();
    expect(screen.queryByText("No games found")).not.toBeInTheDocument();
    rejectSearch(new Error("offline"));
    expect(await screen.findByText("Could not search games")).toBeVisible();
  });

  it("renders Steam fallback search results as store links", async () => {
    vi.mocked(searchGames).mockResolvedValue({
      results: [
        {
          id: null,
          name: "Hades",
          released: null,
          background_image: "https://cdn.example/hades.jpg",
          source: "steam",
          steam_appid: 1145360,
          url: "https://store.steampowered.com/app/1145360/",
        },
      ],
    });

    render(<SearchScreen initialQuery="hades" />);

    expect(
      await screen.findByRole("link", { name: "View on Steam" }),
    ).toHaveAttribute("href", "https://store.steampowered.com/app/1145360/");
  });
});
