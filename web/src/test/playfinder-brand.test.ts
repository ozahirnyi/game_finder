import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const publicFiles = [
  "src/components/AppShell.tsx",
  "src/components/Nav.tsx",
  "src/routes/__root.tsx",
  "src/routes/friends.tsx",
];

describe("PlayFinder public brand", () => {
  it("uses PlayFinder and not the old public brand", () => {
    const source = publicFiles
      .map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))
      .join("\n");

    expect(source).toContain("PlayFinder");
    expect(source).not.toMatch(/GameFinder|Game Finder/);
  });
});
