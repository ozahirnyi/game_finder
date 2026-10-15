import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  applyLibraryCatalogMatches,
  clearToken,
  previewLibraryCatalogMatches,
  setToken,
} from "./api";

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
beforeEach(() => setToken("test-token"));
afterEach(() => {
  clearToken();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("library matching requests", () => {
  it("collects all 513 rows across bounded owner-scoped preview pages", async () => {
    const fetcher = vi.fn(async (url: string) => {
      const params = new URL(url, "http://localhost").searchParams;
      const offset = Number(params.get("offset"));
      const limit = Number(params.get("limit"));
      expect(params.get("include_linked")).toBe("true");
      expect(limit).toBe(100);
      const end = Math.min(offset + limit, 513);
      return response({
        items: Array.from({ length: end - offset }, (_, index) => ({
          game_id: String(offset + index),
        })),
        total: 513,
        next_offset: end < 513 ? end : null,
      });
    });
    vi.stubGlobal("fetch", fetcher);
    const result = await previewLibraryCatalogMatches(true);
    expect(result.items).toHaveLength(513);
    expect(new Set(result.items.map((item) => item.game_id)).size).toBe(513);
    expect(fetcher).toHaveBeenCalledTimes(6);
  });
  it("rejects a nonadvancing preview cursor", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(response({ items: [{ game_id: "one" }], total: 513, next_offset: 0 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(previewLibraryCatalogMatches()).rejects.toThrow(/refresh|cursor|advance/i);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("applies 513 decisions in bounded batches", async () => {
    const sizes: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, options) => {
        const size = JSON.parse(options.body).decisions.length;
        sizes.push(size);
        return response({ updated: size });
      }),
    );
    const decisions = Array.from({ length: 513 }, (_, index) => ({
      game_id: String(index),
      action: "keep_raw" as const,
      expected_catalog_game_id: null,
    }));
    expect(await applyLibraryCatalogMatches(decisions)).toEqual({ updated: 513 });
    expect(sizes).toEqual([100, 100, 100, 100, 100, 13]);
  });
  it("reports the applied count and original status when a later batch fails", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ updated: 100 }))
      .mockResolvedValueOnce(response({ detail: "Library link changed" }, 409));
    vi.stubGlobal("fetch", fetcher);
    const decisions = Array.from({ length: 201 }, (_, index) => ({
      game_id: String(index),
      action: "keep_raw" as const,
      expected_catalog_game_id: null,
    }));
    try {
      await applyLibraryCatalogMatches(decisions);
      throw new Error("Expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 409, appliedCount: 100 });
      expect((error as Error).message).toMatch(/100.*Library link changed.*Refresh/);
    }
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
