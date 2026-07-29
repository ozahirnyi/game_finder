import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  apiRequest,
  clearToken,
  confirmPsnImport,
  getGoogleLoginUrl,
  getSteamLinkUrl,
  getAuthSnapshot,
  getToken,
  loginUser,
  previewPsnImport,
  setToken,
  syncSteamLibrary,
} from "./api";

describe("apiRequest", () => {
  afterEach(() => {
    clearToken();
    vi.restoreAllMocks();
  });

  it("uses the same-origin API proxy when no public API URL is configured", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({}), { headers: { "content-type": "application/json" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/catalog/trending-games");

    expect(fetchMock).toHaveBeenCalledWith("/api/catalog/trending-games", expect.any(Object));
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
      "/api/games",
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
      "/api/auth/login",
      expect.objectContaining({ method: "POST" }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).body?.toString()).toBe(
      "username=player%40example.com&password=password",
    );
  });

  it("uses the authenticated integration endpoints", async () => {
    setToken("token");
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ url: "https://provider.example.test" }), {
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getGoogleLoginUrl();
    await getSteamLinkUrl();
    await syncSteamLibrary();

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/auth/google/login-url", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/steam/login-url",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/steam/library/sync",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("submits a PlayStation file preview and selected titles", async () => {
    setToken("token");
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ games: [], total: 0 }), {
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["title"], "library.csv", { type: "text/csv" });

    await previewPsnImport(file);
    await confirmPsnImport(["Hades"]);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/psn/import/preview",
      expect.objectContaining({ body: expect.any(FormData), method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/psn/import/confirm",
      expect.objectContaining({ body: JSON.stringify({ games: ["Hades"] }), method: "POST" }),
    );
  });

  it("reports authentication from the stored token", () => {
    expect(getAuthSnapshot()).toBe(false);
    setToken("token");
    expect(getAuthSnapshot()).toBe(true);
  });
});
