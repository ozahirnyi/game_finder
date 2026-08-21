import { expect, test, waitForHydration } from "./fixtures/test";
import { signIn } from "./fixtures/auth";

test("wishlist alert saves the Any discount payload and refreshes visible alerts", async ({ page, api }) => {
  await signIn(page);
  await page.goto("/");
  await waitForHydration(page);
  await page.getByRole("link", { name: "Wishlist" }).first().click();
  await page.waitForURL("**/wishlist");
  await waitForHydration(page);
  await expect.poll(() => api.requests.some((request) => request.path === "/wishlist")).toBe(true);
  await expect(page.getByRole("button", { name: "Price alerts" })).toBeEnabled();
  await page.getByRole("button", { name: "Price alerts" }).click();
  await expect(page.getByText("Telegram delivery is not configured.")).toBeVisible();
  await page.getByRole("button", { name: "Save alert" }).click();
  await expect.poll(() => api.requests.find((request) => request.path === "/price-alerts" && request.method === "POST")?.jsonBody).toEqual({ wishlist_catalog_game_id: 101, target_discount: 1, delivery_channels: ["in_app"] });
  await expect(page.getByText("Celeste: any discount")).toBeVisible();
});

test("wishlist alert sends exact target price and target discount payloads", async ({ page, api }) => {
  await signIn(page);
  await page.goto("/");
  await waitForHydration(page);
  await page.getByRole("link", { name: "Wishlist" }).first().click();
  await page.waitForURL("**/wishlist");
  await waitForHydration(page);
  await expect(page.getByRole("button", { name: "Price alerts" })).toBeEnabled();
  await page.getByRole("button", { name: "Price alerts" }).click();

  await page.getByRole("radio", { name: "Target price" }).check();
  await page.getByRole("spinbutton", { name: "Price" }).fill("19.99");
  await page.getByRole("button", { name: "Save alert" }).click();
  await expect.poll(() => api.requests.filter((request) => request.path === "/price-alerts" && request.method === "POST").at(-1)?.jsonBody).toEqual({ wishlist_catalog_game_id: 101, target_price: 19.99, delivery_channels: ["in_app"] });

  await page.getByRole("radio", { name: "Target discount" }).check();
  await page.getByRole("spinbutton", { name: "Discount" }).fill("35");
  await page.getByRole("button", { name: "Save alert" }).click();
  await expect.poll(() => api.requests.filter((request) => request.path === "/price-alerts" && request.method === "POST").at(-1)?.jsonBody).toEqual({ wishlist_catalog_game_id: 101, target_discount: 35, delivery_channels: ["in_app"] });
  await expect(page.getByText("Celeste: alert below 19.99")).toBeVisible();
  await expect(page.getByText("Celeste: alert at 35% off")).toBeVisible();
});
