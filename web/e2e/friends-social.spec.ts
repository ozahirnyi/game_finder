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
  await expect
    .poll(() => api.requests.find((request) => request.path === "/friends/requests")?.jsonBody)
    .toEqual({ recipient_id: "friend-1" });
  await expect(page.getByRole("status").filter({ hasText: "Request sent" })).toContainText(
    "Request sent",
  );
});

test("friend profile message and invite mutations use the canonical friend id and show errors", async ({
  page,
  api,
}) => {
  api.state.friends = [{ user: sam }];
  api.state.publicProfiles["sam-player"] = {
    public_id: "sam-player",
    nickname: "Sam",
    relationship: "friends",
    library: { status: "ready", data: [] },
    favorites: { status: "hidden", data: [] },
    wishlist: { status: "hidden", data: [] },
  };
  api.state.friendProfiles["sam-player"] = { user: sam, library: { status: "ready", data: [] } };
  api.state.sharedLibraries["friend-1"] = {
    status: "ready",
    data: [{ id: "shared-1", title: "Celeste", source: "steam", external_id: "101" }],
  };
  await signIn(page);
  await page.goto("/users/sam-player?compose=message");
  await waitForHydration(page);
  await expect
    .poll(() => api.requests.some((request) => request.path === "/users/sam-player/friend-profile"))
    .toBe(true);
  await page.getByLabel("Message text").fill("Want to play?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect
    .poll(
      () =>
        api.requests.find(
          (request) => request.method === "POST" && request.path === "/conversations",
        )?.jsonBody,
    )
    .toEqual({ recipient_id: "friend-1" });
  await expect
    .poll(
      () =>
        api.requests.find(
          (request) =>
            request.method === "POST" &&
            request.path === "/conversations/conversation-created/messages",
        )?.jsonBody,
    )
    .toEqual(
      expect.objectContaining({ body: "Want to play?", client_message_id: expect.any(String) }),
    );

  await page.goto("/users/sam-player?compose=invite");
  await waitForHydration(page);
  await expect(page.getByRole("button", { name: "Send invite" })).toBeEnabled();
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect
    .poll(
      () =>
        api.requests.find(
          (request) => request.method === "POST" && request.path === "/game-invites",
        )?.jsonBody,
    )
    .toEqual({
      recipient_id: "friend-1",
      game_name: "Celeste",
      source: "steam",
      external_id: "101",
    });

  api.state.statusByPath["/conversations"] = 500;
  await page.goto("/users/sam-player?compose=message");
  await waitForHydration(page);
  await expect(page.getByRole("alert")).toContainText("Could not open chat");

  api.state.statusByPath["/game-invites"] = 500;
  await page.goto("/users/sam-player?compose=invite");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page.getByRole("alert")).toContainText("Could not send invite.");
});

test("answering a chat invitation updates its card without reloading", async ({ page, api }) => {
  api.state.conversations = [
    {
      id: "conversation-1",
      participant: sam,
      updated_at: "2026-08-21T00:00:00Z",
    },
  ];
  api.state.messages["conversation-1"] = [
    {
      id: "message-1",
      sender_id: sam.id,
      body: "Game invitation: Celeste",
      kind: "game_invite",
      created_at: "2026-08-21T00:00:00Z",
      game_invite: {
        id: "invite-1",
        game_name: "Celeste",
        status: "pending",
        sender_id: sam.id,
        sender_name: sam.display_name,
        recipient_id: "user-1",
        recipient_name: "Player",
      },
    },
  ];
  api.state.gameInvites = [
    {
      id: "invite-1",
      sender: sam,
      recipient: { id: "user-1", public_id: "player", display_name: "Player" },
      game_name: "Celeste",
      status: "pending",
      created_at: "2026-08-21T00:00:00Z",
    },
  ];
  await signIn(page);
  await page.goto("/messages/conversation-1");
  await waitForHydration(page);

  await expect(page.getByText("Pending", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Accept" }).click();

  await expect(page.getByText("Accepted", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Decline" })).toHaveCount(0);
  expect(
    api.requests.find((request) => request.path === "/game-invites/invite-1/response")?.jsonBody,
  ).toEqual({ status: "accepted" });
});

test("sender sees a response message and updated invitation card", async ({ page, api }) => {
  api.state.conversations = [
    { id: "conversation-1", participant: sam, updated_at: "2026-08-21T00:00:00Z" },
  ];
  api.state.messages["conversation-1"] = [
    {
      id: "message-1",
      sender_id: "user-1",
      body: "Game invitation: Celeste",
      kind: "game_invite",
      created_at: "2026-08-21T00:00:00Z",
      game_invite: {
        id: "invite-1",
        game_name: "Celeste",
        status: "pending",
        sender_id: "user-1",
        sender_name: "Player",
        recipient_id: sam.id,
        recipient_name: sam.display_name,
      },
    },
  ];
  api.state.gameInvites = [
    {
      id: "invite-1",
      sender: { id: "user-1", public_id: "player", display_name: "Player" },
      recipient: sam,
      game_name: "Celeste",
      status: "pending",
      created_at: "2026-08-21T00:00:00Z",
    },
  ];
  await signIn(page);
  await page.goto("/messages/conversation-1");
  await waitForHydration(page);
  const card = page.locator("article").filter({ hasText: "Game invite" });
  await expect(card).toContainText("Pending");
  await expect(card).toHaveClass(/ml-auto/);
  await expect(page.getByRole("button", { name: "Accept" })).toHaveCount(0);

  api.state.gameInvites[0].status = "accepted";
  api.state.messages["conversation-1"].push({
    id: "response-message",
    sender_id: sam.id,
    body: "Sam accepted the invitation to Celeste.",
    kind: "system",
    created_at: "2026-08-21T00:01:00Z",
  });

  await expect(page.getByText("Sam accepted the invitation to Celeste.")).toBeVisible();
  await expect(card).toContainText("Accepted");
  await expect
    .poll(() => api.requests.some((request) => request.path === "/game-invites/invite-1"))
    .toBe(true);
});
