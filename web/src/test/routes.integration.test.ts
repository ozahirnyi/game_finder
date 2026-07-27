import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const publicRoutes = ["index.tsx"];

describe("active application routes", () => {
  it("does not render prototype mock data on the public homepage", () => {
    for (const route of publicRoutes) {
      const source = readFileSync(
        path.join(process.cwd(), "src", "routes", route),
        "utf8",
      );
      expect(source).not.toContain("mockData");
    }
  });
});
