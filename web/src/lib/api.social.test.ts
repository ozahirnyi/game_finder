import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiMocks } from "@/test/setup";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  createFriendRequest,
  declineFriendRequest,
  getDirectMessages,
  getSocialMe,
  getSocialPlayers,
  getSocialProfile,
  sendDirectMessage,
  updateSocialMe,
} from "./api";

const validToken = "header.eyJleHAiOjQxMDI0NDQ4MDB9.signature";

const player = {
  public_id: "player/id",
  nickname: "PlayerOne",
  avatar: null,
};

const socialRequest = {
  ...player,
  id: "request-id",
  status: "pending",
  created_at: "2026-07-26T12:00:00Z",
};

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("game_finder_token", validToken);
});

describe("social API client", () => {
  it("uses the protected profile and discovery endpoints with encoded parameters", async () => {
    const socialMe = {
      public_id: "me-id",
      nickname: "Me",
      avatar: null,
      friends: [],
      incoming_requests: [],
      outgoing_requests: [],
    };
    const fetchMock = apiMocks.fetch(
      apiMocks.success(socialMe),
      apiMocks.success(socialMe),
      apiMocks.success({ players: [player], next_cursor: "player/id" }),
      apiMocks.success({ ...player, relationship: "none" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getSocialMe();
    await updateSocialMe("  Me  ");
    await getSocialPlayers("co op", "cursor/id");
    await getSocialProfile("player/id");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/\/social\/me$/),
      expect.objectContaining({
        method: "GET",
        headers: expect.any(Headers),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/\/social\/me$/),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ nickname: "  Me  " }),
      }),
    );
    expect(fetchMock.mock.calls[2]?.[0]).toMatch(
      /\/social\/players\?q=co%20op&cursor=cursor%2Fid$/,
    );
    expect(fetchMock.mock.calls[3]?.[0]).toMatch(
      /\/social\/profiles\/player%2Fid$/,
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toSatisfy(
      (headers: Headers) =>
        headers.get("Authorization") === `Bearer ${validToken}`,
    );
  });

  it("covers creating, cancelling, accepting, and declining friend requests", async () => {
    const fetchMock = apiMocks.fetch(
      apiMocks.success(socialRequest, 201),
      apiMocks.success({ ...socialRequest, status: "cancelled" }),
      apiMocks.success({ ...socialRequest, status: "accepted" }),
      apiMocks.success({ ...socialRequest, status: "declined" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createFriendRequest("player/id");
    await cancelFriendRequest("request/id");
    await acceptFriendRequest("request/id");
    await declineFriendRequest("request/id");

    expect(fetchMock.mock.calls[0]?.[0]).toMatch(/\/social\/friend-requests$/);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ public_id: "player/id" }),
      }),
    );
    expect(fetchMock.mock.calls[1]?.[0]).toMatch(
      /\/social\/friend-requests\/request%2Fid$/,
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetchMock.mock.calls[2]?.[0]).toMatch(
      /\/social\/friend-requests\/request%2Fid\/accept$/,
    );
    expect(fetchMock.mock.calls[3]?.[0]).toMatch(
      /\/social\/friend-requests\/request%2Fid\/decline$/,
    );
  });

  it("pages and sends direct messages through the confirmed-friend endpoint", async () => {
    const message = {
      id: "message-id",
      friendship_id: "friendship-id",
      author_id: "author-id",
      text: "Hello",
      created_at: "2026-07-26T12:00:00Z",
    };
    const fetchMock = apiMocks.fetch(
      apiMocks.success({ messages: [message], next_cursor: null }),
      apiMocks.success(message, 201),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getDirectMessages("friend/id", "message/id");
    await sendDirectMessage("friend/id", " Hello ");

    expect(fetchMock.mock.calls[0]?.[0]).toMatch(
      /\/social\/friends\/friend%2Fid\/messages\?cursor=message%2Fid$/,
    );
    expect(fetchMock.mock.calls[1]?.[0]).toMatch(
      /\/social\/friends\/friend%2Fid\/messages$/,
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ text: " Hello " }),
      }),
    );
  });
});
