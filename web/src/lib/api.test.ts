import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiRequest, clearToken, getToken, loginUser, setToken } from "./api";

describe("apiRequest", () => {
  afterEach(() => {
    clearToken();
    vi.restoreAllMocks();
  });

  it("sends the JWT and clears it after an authenticated 401", async () => {
    setToken("token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "expired" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/games", { auth: true })).rejects.toMatchObject<ApiError>({
      status: 401,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/games",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
    expect(getToken()).toBeNull();
  });

  it("submits login credentials as an OAuth form", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "new-token", token_type: "bearer" }), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(loginUser("player@example.com", "password")).resolves.toMatchObject({
      access_token: "new-token",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/auth/login",
      expect.objectContaining({ method: "POST" }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).body?.toString()).toBe(
      "username=player%40example.com&password=password",
    );
  });
});
