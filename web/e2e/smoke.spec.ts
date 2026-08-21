import { expect, test } from "./fixtures/test";

test("guest home renders fixture data without live API calls", async ({ page, api }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Find your next game" })).toBeVisible();
  await expect.poll(() => api.requests).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        method: "GET",
        path: "/catalog/trending-games",
        query: "page_size=12",
      }),
      expect.objectContaining({ method: "GET", path: "/prices/deals", query: "country=US&page_size=13" }),
    ]),
  );
});
