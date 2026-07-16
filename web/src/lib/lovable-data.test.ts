import { describe, expect, it } from "vitest";

import { ApiError, type SavedGame } from "./api";
import { getProtectedState, lovableQueryKeys, toGameCard, toSavedGameCard } from "./lovable-data";

describe("lovable data adapters", () => {
  it("keeps missing catalogue art explicit", () => {
    expect(
      toGameCard({
        id: 1,
        name: "Hades",
        released: null,
        background_image: null,
      }),
    ).toEqual({
      id: "1",
      title: "Hades",
      released: null,
      imageUrl: null,
    });
  });

  it("preserves only saved-game data returned by the API", () => {
    const savedGame: SavedGame = {
      id: "saved-1",
      title: "Celeste",
      notes: null,
      info: null,
      source: "steam",
      external_id: "504230",
      playtime_forever: null,
      playtime_2weeks: null,
      img_icon_url: null,
      synced_at: null,
      created_at: "2026-07-16T00:00:00Z",
    };

    expect(toSavedGameCard(savedGame)).toEqual({
      id: "saved-1",
      title: "Celeste",
      source: "steam",
      notes: null,
      info: null,
      playtimeForever: null,
      playtimeTwoWeeks: null,
      imageUrl: null,
    });
  });
});

describe("protected data state", () => {
  it("maps authentication and Steam connection API errors", () => {
    expect(getProtectedState(new ApiError("Please log in", 401))).toBe("sign-in");
    expect(getProtectedState(new ApiError("Connect Steam first", 409))).toBe("connect-steam");
  });

  it("maps unknown failures to the generic error state", () => {
    expect(getProtectedState(new Error("offline"))).toBe("error");
  });
});

describe("Lovable query keys", () => {
  it("keeps endpoint inputs in stable, route-specific keys", () => {
    expect(lovableQueryKeys.me).toEqual(["auth", "me"]);
    expect(lovableQueryKeys.savedGames).toEqual(["games"]);
    expect(lovableQueryKeys.deals("UA")).toEqual(["deals", "UA"]);
    expect(lovableQueryKeys.steam).toEqual(["steam"]);
    expect(lovableQueryKeys.search("hades")).toEqual(["search", "hades"]);
    expect(lovableQueryKeys.catalogGame("1")).toEqual(["catalog", "game", "1"]);
  });
});
