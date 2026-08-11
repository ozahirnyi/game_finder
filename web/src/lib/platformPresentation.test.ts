import { describe, expect, it } from "vitest";
import { summarizePlatforms } from "./platformPresentation";

describe("summarizePlatforms", () => {
  it("keeps the first real platform labels and counts the remainder", () => {
    expect(summarizePlatforms(["Windows", "macOS", "Linux", "PlayStation 5"], 3)).toEqual({
      visible: ["Windows", "macOS", "Linux"],
      remainingCount: 1,
    });
  });
});
