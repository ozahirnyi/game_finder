import { afterEach, describe, expect, it, vi } from "vitest";

describe("production API URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    window.localStorage.removeItem("game_finder_token");
  });

  it("defaults to the Lightsail API proxy", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    window.localStorage.setItem("game_finder_token", "header.eyJleHAiOjQxMDI0NDQ4MDB9.signature");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ recommendations: [] }), {
      headers: { "Content-Type": "application/json" },
    })));
    vi.resetModules();
    const { getRecommendations } = await import("./api");

    await getRecommendations("cozy games");

    expect(fetch).toHaveBeenCalledWith("https://playfinder.cc/api/recommendations", expect.any(Object));
  });
});
