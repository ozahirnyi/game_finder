import { describe, expect, it } from "vitest";
import { normalizePlatforms, summarizePlatforms } from "./platformPresentation";

describe("summarizePlatforms", () => {
  it("groups desktop operating systems as PC and keeps consoles specific", () => {
    expect(summarizePlatforms(["Windows", "macOS", "Linux", "PlayStation 5"], 3)).toEqual({
      visible: ["PC", "PlayStation 5"],
      remainingCount: 0,
    });
  });

  it("removes duplicate desktop operating systems before a full display", () => {
    expect(normalizePlatforms(["Windows", "macOS", "Linux", "Xbox Series X|S"])).toEqual([
      "PC",
      "Xbox Series X|S",
    ]);
  });
});
