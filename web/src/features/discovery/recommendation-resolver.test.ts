import { describe, expect, it, vi } from "vitest";
import { resolveRecommendation } from "./recommendation-resolver";
import { searchGames } from "@/lib/api";

vi.mock("@/lib/api", () => ({ searchGames: vi.fn() }));
describe("resolveRecommendation", () => {
  it("prefers a valid RAWG id over Steam and catalog matches", async () => {
    await expect(
      resolveRecommendation({
        title: "Hades",
        reason: "",
        tags: [],
        rawg_id: 30,
        steam_appid: 1145360,
        steam_url: "https://store.steampowered.com/app/1145360",
      }),
    ).resolves.toMatchObject({ href: "/games/30", external: false });
    expect(searchGames).not.toHaveBeenCalled();
  });
  it("uses Steam only with an app id and valid URL", async () => {
    await expect(
      resolveRecommendation({
        title: "Hades",
        reason: "",
        tags: [],
        steam_appid: 1145360,
        steam_url: "https://store.steampowered.com/app/1145360",
      }),
    ).resolves.toMatchObject({
      href: "https://store.steampowered.com/app/1145360",
      external: true,
    });
  });
  it("uses an exact normalized catalog match and otherwise searches by title", async () => {
    vi.mocked(searchGames).mockResolvedValue({
      results: [
        { id: 2, name: "Hades II", released: null, background_image: null },
      ],
    });
    await expect(
      resolveRecommendation({ title: "hades ii", reason: "", tags: [] }),
    ).resolves.toMatchObject({ href: "/games/2" });
    vi.mocked(searchGames).mockResolvedValue({
      results: [
        {
          id: 3,
          name: "Hades II Deluxe",
          released: null,
          background_image: null,
        },
      ],
    });
    await expect(
      resolveRecommendation({ title: "Hades II", reason: "", tags: [] }),
    ).resolves.toMatchObject({ href: "/search?q=Hades%20II" });
  });
});
