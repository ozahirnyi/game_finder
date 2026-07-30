import { describe, expect, it } from "vitest";
import { formatFriendPlaytime } from "./friends.$friendId";

describe("formatFriendPlaytime", () => {
  it("sums Steam minutes and shows whole hours", () => {
    expect(formatFriendPlaytime([{ playtime_forever: 125 }, { playtime_forever: 65 }])).toBe("3h");
  });
});
