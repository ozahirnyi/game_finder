import { describe, expect, it } from "vitest";
import { gameDetailTarget } from "./gameRoute";

describe("gameDetailTarget", () => {
  it("uses the Steam app id and source for a Steam-only game", () => {
    expect(gameDetailTarget(null, 1145360)).toEqual({
      gameId: "1145360",
      source: "steam",
    });
  });

  it("keeps a catalog game on the standard detail route", () => {
    expect(gameDetailTarget(3498, 1145360)).toEqual({ gameId: "3498" });
  });
});
