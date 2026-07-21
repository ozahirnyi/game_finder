import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const activeRoutes = [
  "index.tsx",
  "search.tsx",
  "games.$gameId.tsx",
  "library.tsx",
  "wishlist.tsx",
  "deals.tsx",
  "friends.tsx",
  "steam.tsx",
  "psn.tsx",
  "profile.tsx",
];

const requiredRegisteredPaths = [
  "/login",
  "/register",
  "/auth/callback",
  "/favorites/$id",
];

describe("active application routes", () => {
  it("declares a TanStack file route for every active route module", () => {
    for (const route of activeRoutes) {
      const source = readFileSync(
        path.join(process.cwd(), "src", "routes", route),
        "utf8",
      );
      expect(source).toContain("createFileRoute(");
    }
  });

  it("registers migrated destinations in the generated route tree", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src", "routeTree.gen.ts"),
      "utf8",
    );

    for (const routePath of requiredRegisteredPaths) {
      expect(source).toContain(`'${routePath}': typeof`);
    }
  });
});
