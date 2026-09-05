// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "./api";

describe("apiRequest during server rendering", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the internal API service for a relative public request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({}), { headers: { "content-type": "application/json" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/catalog/games/274755");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://app:8000/catalog/games/274755",
      expect.any(Object),
    );
  });
});
