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
