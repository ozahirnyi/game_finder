import { expect, test } from "./fixtures/test";

test("guest discovery links catalog and Steam search results to their truthful detail targets", async ({
  page,
  api,
}) => {
  api.state.searchGames.results = [
    { id: 101, name: "Celeste", genres: ["Platformer"], platforms: ["PC"] },
    {
      id: null,
      steam_appid: 440,
      source: "steam",
      name: "Team Fortress 2",
      genres: [],
      platforms: ["PC"],
    },
  ];

  await page.goto("/");
  await page.getByPlaceholder("Search games by title").fill("team");
  await page.getByRole("button", { name: "Search games" }).click();
  await page.waitForURL("/search?q=team");

  await expect
    .poll(() => api.requests.some((request) => request.path === "/search/games"))
    .toBe(true);

  await expect(page.getByRole("link", { name: /Celeste/ })).toHaveAttribute(
    "href",
    "/games/101?title=Celeste",
  );
  await expect(page.getByRole("link", { name: /Team Fortress 2/ })).toHaveAttribute(
    "href",
    "/games/440?title=Team+Fortress+2&source=steam",
  );
});

test("guest discovery makes empty and failed catalog states truthful and retryable", async ({
  page,
  api,
}) => {
  api.state.trendingGames = { results: [] };
  api.state.trendingFailureCount = 4;
  await page.goto("/");
  await expect(page.getByText("Popular games are unavailable.")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Retry popular games" }).click();
  await expect(page.getByText("No popular games are available right now.")).toBeVisible();
});
