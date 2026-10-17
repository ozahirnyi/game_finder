import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  applyLibraryCatalogMatches,
  clearToken,
  previewLibraryCatalogMatches,
  setToken,
  startLibraryCatalogMatchingJob,
  getCurrentLibraryCatalogMatchingJob,
  dismissLibraryCatalogMatchingJob,
  cancelLibraryCatalogMatchingJob,
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
  it("cancels the specified job with authentication and receives its saved progress", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response({ id: "job-id", status: "cancelled", result: { processed: 10 } }),
      );
    vi.stubGlobal("fetch", fetcher);
    expect(await cancelLibraryCatalogMatchingJob("job-id")).toMatchObject({
      status: "cancelled",
      result: { processed: 10 },
    });
    expect(fetcher.mock.calls[0][0]).toContain("/library/catalog-matches/jobs/job-id/cancel");
    expect(fetcher.mock.calls[0][1].method).toBe("POST");
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("Bearer test-token");
  });
  it("starts a durable source-scoped job without waiting for matching", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ id: "job", status: "queued" }, 202));
    vi.stubGlobal("fetch", fetcher);
    expect(await startLibraryCatalogMatchingJob(true, "psn")).toMatchObject({ status: "queued" });
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toContain("/library/catalog-matches/jobs?include_linked=true&source=psn");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer test-token");
  });

  it("restores a saved job and treats only 404 as no task", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ id: "saved", status: "running" }))
      .mockResolvedValueOnce(response({ detail: "No task" }, 404))
      .mockResolvedValueOnce(response({ detail: "Server down" }, 503));
    vi.stubGlobal("fetch", fetcher);
    expect(await getCurrentLibraryCatalogMatchingJob("psn")).toMatchObject({ id: "saved" });
    expect(fetcher.mock.calls[0][0]).toContain("/jobs/current?source=psn");
    expect(await getCurrentLibraryCatalogMatchingJob()).toBeNull();
    await expect(getCurrentLibraryCatalogMatchingJob()).rejects.toMatchObject({ status: 503 });
  });

  it("dismisses a saved preview without deleting library games", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ dismissed: true }));
    vi.stubGlobal("fetch", fetcher);
    await dismissLibraryCatalogMatchingJob("job-id");
    expect(fetcher.mock.calls[0][0]).toContain("/library/catalog-matches/jobs/job-id");
    expect(fetcher.mock.calls[0][1].method).toBe("DELETE");
  });
  it("keeps the PlayStation source scope on each preview page", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ items: [{ game_id: "a" }], total: 2, next_offset: 1 }))
      .mockResolvedValueOnce(response({ items: [{ game_id: "b" }], total: 2, next_offset: null }));
    vi.stubGlobal("fetch", fetcher);
    await previewLibraryCatalogMatches(false, "psn");
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [url] of fetcher.mock.calls)
      expect(new URL(url, "http://localhost").searchParams.get("source")).toBe("psn");
  });

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
