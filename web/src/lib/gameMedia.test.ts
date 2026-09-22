import { describe, expect, it } from "vitest";

import { getGameMediaCandidates } from "./gameMedia";

describe("getGameMediaCandidates", () => {
  it("retains the actual Steam store capsule when guessed library assets fail", () => {
    const backgroundUrl =
      "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4358690/hash/capsule_616x353.jpg";
    expect(getGameMediaCandidates({ steamAppId: 4358690, backgroundUrl }, "banner")).toContainEqual(
      { src: backgroundUrl, kind: "wide" },
    );
  });

  it("tries a portrait before a saved Steam header and retains that header as fallback", () => {
    const coverUrl = "https://cdn.cloudflare.steamstatic.com/steam/apps/620/header.jpg";
    const queue = getGameMediaCandidates({ coverUrl }, "poster");
    expect(queue[0].src).toContain("library_600x900.jpg");
    expect(queue.at(-1)).toMatchObject({ src: coverUrl, kind: "wide" });
  });
  it("upgrades known IGDB covers without losing their query string", () => {
    expect(
      getGameMediaCandidates(
        { coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1abc.jpg?token=one" },
        "poster",
      ),
    ).toEqual([
      {
        src: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1abc.jpg?token=one",
        kind: "cover",
        srcSet:
          "https://images.igdb.com/igdb/image/upload/t_cover_big/co1abc.jpg?token=one 264w, https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co1abc.jpg?token=one 528w",
      },
    ]);
  });

  it("keeps non-IGDB URLs unchanged and removes duplicate fallback URLs", () => {
    expect(
      getGameMediaCandidates(
        {
          coverUrl: "https://cdn.example.test/cover.jpg",
          heroUrl: "https://cdn.example.test/cover.jpg",
          screenshotUrl: null,
        },
        "poster",
      ),
    ).toEqual([{ src: "https://cdn.example.test/cover.jpg", kind: "cover" }]);
  });

  it("uses only a positive Steam app id to construct fallback artwork", () => {
    expect(getGameMediaCandidates({ steamAppId: 0 }, "poster")).toEqual([]);
    expect(getGameMediaCandidates({ steamAppId: 620 }, "poster")).toEqual([
      {
        src: "https://cdn.cloudflare.steamstatic.com/steam/apps/620/library_600x900.jpg",
        kind: "cover",
        srcSet:
          "https://cdn.cloudflare.steamstatic.com/steam/apps/620/library_600x900.jpg 300w, https://cdn.cloudflare.steamstatic.com/steam/apps/620/library_600x900_2x.jpg 600w",
      },
      { src: "https://cdn.cloudflare.steamstatic.com/steam/apps/620/header.jpg", kind: "wide" },
    ]);
  });

  it("adds high density candidates to saved Steam covers while preserving query parameters", () => {
    const base = "https://cdn.cloudflare.steamstatic.com/steam/apps/620/library_600x900.jpg?v=1";
    expect(getGameMediaCandidates({ coverUrl: base }, "poster")[0]).toMatchObject({
      src: base,
      srcSet: `${base} 300w, https://cdn.cloudflare.steamstatic.com/steam/apps/620/library_600x900_2x.jpg?v=1 600w`,
    });
  });

  it("does not rewrite unknown hosts", () => {
    for (const coverUrl of ["https://example.test/steam/apps/620/library_600x900.jpg"]) {
      expect(getGameMediaCandidates({ coverUrl }, "poster")[0]).toEqual({
        src: coverUrl,
        kind: "cover",
      });
    }
  });

  it("prefers verified wide media for banners and retains a cover fallback", () => {
    expect(
      getGameMediaCandidates(
        {
          coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1abc.jpg",
          heroUrl: "https://images.igdb.com/igdb/image/upload/t_1080p/ar1abc.jpg",
          heroWidth: 1920,
          heroHeight: 1080,
        },
        "banner",
      ),
    ).toMatchObject([{ kind: "wide", width: 1920, height: 1080 }, { kind: "cover" }]);
  });

  it("uses a verified screenshot when artwork is absent", () => {
    expect(
      getGameMediaCandidates(
        {
          screenshotUrl: "https://images.igdb.com/igdb/image/upload/t_1080p/sc1.jpg",
          screenshotWidth: 1600,
          screenshotHeight: 900,
        },
        "banner",
      ),
    ).toMatchObject([{ kind: "wide", width: 1600, height: 900 }]);
  });
});
