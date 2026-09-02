import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("AI search route", () => {
  it("does not render prototype mock data", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src", "routes", "search.tsx"),
      "utf8",
    );

    expect(source).not.toContain("mockData");
  });
});
