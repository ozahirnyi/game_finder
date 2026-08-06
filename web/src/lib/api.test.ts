import { afterEach, describe, expect, it, vi } from "vitest";
import { getRecommendations } from "./api";

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
