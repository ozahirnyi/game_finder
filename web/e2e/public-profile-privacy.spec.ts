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

test("self and friend profile variants use the same canonical public route", async ({ page, api }) => {
  api.state.publicProfiles["me"] = {
    public_id: "me", nickname: "Player", relationship: "self",
    library: { status: "ready", data: [] }, favorites: { status: "ready", data: [] }, wishlist: { status: "ready", data: [] },
  };
  api.state.publicProfiles["friend"] = {
    public_id: "friend", nickname: "Sam", relationship: "friends",
    library: { status: "ready", data: [] }, favorites: { status: "hidden", data: [] }, wishlist: { status: "hidden", data: [] },
  };
  api.state.friendProfiles.friend = { user: { id: "friend-1", public_id: "friend", display_name: "Sam" }, library: { status: "ready", data: [] } };
  await signIn(page);
  await page.goto("/users/me");
  await expect.poll(() => api.requests.some((request) => request.path === "/users/me")).toBe(true);
  await expect(page.getByRole("heading", { name: "Player" })).toBeVisible();
  await page.goto("/users/friend");
  await expect.poll(() => api.requests.some((request) => request.path === "/users/friend/friend-profile")).toBe(true);
  await expect(page.getByRole("button", { name: "Invite to play" })).toBeVisible();
});
