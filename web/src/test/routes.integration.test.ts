import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("active application routes", () => {
  it("does not render prototype data in the real Friends workspace", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src", "routes", "friends.tsx"),
      "utf8",
    );

    expect(source).not.toContain("mockData");
    expect(source).toContain("FriendsScreen");
  });
});
