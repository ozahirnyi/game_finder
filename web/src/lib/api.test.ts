import { afterEach, describe, expect, it, vi } from "vitest";
import { acceptFriendRequest, declineFriendRequest, getRecommendations, getSocialSnapshot, sendFriendRequest } from "./api";

describe("AI recommendation errors", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the structured API error message for users", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      detail: { code: "ai_recommendations_unavailable", message: "OpenAI is temporarily unavailable." },
    }), { status: 503, headers: { "Content-Type": "application/json" } })));

    await expect(getRecommendations("cozy games")).rejects.toThrow("OpenAI is temporarily unavailable.");
  });
});

describe("social API client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses authenticated social endpoints and encodes request identifiers", async () => {
    window.localStorage.setItem("game_finder_token", "header.eyJleHAiOjQxMDI0NDQ4MDB9.signature");
    const snapshot = { me: { id: "me", display_name: "Me", avatar: null, steam_profile_url: null, steam_add_url: null }, friends: [], incoming_requests: [], outgoing_requests: [], steam_suggestions: [], steam_suggestions_error: null };
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(snapshot), { headers: { "Content-Type": "application/json" } })));
    vi.stubGlobal("fetch", fetchMock);

    await getSocialSnapshot();
    await sendFriendRequest("user / 2");
    await acceptFriendRequest("request / 3");
    await declineFriendRequest("request / 4");

    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining("/social/me"), expect.objectContaining({ method: "GET" }));
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toBeInstanceOf(Headers);
    expect(((fetchMock.mock.calls[0][1] as RequestInit).headers as Headers).get("Authorization")).toBe("Bearer header.eyJleHAiOjQxMDI0NDQ4MDB9.signature");
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining("/social/friend-requests"), expect.objectContaining({ method: "POST", body: JSON.stringify({ recipient_id: "user / 2" }) }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, expect.stringContaining("/social/friend-requests/request%20%2F%203/accept"), expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenNthCalledWith(4, expect.stringContaining("/social/friend-requests/request%20%2F%204/decline"), expect.objectContaining({ method: "POST" }));
  });
});
