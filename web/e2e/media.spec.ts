import { expect, test } from "./fixtures/test";

// Deliberately visible fixtures make cropping, aspect ratio, and fallback
// screenshots reviewable; they are not stand-ins for production artwork.
const POSTER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="264" height="374" viewBox="0 0 264 374"><rect width="264" height="374" fill="#2157a5"/><rect x="12" y="12" width="240" height="350" fill="none" stroke="#f8c44f" stroke-width="8"/><circle cx="132" cy="187" r="70" fill="#e75d3f"/><text x="132" y="195" text-anchor="middle" fill="white" font-family="sans-serif" font-size="24">POSTER</text><text x="18" y="42" fill="white" font-size="18">TL</text><text x="212" y="350" fill="white" font-size="18">BR</text></svg>`;
const WIDE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="#253349"/><rect x="30" y="30" width="1860" height="1020" fill="none" stroke="#f8c44f" stroke-width="24"/><path d="M0 1080L960 180 1920 1080" fill="#e75d3f"/><text x="960" y="560" text-anchor="middle" fill="white" font-family="sans-serif" font-size="120">WIDE ART</text><text x="80" y="140" fill="white" font-size="72">TOP LEFT</text><text x="1480" y="980" fill="white" font-size="72">BOTTOM RIGHT</text></svg>`;

test("mixed catalog artwork keeps poster geometry and falls back after a 404", async ({
  page,
  api,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  api.state.trendingGames.results = [
    {
      id: 101,
      name: "Cover only",
      cover_image: "https://media.test/cover.jpg",
      genres: [],
      platforms: [],
    },
    {
      id: 102,
      name: "Broken first source",
      cover_image: "https://media.test/broken.jpg",
      genres: [],
      platforms: [],
    },
  ];
  await page.route("https://media.test/**", async (route) => {
    if (route.request().url().endsWith("broken.jpg")) await route.fulfill({ status: 404 });
    else
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: POSTER_SVG,
      });
  });

  await page.goto("/");
  const covers = page.locator('[data-visual-role="card"]');
  await expect(covers.first()).toBeVisible();
  const first = await covers.nth(0).boundingBox();
  const second = await covers.nth(1).boundingBox();
  expect(first?.height).toBeCloseTo((first?.width ?? 0) * 1.5, 0);
  expect(second?.height).toBeCloseTo((second?.width ?? 0) * 1.5, 0);
  await expect(page.getByLabel("Broken first source image unavailable")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("home-mobile-fallback.png"), fullPage: true });
});

test("poster geometry stays stable at tablet and desktop widths", async ({
  page,
  api,
}, testInfo) => {
  api.state.trendingGames.results = [
    {
      id: 101,
      name: "Portrait",
      cover_image: "https://media.test/portrait.svg",
      genres: [],
      platforms: [],
    },
    { id: 102, name: "No artwork", genres: [], platforms: [] },
  ];
  await page.route("https://media.test/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: POSTER_SVG,
    }),
  );

  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const covers = page.locator('[data-visual-role="card"]');
    await expect(covers.first()).toBeVisible();
    const first = await covers.nth(0).boundingBox();
    const second = await covers.nth(1).boundingBox();
    expect(first?.height).toBeCloseTo((first?.width ?? 0) * 1.5, 0);
    expect(second?.height).toBeCloseTo((second?.width ?? 0) * 1.5, 0);
    await page.screenshot({
      path: testInfo.outputPath(`home-${viewport.width}.png`),
      fullPage: true,
    });
  }
});

test("game detail places its heading after, not over, the hero media", async ({
  page,
  api,
}, testInfo) => {
  api.state.trendingGames.results = [
    {
      id: 101,
      name: "Wide game",
      hero_image: "https://media.test/wide.svg",
      hero_width: 1920,
      hero_height: 1080,
      genres: [],
      platforms: [],
    },
  ];
  await page.route("https://media.test/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: WIDE_SVG,
    }),
  );
  await page.route("**/api/catalog/games/101", (route) =>
    route.fulfill({
      json: {
        id: 101,
        name: "Wide game",
        hero_image: "https://media.test/wide.svg",
        hero_width: 1920,
        hero_height: 1080,
        genres: [],
        platforms: [],
        description_raw: "Detail",
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("link", { name: /wide game/i }).click();
  const hero = page.locator('[data-visual-role="hero"]');
  const heading = page.getByRole("heading", { name: "Wide game" });
  await expect(hero).toBeVisible();
  await expect(hero.locator("img")).toHaveClass(/opacity-100/);
  await expect(heading).toBeVisible();
  const heroBox = await hero.boundingBox();
  const headingBox = await heading.boundingBox();
  expect(headingBox?.y).toBeGreaterThanOrEqual((heroBox?.y ?? 0) + (heroBox?.height ?? 0));
  await page.screenshot({ path: testInfo.outputPath("detail-wide.png"), fullPage: true });
});

test("game detail accepts a verified screenshot when no artwork is available", async ({
  page,
  api,
}) => {
  api.state.trendingGames.results = [
    {
      id: 101,
      name: "Screenshot-only game",
      screenshot_image: "https://media.test/screenshot-wide.svg",
      screenshot_width: 1920,
      screenshot_height: 1080,
      genres: [],
      platforms: [],
    },
  ];
  await page.route("https://media.test/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: WIDE_SVG,
    }),
  );
  await page.route("**/api/catalog/games/101", (route) =>
    route.fulfill({
      json: {
        id: 101,
        name: "Screenshot-only game",
        screenshot_image: "https://media.test/screenshot-wide.svg",
        screenshot_width: 1920,
        screenshot_height: 1080,
        genres: [],
        platforms: [],
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("link", { name: /screenshot-only game/i }).click();
  const heroImage = page.locator('[data-visual-role="hero"] img');
  await expect(heroImage).toHaveAttribute("src", "https://media.test/screenshot-wide.svg");
  await expect(heroImage).toHaveClass(/object-cover/);
  await expect(heroImage).toHaveClass(/opacity-100/);
});

test("library and wishlist keep persisted portrait covers contained at their compact size", async ({
  page,
  api,
}, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("game_finder_token", "browser-token"));
  api.state.library = {
    games: [
      {
        id: "library-1",
        source: "steam",
        title: "Library portrait",
        cover_url: "https://media.test/library.svg",
      },
    ],
    steam_available: true,
  } as never;
  api.state.wishlist = [
    {
      id: "wishlist-1",
      catalog_game_id: 101,
      source: "steam",
      external_id: "101",
      title: "Wishlist portrait",
      cover_url: "https://media.test/wishlist.svg",
    },
  ];
  await page.route("**/api/library/overview/page**", (route) =>
    route.fulfill({
      json: {
        ...api.state.library,
        has_more: false,
        raw_count: 0,
        quarantined_count: 0,
        pending_catalog_count: 0,
      },
    }),
  );
  await page.route("**/api/wishlist/page**", (route) =>
    route.fulfill({
      json: { items: api.state.wishlist, total: api.state.wishlist.length, has_more: false },
    }),
  );
  await page.route("https://media.test/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: POSTER_SVG,
    }),
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/library");
  const libraryCover = page.getByRole("img", { name: "Library portrait" });
  await expect(libraryCover).toBeVisible();
  expect(await libraryCover.evaluate((image) => image.classList.contains("object-contain"))).toBe(
    true,
  );
  expect((await libraryCover.boundingBox())?.width).toBeLessThanOrEqual(56);
  await page.screenshot({ path: testInfo.outputPath("library-mobile.png"), fullPage: true });

  await page.goto("/wishlist");
  const wishlistCover = page.getByRole("img", { name: "Wishlist portrait" });
  await expect(wishlistCover).toBeVisible();
  expect(await wishlistCover.evaluate((image) => image.classList.contains("object-contain"))).toBe(
    true,
  );
  expect((await wishlistCover.boundingBox())?.width).toBeLessThanOrEqual(56);
  await page.screenshot({ path: testInfo.outputPath("wishlist-mobile.png"), fullPage: true });
});

test.describe("DPR 2 media", () => {
  test.use({ deviceScaleFactor: 2 });

  for (const failHighResolution of [false, true]) {
    test(`Steam cover selects 2x and handles its failure: ${failHighResolution}`, async ({ page, api }) => {
      const base = "https://cdn.cloudflare.steamstatic.com/steam/apps/620/library_600x900.jpg";
      const high = base.replace(".jpg", "_2x.jpg");
      const requested: string[] = [];
      api.state.trendingGames.results = [{ id: 101, name: "Steam density", cover_image: base, genres: [], platforms: [] }];
      await page.route("https://cdn.cloudflare.steamstatic.com/**", async (route) => {
        requested.push(route.request().url());
        if (failHighResolution && route.request().url() === high) {
          await route.fulfill({ status: 404 });
        } else {
          await route.fulfill({ contentType: "image/svg+xml", body: POSTER_SVG });
        }
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/");
      const img = page.getByRole("img", { name: "Steam density" });
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((el) => {
        const image = el as HTMLImageElement;
        return image.complete && image.naturalWidth > 0 ? image.currentSrc : "";
      })).toBe(failHighResolution ? base : high);
      await expect(img).toHaveCSS("opacity", "1");
      expect(requested).toContain(high);
      if (failHighResolution) {
        await expect(img).not.toHaveAttribute("srcset");
        expect(requested.filter((url) => url === high)).toHaveLength(1);
      }
    });
  }

  test("selects the IGDB 2x poster candidate without widening the CSS slot", async ({
    page,
    api,
  }, testInfo) => {
    api.state.trendingGames.results = [
      {
        id: 101,
        name: "High density cover",
        cover_image: "https://images.igdb.com/igdb/image/upload/t_cover_big/example.jpg",
        genres: [],
        platforms: [],
      },
    ];
    await page.route("https://images.igdb.com/**", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: POSTER_SVG,
      }),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const image = page.getByRole("img", { name: "High density cover" });
    await expect(image).toBeVisible();
    expect(await image.evaluate((element) => (element as HTMLImageElement).currentSrc)).toContain(
      "t_cover_big_2x",
    );
    expect((await image.boundingBox())?.width).toBeLessThanOrEqual(264);
    await page.screenshot({ path: testInfo.outputPath("home-dpr2.png"), fullPage: true });
  });
});

test("deals contain poster-only artwork and recover from a failed wide hero", async ({
  page,
}, testInfo) => {
  await page.route("**/api/prices/genre-deals**", (route) =>
    route.fulfill({
      json: {
        popular: [
          {
            id: 201,
            name: "Poster-only deal",
            cover_image: "https://media.test/deal-poster.svg",
            current: { price: { amount: 10, currency: "USD" } },
          },
          {
            id: 202,
            name: "Hero fallback deal",
            hero_image: "https://media.test/deal-wide-broken.svg",
            hero_width: 1920,
            hero_height: 1080,
            cover_image: "https://media.test/deal-fallback.svg",
            current: { price: { amount: 12, currency: "USD" } },
          },
        ],
        sections: [],
      },
    }),
  );
  await page.route("https://media.test/**", (route) => {
    if (route.request().url().includes("broken")) return route.fulfill({ status: 404 });
    return route.fulfill({
      contentType: "image/svg+xml",
      body: POSTER_SVG,
    });
  });

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/deals");
  const poster = page.getByRole("img", { name: "Poster-only deal" });
  await expect(poster).toBeVisible();
  await expect(poster).toHaveClass(/opacity-100/);
  expect(await poster.evaluate((image) => image.classList.contains("object-contain"))).toBe(true);

  const fallback = page.getByRole("img", { name: "Hero fallback deal" });
  await expect(fallback).toHaveAttribute("src", "https://media.test/deal-fallback.svg");
  await expect(fallback).toHaveClass(/opacity-100/);
  expect(await fallback.evaluate((image) => image.classList.contains("object-contain"))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("deals-fallback.png"), fullPage: true });
});
