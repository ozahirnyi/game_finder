import { afterEach, describe, expect, it, vi } from "vitest";
import { getRecommendations, listWishlist } from "./api";

describe("AI recommendation errors", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the structured API error message for users", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            detail: {
              code: "ai_recommendations_unavailable",
              message: "OpenAI is temporarily unavailable.",
            },
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(getRecommendations("cozy games")).rejects.toThrow(
      "OpenAI is temporarily unavailable.",
    );
  });
});

describe("retention API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads the authenticated wishlist", async () => {
    window.localStorage.setItem("game_finder_token", "header.eyJleHAiOjQxMDE0NDQ4MDB9.signature");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listWishlist()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/wishlist"), expect.objectContaining({ method: "GET" }));
  });
});
