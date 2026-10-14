import { expect, test } from "./fixtures/test";

test("records an unhandled API request and returns a diagnostic response", async ({
  page,
  api,
}) => {
  await page.goto("/");
  const response = await page.evaluate(async () => {
    const result = await fetch("/api/not-mocked");
    return { status: result.status, body: await result.json() };
  });

  expect(response).toEqual({ status: 501, body: { detail: "Unmocked API request" } });
  expect(api.requests).toEqual(
    expect.arrayContaining([{ method: "GET", path: "/not-mocked", query: "" }]),
  );
});

test("rejects a second price alert for the same wishlist entry", async ({ page, api }) => {
  await page.goto("/");
  const statuses = await page.evaluate(async () => {
    const create = async () => {
      const response = await fetch("/api/price-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wishlist_item_id: "wishlist-101",
          target_discount: 25,
          delivery_channels: ["in_app"],
        }),
      });
      return response.status;
    };
    return [await create(), await create()];
  });

  expect(statuses).toEqual([201, 409]);
  expect(api.state.alerts).toHaveLength(1);
});
