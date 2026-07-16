import { afterEach, describe, expect, it, vi } from "vitest";

import { getCurrentUser, getGoogleStatus, setToken } from "./api";

const TOKEN_KEY = "game_finder_token";

function validToken() {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 }));
  return `header.${payload}.signature`;
}

afterEach(() => {
  window.localStorage.removeItem(TOKEN_KEY);
});

describe("API requests", () => {
  it("uses the Railway fallback URL and omits Authorization for public requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ configured: true }), {
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getGoogleStatus()).resolves.toEqual({ configured: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://game-finder.up.railway.app/auth/google/status",
      expect.objectContaining({ headers: expect.not.objectContaining({ Authorization: expect.anything() }) })
    );
  });

  it("sends the bearer token for authenticated requests when one exists", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "user-1" }), {
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    setToken(validToken());

    await getCurrentUser();

    const [, options] = fetchMock.mock.calls[0];
    expect(new Headers(options.headers).get("Authorization")).toBe(`Bearer ${window.localStorage.getItem(TOKEN_KEY)}`);
  });

  it("returns non-JSON error text in ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("The upstream service is unavailable", { status: 503 }))
    );

    await expect(getGoogleStatus()).rejects.toMatchObject({
      name: "ApiError",
      status: 503,
      message: "The upstream service is unavailable",
    });
  });
});
