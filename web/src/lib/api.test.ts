import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFriendRequest, updateManualActivity } from "./api";

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
});
