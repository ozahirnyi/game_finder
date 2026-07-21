import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const activeRoutes = [
  "index.tsx", "search.tsx", "games.$gameId.tsx", "library.tsx", "wishlist.tsx",
  "deals.tsx", "friends.tsx", "steam.tsx", "psn.tsx", "profile.tsx",
];

describe("active application routes", () => {
  it("do not render the prototype mock data", () => {
    for (const route of activeRoutes) {
      const source = readFileSync(path.join(process.cwd(), "src", "routes", route), "utf8");
      expect(source).not.toContain("mockData");
    }
  });
});
