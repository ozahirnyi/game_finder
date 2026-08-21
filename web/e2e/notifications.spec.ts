import { expect, test, waitForHydration } from "./fixtures/test";
import { signIn } from "./fixtures/auth";

test("a valid notification deep link marks only its target read", async ({ page, api }) => {
  api.state.notifications = [
    { id: "n-request", type: "friend_request", payload: { from: "Sam", request_id: "request-1" }, created_at: "2026-08-21T00:00:00Z" },
    { id: "n-message", type: "message", payload: { from: "Pat", conversation_id: "missing" }, created_at: "2026-08-21T00:00:00Z" },
  ];
  api.state.incomingFriendRequests = [{ id: "request-1", sender: { id: "friend-1", public_id: "sam", display_name: "Sam" }, recipient: { id: "user-1", public_id: "player", display_name: "Player" }, created_at: "2026-08-21T00:00:00Z" }];
  await signIn(page);
  await page.goto("/account");
  await waitForHydration(page);
  await page.getByText("Friend request", { exact: true }).click();
  await page.waitForURL("**/friends?request=request-1");
  await expect.poll(() => api.requests.filter((request) => request.path === "/notifications/n-request/read").length).toBe(1);
  await expect.poll(() => api.requests.filter((request) => request.path === "/notifications/n-message/read").length).toBe(0);
});

test("malformed notification targets stay unread and show a neutral unavailable message", async ({ page, api }) => {
  api.state.notifications = [{ id: "n-bad", type: "game_invite", payload: {}, created_at: "2026-08-21T00:00:00Z" }];
  await signIn(page);
  await page.goto("/account");
  await waitForHydration(page);
  await page.getByText("Game invite", { exact: true }).click();
  await expect(page.getByRole("status")).toContainText("This notification action is no longer available.");
  await expect.poll(() => api.requests.some((request) => request.path === "/notifications/n-bad/read")).toBe(false);
});

const notificationDestinations = [
  ["friend_request_accepted", "Friend request accepted", { by: "Sam", public_id: "sam-player" }, "**/users/sam-player"],
  ["message", "New message", { from: "Sam", conversation_id: "conversation-1" }, "**/friends?conversation=conversation-1"],
  ["game_invite", "Game invite", { from: "Sam", game_name: "Celeste", invite_id: "invite-1" }, "**/friends?invite=invite-1"],
  ["game_invite_response", "Game invite response", { by: "Sam", invite_id: "invite-1", status: "accepted" }, "**/friends?invite=invite-1"],
  ["price_alert", "Notification", { catalog_game_id: 101, message: "Celeste is discounted" }, "**/games/101"],
];

for (const [type, title, payload, url] of notificationDestinations) {
  test(`${type} deep link uses its canonical destination`, async ({ page, api }) => {
  api.state.notifications = [{ id: "n-target", type, payload, created_at: "2026-08-21T00:00:00Z" }];
  api.state.publicProfiles["sam-player"] = {
    public_id: "sam-player", nickname: "Sam", relationship: "none",
    library: { status: "hidden", data: [] }, favorites: { status: "hidden", data: [] }, wishlist: { status: "hidden", data: [] },
  };
  await signIn(page);
  await page.goto("/account");
  await waitForHydration(page);
  await page.getByText(title, { exact: true }).click();
  await page.waitForURL(url);
  await expect.poll(() => api.requests.some((request) => request.path === "/notifications/n-target/read")).toBe(true);
  });
}
