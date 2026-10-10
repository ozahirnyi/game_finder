import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getCatalogGame: vi.fn(),
  getSteamGame: vi.fn(),
  searchGames: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  ...api,
}));

import { Route } from "./games.$gameId";

async function loadGame(gameId: string, title: string) {
  const loader = Route.options.loader as unknown as (
    options: never,
  ) => Promise<{ game: { title: string } }>;
  return loader({
    params: { gameId },
    deps: { title, source: undefined },
  } as never);
}

describe("game detail loader", () => {
  afterEach(() => vi.clearAllMocks());

  it.each([
    ["81085", "DARK SOULS™: REMASTERED", "Dark Souls: Remastered"],
    ["277143", "The Last of Us™ Part II Remastered", "The Last of Us Part II Remastered"],
  ])(
    "accepts catalog ID %s when the display title has a trademark variation",
    async (id, title, name) => {
      api.getCatalogGame.mockResolvedValue({ id: Number(id), name });

      const result = await loadGame(id, title);

      expect(result?.game.title).toBe(name);
      expect(api.searchGames).not.toHaveBeenCalled();
    },
  );

  it("does not substitute a different catalog game for a stale ID", async () => {
    api.getCatalogGame.mockResolvedValue({ id: 99, name: "Hades" });
    await expect(loadGame("42", "Hades")).rejects.toBeTruthy();
    expect(api.searchGames).not.toHaveBeenCalled();
  });

  it("keeps the Steam route when its suggested catalog ID resolves to another game", async () => {
    api.getSteamGame.mockResolvedValue({
      appid: 440,
      name: "Team Fortress 2",
      catalog_game_id: 101,
      genres: [],
      platforms: ["PC"],
    });
    api.getCatalogGame.mockResolvedValue({ id: 999, name: "Different game" });
    const loader = Route.options.loader as unknown as (options: never) => Promise<{
      game: { id: string; title: string; isSteamLibrary: boolean };
    }>;
    const result = await loader({ params: { gameId: "440" }, deps: { source: "steam" } } as never);
    expect(result.game).toMatchObject({
      id: "440",
      title: "Team Fortress 2",
      isSteamLibrary: true,
    });
  });
});
