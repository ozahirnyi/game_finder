import { expect, test, waitForHydration } from "./fixtures/test";

test("credentials sign-in posts the form and routes to the account", async ({ page, api }) => {
  await page.goto("/sign-in");
  await waitForHydration(page);
  await page.getByPlaceholder("you@example.com").fill("player@example.com");
  await page.getByPlaceholder("••••••••").fill("correct-horse");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/account");
  await expect.poll(() => api.requests.find((request) => request.path === "/auth/login")?.formBody).toBe("username=player%40example.com&password=correct-horse");
});
