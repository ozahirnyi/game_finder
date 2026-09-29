import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getCatalogGame: vi.fn(),
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
});
