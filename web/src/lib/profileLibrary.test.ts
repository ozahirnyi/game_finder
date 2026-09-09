import { describe, expect, it } from "vitest";
import { profileLibraryGames, profileLibraryHours } from "./profileLibrary";

describe("friend library presentation", () => {
  it("uses the detail identity rather than the owner's library UUID", () => {
    const [steam, catalog, unknown] = profileLibraryGames([
      {
        id: "owned-uuid",
        title: "Portal 2",
        source: "steam",
        detail_game_id: "620",
        detail_source: "steam",
      },
      { id: "psn-uuid", title: "Portal 2", source: "psn", detail_game_id: "72" },
      { id: "raw-uuid", title: "Unknown", source: "psn" },
    ]);
    expect(steam.detail).toEqual({ gameId: "620", source: "steam" });
    expect(catalog.detail).toEqual({ gameId: "72" });
    expect(unknown.detail).toBeUndefined();
  });
  it("sums known minutes, distinguishes unknown from zero and labels partial totals", () => {
    expect(profileLibraryHours([{ playtime_forever: 90 }, { playtime_forever: 30 }])).toBe("2h");
    expect(profileLibraryHours([{ playtime_forever: null }])).toBe("—");
    expect(profileLibraryHours([{ playtime_forever: 0 }])).toBe("0m");
    expect(profileLibraryHours([{ playtime_forever: 90 }, {}])).toBe("1h 30m (known)");
  });
});
