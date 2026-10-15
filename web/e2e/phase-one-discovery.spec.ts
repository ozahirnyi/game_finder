import { expect, test, waitForHydration } from "./fixtures/test";
import { signIn } from "./fixtures/auth";

test("home exposes explicit AI search without submitting a request", async ({ page, api }) => {
  await page.goto("/");
  await waitForHydration(page);
  await page.getByRole("link", { name: "Find a game with AI" }).click();
  await expect(page).toHaveURL(/mode=ai/);
  await expect(page.getByRole("button", { name: "Ask AI" })).toBeVisible();
  expect(
    api.requests.some(
      (request) => request.path === "/recommendations" && request.method === "POST",
    ),
  ).toBe(false);
});

test("AI search submits only the entered request and opens a verified result", async ({
  page,
  api,
}) => {
  await signIn(page);
  let submitted: unknown;
  await page.route("**/api/recommendations/quota", (route) =>
    route.fulfill({ json: { limit: 10, remaining: 10, cooldown_until: null } }),
  );
  await page.route("**/api/recommendations", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: { id: "ai-phase-one", status: "queued" } });
  });
  await page.route("**/api/background-jobs/ai-phase-one", (route) =>
    route.fulfill({
      json: {
        id: "ai-phase-one",
        status: "succeeded",
        result: {
          recommendations: [
            {
              title: "Celeste",
              reason: "Matches your request",
              tags: [],
              game: { id: 101, name: "Celeste", platforms: ["PC"] },
            },
          ],
        },
      },
    }),
  );
  await page.goto("/search?mode=ai");
  await waitForHydration(page);
  await page
    .getByRole("textbox", { name: /Describe what you want to play/i })
    .fill("A challenging platformer for tonight");
  await page.getByRole("button", { name: "Ask AI", exact: true }).click();
  await expect(page.getByText("Matches your request")).toBeVisible();
  expect(submitted).toEqual({ prompt: "A challenging platformer for tonight", liked_game_ids: [] });
  await page.getByRole("link", { name: /Celeste/ }).click();
  await expect(page).toHaveURL(/\/games\/101\?/);
});

test("multiple search families survive refresh and a real game detail return", async ({
  page,
  api,
}) => {
  await page.goto("/search?q=Celeste&platform=playstation&platform=xbox&feature=co_op&genre=rpg");
  await waitForHydration(page);
  await expect(page.getByRole("button", { name: "PlayStation", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Xbox", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.reload();
  await waitForHydration(page);
  await page.getByRole("link", { name: /Celeste/ }).click();
  await page.waitForURL("**/games/101*");
  await page.getByRole("link", { name: /Back/ }).first().click();
  await expect(page.getByRole("button", { name: "PlayStation", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Xbox", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    api.requests
      .filter((request) => request.path === "/search/games")
      .some((request) => new URLSearchParams(request.query).getAll("platform").length === 2),
  ).toBe(true);
});

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`library guidance opens PlayStation without matching at ${viewport.width}px`, async ({
    page,
    api,
  }) => {
    await page.setViewportSize(viewport);
    await signIn(page);
    api.state.library.games = [
      { id: "import-101", title: "Imported game", source: "psn", link_state: "raw" },
    ];
    await page.route("**/api/library/overview/page*", (route) =>
      route.fulfill({
        json: { ...api.state.library, total: 1, has_more: false },
      }),
    );
    await page.goto("/library");
    await waitForHydration(page);
    await expect(page.getByRole("heading", { name: "Imported game" })).toBeVisible();
    const guidance = page.getByRole("region", { name: "PlayStation game details" });
    await expect(guidance).toBeVisible();
    await expect(guidance).toContainText("Match PlayStation games");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: `../.superpowers/sdd/library-guidance-${viewport.width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Open PlayStation library" }).click();
    await expect(page.getByRole("button", { name: "Match PlayStation games" })).toBeVisible();
    await expect(guidance).toHaveCount(0);
    expect(
      api.requests.some((request) => request.path.startsWith("/library/catalog-matches/")),
    ).toBe(false);
    await page.getByRole("button", { name: "Steam", exact: true }).click();
    await expect(guidance).toHaveCount(0);
    await page.getByRole("button", { name: "All games", exact: true }).click();
    await expect(guidance).toBeVisible();
  });

  test(`mass matching confirms and corrects inside PlayStation at ${viewport.width}px`, async ({
    page,
    api,
  }) => {
    await page.setViewportSize(viewport);
    await signIn(page);
    let linked = false;
    let applies = 0;
    api.state.library.games = [
      { id: "raw-101", title: "Исходное название", source: "psn", link_state: "raw" },
    ];
    await page.route("**/api/library/overview/page*", (route) =>
      route.fulfill({ json: { games: [], steam_available: false, total: 0, has_more: false } }),
    );
    await page.route("**/api/psn/catalog-enrichment/current", (route) =>
      route.fulfill({ status: 404, json: { detail: "No active job" } }),
    );
    await page.route("**/api/library/catalog-matches/preview*", (route) =>
      route.fulfill({
        json: {
          items: [
            {
              game_id: "raw-101",
              title: "Исходное название",
              source: "psn",
              link_state: linked ? "linked" : "raw",
              catalog_game_id: linked ? 101 : null,
              status: "review",
              suggestions: [
                { id: 101, title: "Celeste", confidence: "likely", platforms: ["PlayStation 4"] },
              ],
            },
          ],
        },
      }),
    );
    await page.route("**/api/library/catalog-matches/apply", async (route) => {
      applies += 1;
      const decisions = route.request().postDataJSON().decisions;
      linked = decisions[0].action === "link";
      api.state.library.games = linked
        ? [{ id: "raw-101", source: "psn", catalog_game_id: 101, link_state: "linked" }]
        : [];
      await route.fulfill({ json: { updated: 1 } });
    });
    await page.goto("/library");
    await waitForHydration(page);
    await expect(
      page.getByRole("button", { name: "Match PlayStation games", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "PlayStation", exact: true }).click();
    await page.getByRole("button", { name: "Match PlayStation games", exact: true }).click();
    await page.getByRole("button", { name: "Find catalog matches", exact: true }).click();
    await page.getByRole("button", { name: "Select all matches (including uncertain)" }).click();
    await page.getByRole("button", { name: "Apply selected (1)" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("1 uncertain match");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: `../.superpowers/sdd/phase-one-match-${viewport.width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(applies).toBe(0);
    await page.getByRole("button", { name: "Apply selected (1)" }).click();
    await page.getByRole("button", { name: "Confirm selected matches" }).click();
    await expect(page.getByRole("status")).toContainText("Updated 1 library entries");
    expect(linked).toBe(true);
    await page.getByRole("button", { name: "All games", exact: true }).click();
    await expect(page.getByRole("region", { name: "PlayStation game details" })).toHaveCount(0);
    await page.getByRole("button", { name: "PlayStation", exact: true }).click();
    await page.getByRole("button", { name: "Match PlayStation games", exact: true }).click();
    await page.getByRole("checkbox", { name: "Include linked entries for correction" }).check();
    await page.getByRole("button", { name: "Find catalog matches", exact: true }).click();
    await page.getByRole("button", { name: "Remove link for Исходное название" }).click();
    await page.getByRole("button", { name: "Apply selected (1)" }).click();
    await expect.poll(() => applies).toBe(2);
    expect(linked).toBe(false);
    await page.getByRole("button", { name: "All games", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Find catalog matches", exact: true }),
    ).toHaveCount(0);
  });
}

test("deals show PlayStation ownership and save a Steam-only offer to wishlist", async ({
  page,
  api,
}) => {
  await signIn(page);
  api.state.wishlist = [];
  api.state.library.games = [
    { id: "owned-101", source: "psn", catalog_game_id: 101, link_state: "linked" },
  ];
  await page.route("**/api/prices/genre-deals", (route) =>
    route.fulfill({
      json: {
        popular: [
          { id: 101, steam_appid: 999, name: "Celeste" },
          { id: null, steam_appid: 620, name: "Portal 2" },
        ],
        sections: [],
      },
    }),
  );
  let saved = 0;
  await page.route("**/api/wishlist/steam-games/620", async (route) => {
    saved += 1;
    const item = {
      id: "wish-620",
      source: "steam",
      external_id: "620",
      catalog_game_id: 620,
      title: "Portal 2",
    };
    api.state.wishlist.push(item);
    await route.fulfill({ json: item });
  });
  await page.goto("/deals");
  await waitForHydration(page);
  await expect(page.getByText("In your library · PlayStation")).toBeVisible();
  await page.getByRole("button", { name: "Add Portal 2 to wishlist" }).click();
  await expect(page.getByText("In your wishlist")).toBeVisible();
  expect(saved).toBe(1);
  await page.screenshot({ path: "../.superpowers/sdd/phase-one-deals.png", fullPage: true });
  await expect(page.getByRole("link", { name: "Open Portal 2 on Playfinder" })).toHaveAttribute(
    "href",
    /source=steam/,
  );
});
