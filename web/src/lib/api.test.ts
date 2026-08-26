import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  apiRequest,
  clearToken,
  confirmPsnImport,
  createSocialFriendRequest,
  getDashboard,
  getGoogleLoginUrl,
  getFavorites,
  getLibraryOverview,
  getOnboardingSummary,
  getPublicProfile,
  getSteamLinkUrl,
  getAuthSnapshot,
  getToken,
  loginUser,
  previewPsnImport,
  removeFavorite,
  saveCatalogGameToFavorites,
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

    await expect(apiRequest("/games", { auth: true })).rejects.toMatchObject({
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

  it("loads the authenticated dashboard", async () => {
    setToken("token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ recommendations: { status: "empty", data: [] } }), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getDashboard();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/dashboard",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
  });

  it("loads the authenticated onboarding summary", async () => {
    setToken("token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          steam_linked: false,
          psn_library_games: 0,
          wishlist_games: 0,
          price_alerts: 0,
          friends: 0,
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getOnboardingSummary();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/onboarding/summary",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
  });

  it("reads the Steam-aware library overview", async () => {
    setToken("token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ games: [], steam_available: true, steam_error: null }), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getLibraryOverview();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/library/overview",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
  });

  it("uses the existing favorites and public-profile contracts", async () => {
    setToken("token");
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({}), {
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getFavorites();
    await saveCatalogGameToFavorites(274755);
    await removeFavorite(274755);
    await getPublicProfile("player-1");
    await createSocialFriendRequest("player-1");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/favorites",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/favorites/catalog-games/274755",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/favorites/274755",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/users/player-1",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "/api/social/friend-requests",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ public_id: "player-1" }),
      }),
    );
  });

  it("submits a PlayStation file preview and typed catalog/manual selections", async () => {
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
    await confirmPsnImport([{ catalog_id: 101 }, { source_title: "Hades" }]);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/psn/import/preview",
      expect.objectContaining({ body: expect.any(FormData), method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/psn/import/confirm",
      expect.objectContaining({ body: JSON.stringify({ selections: [{ catalog_id: 101 }, { source_title: "Hades" }] }), method: "POST" }),
    );
  });

  it("reports authentication from the stored token", () => {
    expect(getAuthSnapshot()).toBe(false);
    setToken("token");
    expect(getAuthSnapshot()).toBe(true);
  });
});
