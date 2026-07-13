import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFriendRequest, getManualActivity, getPublicProfile, resolveFriendInvite, updateManualActivity } from "./api";

describe("friends API client", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: { getItem: () => "x.eyJleHAiOjQxMDAwMDAwMDB9.x", removeItem: vi.fn() }, dispatchEvent: vi.fn(), atob: globalThis.atob });
  });

  it("posts a nickname friend request with authentication", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "r1" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await createFriendRequest("Player One");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/friends/requests"),
      expect.objectContaining({ method: "POST", headers: expect.any(Headers) })
    );
  });

  it("patches current manual activity", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ current_game: "Hades", recent_games: [] })));
    vi.stubGlobal("fetch", fetchMock);

    await updateManualActivity({ current_game: "Hades", recent_games: [] });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/activity/manual"), expect.objectContaining({ method: "PATCH" }));
  });

  it("sends authentication when loading a public profile so friends-only fields can be returned", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ nickname: "Player One", platforms: [], current_game: null, recent_games: [] })));
    vi.stubGlobal("fetch", fetchMock);

    await getPublicProfile("Player One");

    const [, options] = fetchMock.mock.calls[0];
    expect((options.headers as Headers).get("Authorization")).toBe("Bearer x.eyJleHAiOjQxMDAwMDAwMDB9.x");
  });

  it("loads existing manual activity before saving a replacement payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ current_game: "Hades", recent_games: ["Balatro"] })));
    vi.stubGlobal("fetch", fetchMock);

    await getManualActivity();

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/activity/manual"), expect.objectContaining({ method: "GET" }));
  });

  it("requires authentication to resolve an invite before confirming it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ owner_nickname: "Player One" })));
    vi.stubGlobal("fetch", fetchMock);

    await resolveFriendInvite("token");

    const [, options] = fetchMock.mock.calls[0];
    expect((options.headers as Headers).get("Authorization")).toBe("Bearer x.eyJleHAiOjQxMDAwMDAwMDB9.x");
  });
});
