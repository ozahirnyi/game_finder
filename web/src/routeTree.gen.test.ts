import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("generated route tree", () => {
  it("uses portable imports for TanStack Start type registration", () => {
    const routeTree = fs.readFileSync(path.resolve(process.cwd(), "src/routeTree.gen.ts"), "utf8");

    expect(routeTree).not.toMatch(/from ['"]\.\/[A-Z]:\//);
  });
});
