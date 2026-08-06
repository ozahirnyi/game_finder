import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const checkedFiles = [
  "components/AppShell.tsx",
  "routes/search.tsx",
  "routes/games.$gameId.tsx",
  "routes/login.tsx",
  "routes/register.tsx",
];

describe("active application routes", () => {
  it("do not render the prototype mock data", () => {
    for (const file of checkedFiles) {
      const source = readFileSync(
        path.join(process.cwd(), "src", file),
        "utf8",
      );
      expect(source).not.toContain("mockData");
    }
  });
});
