import { expect, test, waitForHydration } from "./fixtures/test";
import { signIn } from "./fixtures/auth";

test("canonical public profile renders public data without private library details", async ({ page, api }) => {
  await signIn(page);
  await page.goto("/users/public-player");
  await waitForHydration(page);

  await expect.poll(() => api.requests.some((request) => request.path === "/users/public-player")).toBe(true);
  await expect(page.getByRole("heading", { name: "Public Player" })).toBeVisible();
  await expect(page.getByText("Private title")).not.toBeVisible();
  await expect(page.getByText("Steam · 12")).not.toBeVisible();
});
