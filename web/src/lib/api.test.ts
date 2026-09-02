import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  ApiError,
  clearToken,
  getRecommendationQuota,
  getRecommendations,
  setToken,
  type RecommendationQuotaErrorDetail,
} from "./api";

const validToken = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});

describe("AI recommendation errors", () => {
  afterEach(() => {
    clearToken();
    vi.unstubAllGlobals();
  });

  it("uses the structured API error message for users", async () => {
    setToken(validToken);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      detail: { code: "ai_recommendations_unavailable", message: "OpenAI is temporarily unavailable." },
    }), { status: 503, headers: { "Content-Type": "application/json" } })));

    await expect(getRecommendations("cozy games")).rejects.toThrow("OpenAI is temporarily unavailable.");
  });

  it("authenticates quota and recommendation calls", async () => {
    setToken(validToken);
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse({ limit: 3, remaining: 3, cooldown_until: null, reset_at: "2026-09-02T00:00:00Z" }))
      .mockResolvedValueOnce(jsonResponse({ recommendations: [], quota: { limit: 3, remaining: 2, cooldown_until: null, reset_at: "2026-09-02T00:00:00Z" } })));
    await getRecommendationQuota();
    await getRecommendations("cozy");
    expect(fetch).toHaveBeenNthCalledWith(1, expect.stringContaining("/recommendations/quota"), expect.objectContaining({
      headers: expect.objectContaining({}),
    }));
    expect(new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers).get("Authorization")).toBe(`Bearer ${validToken}`);
    expect(new Headers(vi.mocked(fetch).mock.calls[1][1]?.headers).get("Authorization")).toBe(`Bearer ${validToken}`);
  });

  it("keeps structured quota detail on 429", async () => {
    setToken(validToken);
    const expectedDetail: RecommendationQuotaErrorDetail = {
      code: "ai_daily_quota_exhausted", message: "Daily AI search limit reached.",
      quota: { limit: 3, remaining: 0, cooldown_until: null, reset_at: "2026-09-02T00:00:00Z" },
      next_allowed_at: "2026-09-02T00:00:00Z",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      detail: expectedDetail,
    }, 429)));
    const error = await getRecommendations("cozy").catch((reason) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.detail).toEqual(expectedDetail);
    const detail = error.detail as RecommendationQuotaErrorDetail;
    expectTypeOf(detail.next_allowed_at).toEqualTypeOf<string>();
    expect(detail.next_allowed_at).toBe("2026-09-02T00:00:00Z");
  });
});
