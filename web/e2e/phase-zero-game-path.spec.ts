import { expect, test, waitForHydration } from "./fixtures/test";
import { signIn } from "./fixtures/auth";

test("Steam-only search, wishlist alert, and saved offer stay on the Steam game", async ({
  page,
  api,
}) => {
  const offerId = "123e4567-e89b-12d3-a456-426614174000";
  api.state.searchGames.results = [
    {
      id: null,
      steam_appid: 440,
      source: "steam",
      name: "Team Fortress 2",
      genres: [],
      platforms: ["PC"],
    },
  ];
  await signIn(page);
  await page.goto("/search");
  await waitForHydration(page);
  await page.getByRole("textbox", { name: /search by title/i }).fill("team");
  await page.getByRole("link", { name: /Team Fortress 2/ }).click();
  await page.waitForURL("**/games/440*source=steam*");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Alert" }).click();
  await page.getByRole("button", { name: "Save alert" }).click();
  await expect
    .poll(
      () =>
        api.requests.find(
          (request) => request.path === "/price-alerts" && request.method === "POST",
        )?.jsonBody,
    )
    .toMatchObject({
      wishlist_item_id: "wishlist-440",
      target_discount: 1,
    });

  api.state.notifications = [
    {
      id: offerId,
      type: "price_alert",
      created_at: "2026-10-11T12:00:00Z",
      payload: {
        source: "steam",
        external_id: "440",
        offer: {
          shop: "Demo store",
          price: 9.99,
          currency: "USD",
          discount: 50,
          url: "https://store.example/440",
          observed_at: "2026-10-11T12:00:00Z",
        },
      },
    },
  ];
  await page.goto("/account");
  await waitForHydration(page);
  await page.getByText("Price alert", { exact: true }).click();
  await expect(page).toHaveURL(/\/games\/440\?/);
  expect(new URL(page.url()).searchParams.get("source")).toBe("steam");
  expect(new URL(page.url()).searchParams.get("offer")).toBe(offerId);
  await expect(page.getByRole("region", { name: "Saved price offer" })).toContainText("9.99 USD");
  await expect(page.getByRole("link", { name: "View offer at store" })).toHaveAttribute(
    "href",
    "https://store.example/440",
  );
});

test("owned catalog game shows the library link without wishlist or alert", async ({
  page,
  api,
}) => {
  api.state.library.games = [
    {
      id: "owned-101",
      source: "psn",
      external_id: "psn:celeste",
      catalog_game_id: 101,
      link_state: "linked",
    },
  ];
  await signIn(page);
  await page.goto("/search");
  await waitForHydration(page);
  await page.getByRole("textbox", { name: /search by title/i }).fill("Celeste");
  await page.getByRole("link", { name: /Celeste/ }).click();
  await page.waitForURL("**/games/101*");
  await expect(page.getByText("In your library")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open library" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to wishlist" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Alert" })).toHaveCount(0);
});
