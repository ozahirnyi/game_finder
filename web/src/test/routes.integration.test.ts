import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const activeRoutes = [
  "index.tsx", "search.tsx", "games.$gameId.tsx", "library.tsx", "wishlist.tsx",
  "deals.tsx", "friends.tsx", "steam.tsx", "psn.tsx", "profile.tsx",
];

const expectedScreens: Record<string, string> = {
  "index.tsx": "DiscoveryScreen",
  "search.tsx": "SearchScreen",
  "games.$gameId.tsx": "GameDetailScreen",
  "library.tsx": "LibraryScreen",
  "wishlist.tsx": "WishlistScreen",
  "deals.tsx": "DealsScreen",
  "friends.tsx": "FriendsScreen",
  "steam.tsx": "SteamScreen",
  "psn.tsx": "PsnScreen",
  "profile.tsx": "ProfileScreen",
};

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : /\.(?:ts|tsx)$/.test(entry.name) ? [file] : [];
  });
}

describe("active application routes", () => {
  it("do not render the prototype mock data", () => {
    for (const route of activeRoutes) {
      const source = readFileSync(path.join(process.cwd(), "src", "routes", route), "utf8");
      expect(source).not.toContain("mockData");
    }
  });

  it("renders API-backed feature screens from active routes", () => {
    for (const [route, screen] of Object.entries(expectedScreens)) {
      const source = readFileSync(path.join(process.cwd(), "src", "routes", route), "utf8");
      expect(source).toContain(screen);
    }
  });

  it("passes the direct game route parameter to the API-backed detail screen", () => {
    const source = readFileSync(path.join(process.cwd(), "src", "routes", "games.$gameId.tsx"), "utf8");
    expect(source).toContain("Route.useParams()");
    expect(source).toContain("gameId={gameId}");
  });

  it("does not retain Next or inactive app imports in the source tree", () => {
    for (const file of sourceFiles(path.join(process.cwd(), "src"))) {
      expect(readFileSync(file, "utf8")).not.toMatch(/@\/app\/|(?:from|import)\s*["']next(?:\/|["'])/);
    }
  });
});
