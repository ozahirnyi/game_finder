import { expect, test, waitForHydration } from "./fixtures/test";
import { signIn } from "./fixtures/auth";

const sam = { id: "friend-1", public_id: "sam-player", display_name: "Sam", bio: null };

test("friend requests post their selected player identity", async ({ page, api }) => {
  api.state.users = [sam];
  await signIn(page);
  await page.goto("/friends");
  await waitForHydration(page);
  await page.getByLabel("Find players").fill("Sa");
  await page.getByRole("button", { name: "Add Sam" }).click();
  await expect.poll(() => api.requests.find((request) => request.path === "/friends/requests")?.jsonBody).toEqual({ recipient_id: "friend-1" });
  await expect(page.getByRole("status")).toContainText("Request sent");
});

test("friend profile message and invite mutations use the canonical friend id and show errors", async ({ page, api }) => {
  api.state.friends = [{ user: sam }];
  api.state.publicProfiles["sam-player"] = {
    public_id: "sam-player", nickname: "Sam", relationship: "friends",
    library: { status: "ready", data: [] }, favorites: { status: "hidden", data: [] }, wishlist: { status: "hidden", data: [] },
  };
  api.state.friendProfiles["sam-player"] = { user: sam, library: { status: "ready", data: [] } };
  api.state.sharedLibraries["friend-1"] = { status: "ready", data: [{ id: "shared-1", title: "Celeste", source: "steam", external_id: "101" }] };
  await signIn(page);
  await page.goto("/users/sam-player?compose=message");
  await waitForHydration(page);
  await expect.poll(() => api.requests.some((request) => request.path === "/users/sam-player/friend-profile")).toBe(true);
  await page.getByLabel("Message text").fill("Want to play?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect.poll(() => api.requests.find((request) => request.method === "POST" && request.path === "/conversations")?.jsonBody).toEqual({ recipient_id: "friend-1" });
  await expect.poll(() => api.requests.find((request) => request.path === "/conversations/conversation-created/messages")?.jsonBody).toEqual({ body: "Want to play?" });

  await page.goto("/users/sam-player?compose=invite");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect.poll(() => api.requests.find((request) => request.method === "POST" && request.path === "/game-invites")?.jsonBody).toEqual({ recipient_id: "friend-1", game_name: "Celeste", source: "steam", external_id: "101" });

  api.state.statusByPath["/conversations"] = 500;
  await page.goto("/users/sam-player?compose=message");
  await waitForHydration(page);
  await page.getByLabel("Message text").fill("Retry me");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("alert")).toContainText("Could not send message.");

  api.state.statusByPath["/game-invites"] = 500;
  await page.goto("/users/sam-player?compose=invite");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page.getByRole("alert")).toContainText("Could not send invite.");
});
