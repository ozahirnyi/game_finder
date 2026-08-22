import { expect, test, waitForHydration } from "./fixtures/test";
import { signIn } from "./fixtures/auth";

test("friends does not render an empty count while its request is pending", async ({ page, api }) => {
  api.state.delays["/friends"] = 800;
  await signIn(page);
  await page.goto("/friends");
  await expect(page.getByTestId("friends-loading")).toBeVisible();
  await expect(page.getByText("No friends yet")).not.toBeVisible();
  await expect(page.getByText("No friends yet")).toBeVisible();
});

test("failed profile and authenticated 401 preserve a usable application shell", async ({ page, api }) => {
  api.state.statusByPath["/users/missing-player"] = 500;
  await signIn(page);
  await page.goto("/users/missing-player");
  await waitForHydration(page);
  await expect.poll(() => api.requests.some((request) => request.path === "/users/missing-player")).toBe(true);
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();

  api.state.statusByPath["/profile"] = 401;
  await page.goto("/account");
  await waitForHydration(page);
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
});
