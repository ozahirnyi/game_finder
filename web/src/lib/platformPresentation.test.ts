import { describe, expect, it } from "vitest";
import { summarizePlatforms } from "./platformPresentation";

describe("summarizePlatforms", () => {
  it("groups desktop operating systems as PC and keeps consoles specific", () => {
    expect(summarizePlatforms(["Windows", "macOS", "Linux", "PlayStation 5"], 3)).toEqual({
      visible: ["PC", "PlayStation 5"],
      remainingCount: 0,
    });
  });
});
