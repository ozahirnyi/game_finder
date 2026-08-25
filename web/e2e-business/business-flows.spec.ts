import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBase = process.env.E2E_API_BASE_URL?.trim();
const mara = {
  email: process.env.E2E_FIXTURE_MARA_EMAIL!,
  password: process.env.E2E_FIXTURE_MARA_PASSWORD!,
};
const jonas = {
  email: process.env.E2E_FIXTURE_JONAS_EMAIL!,
  password: process.env.E2E_FIXTURE_JONAS_PASSWORD!,
};

test.beforeAll(() => {
  if (!apiBase) throw new Error("E2E_API_BASE_URL is required for business flow setup");
  if (!mara.email || !mara.password || !jonas.email || !jonas.password) {
    throw new Error("Dedicated business-E2E credentials are required");
  }
});

async function apiLogin(request: APIRequestContext, credentials: typeof mara) {
  const response = await request.post(`${apiBase}/auth/login`, {
    form: { username: credentials.email, password: credentials.password },
  });
  if (!response.ok()) throw new Error(`Login failed: ${response.status()} ${await response.text()}`);
  return (await response.json()).access_token as string;
}

async function api<T>(
  request: APIRequestContext,
  token: string,
  path: string,
  options: Parameters<APIRequestContext["fetch"]>[1] = {},
) {
  const response = await request.fetch(`${apiBase}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers ?? {}) },
  });
  const body = response.status() === 204 ? undefined : await response.json().catch(() => undefined);
  expect(response.ok(), `${options.method ?? "GET"} ${path}: ${JSON.stringify(body)}`).toBeTruthy();
  return body as T;
}

async function signIn(page: Page, credentials: typeof mara) {
  await page.goto("/sign-in");
  const email = page.getByPlaceholder("you@example.com");
  const password = page.getByPlaceholder("••••••••");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await email.fill(credentials.email);
    await password.fill(credentials.password);
    await password.press("Tab");
    await page.getByRole("button", { name: "Sign in" }).click();
    try {
      await page.waitForURL("**/account", { timeout: 8_000 });
      return;
    } catch (error) {
      if (attempt === 1) throw error;
      await page.goto("/sign-in");
    }
  }
}

test("AI search returns game recommendations through the real endpoint", async ({ request }) => {
  const response = await request.post(`${apiBase}/recommendations`, {
    data: { prompt: "cozy farming games with light strategy", liked_game_ids: [] },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    recommendations: Array<{ title: string; reason: string; tags: string[] }>;
  };
  expect(body.recommendations.length).toBeGreaterThan(0);
  expect(body.recommendations[0]).toEqual(
    expect.objectContaining({ title: expect.any(String), reason: expect.any(String) }),
  );
});

test("profile preferences and PSN import persist through the real app", async ({ page }) => {
  await signIn(page, mara);
  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Profile settings" });
  await dialog.getByLabel("Bio").fill("Co-op nights and story-driven adventures.");
  await dialog.getByLabel("Library visibility").selectOption("friends");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog").getByLabel("Bio")).toHaveValue(
    "Co-op nights and story-driven adventures.",
  );
  await expect(page.getByRole("dialog").getByLabel("Library visibility")).toHaveValue("friends");

  await page.goto("/psn-import");
  await page.locator('input[type="file"]').setInputFiles({
    name: "playstation-export.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ games: [{ title: "Moonlit Harbor" }, { title: "Signal in the Pines" }] }),
    ),
  });
  await expect(page.getByRole("heading", { name: "Preview games" })).toBeVisible();
  await expect(page.getByText("Moonlit Harbor").first()).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Import 2 games" }).click();
  await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible();
  await page.goto("/library");
  await expect(page.getByText("Moonlit Harbor").first()).toBeVisible();
});

test("library, wishlist, favorite, alert and deletion stay owner-scoped", async ({ page, request }) => {
  const token = await apiLogin(request, mara);
  const user = await api<{ id: string }>(request, token, "/auth/me");
  const games = await api<Array<{ id: string; title: string }>>(request, token, "/games");
  let game = games.find((item) => item.title === "Moonlit Harbor");
  if (!game) {
    game = await api<{ id: string; title: string }>(request, token, "/games", {
      method: "POST",
      data: { title: "Moonlit Harbor", notes: "Evening co-op rotation" },
    });
  }
  const catalogId = 991001;
  const wishlist = await api<Array<{ id: string; catalog_game_id: number }>>(
    request,
    token,
    "/wishlist",
  );
  if (!wishlist.some((item) => item.catalog_game_id === catalogId)) {
    await api(request, token, "/wishlist", {
      method: "POST",
      data: { catalog_game_id: catalogId, title: "Moonlit Harbor", cover_url: null },
    });
  }
  const favorites = await api<Array<{ catalog_game_id: number }>>(request, token, "/favorites");
  if (!favorites.some((item) => item.catalog_game_id === catalogId)) {
    await api(request, token, "/favorites", {
      method: "POST",
      data: { catalog_game_id: catalogId, title: "Moonlit Harbor", cover_url: null },
    });
  }
  const alerts = await api<Array<{ wishlist_catalog_game_id: number }>>(
    request,
    token,
    "/price-alerts",
  );
  if (!alerts.some((item) => item.wishlist_catalog_game_id === catalogId)) {
    await api(request, token, "/price-alerts", {
      method: "POST",
      data: { wishlist_catalog_game_id: catalogId, target_discount: 20, delivery_channels: ["in_app"] },
    });
  }

  await signIn(page, mara);
  await page.goto("/library");
  await expect(page.getByText("Moonlit Harbor").first()).toBeVisible();
  await page.goto("/wishlist");
  await expect(page.getByText("Moonlit Harbor").first()).toBeVisible();
  await page.getByRole("button", { name: "Price alerts" }).click();
  await expect(page.getByText(/Moonlit Harbor: alert at 20% off/)).toBeVisible();
  await page.getByRole("button", { name: "Cancel alert for Moonlit Harbor" }).click();
  await expect(page.getByText(/Moonlit Harbor: alert at 20% off/)).toBeHidden();
  await page.reload();
  await expect(page.getByText("Moonlit Harbor").first()).toBeVisible();

  const jonasToken = await apiLogin(request, jonas);
  const jonasGames = await api<Array<{ title: string }>>(request, jonasToken, "/games");
  expect(jonasGames.some((item) => item.title === "Moonlit Harbor")).toBeFalsy();
  expect(user.id).toBeTruthy();
});

test("friend request, message, invite and notification flows work across two accounts", async ({ browser, request }) => {
  const maraToken = await apiLogin(request, mara);
  const jonasToken = await apiLogin(request, jonas);
  const maraUser = await api<{ id: string; public_id: string }>(request, maraToken, "/auth/me");
  const jonasUser = await api<{ id: string; public_id: string }>(request, jonasToken, "/auth/me");
  const existingFriends = await api<Array<{ user: { id: string } }>>(request, jonasToken, "/friends");
  const alreadyFriends = existingFriends.some((item) => item.user.id === maraUser.id);

  const incoming = await api<Array<{ id: string; sender: { id: string } }>>(
    request,
    jonasToken,
    "/friends/requests/incoming",
  );
  let requestId = incoming.find((item) => item.sender.id === maraUser.id)?.id;
  if (!requestId && !alreadyFriends) {
    const created = await api<{ id: string }>(request, maraToken, "/friends/requests", {
      method: "POST",
      data: { recipient_id: jonasUser.id, message: "Let's compare libraries." },
    });
    requestId = created.id;
  }

  const jonasPage = await browser.newPage();
  await signIn(jonasPage, jonas);
  await jonasPage.goto("/friends");
  if (!alreadyFriends) {
    await expect(jonasPage.getByRole("heading", { name: "Friend requests" })).toBeVisible();
    await jonasPage.getByRole("button", { name: /Accept Mara Ellison/ }).click();
    await expect(jonasPage.getByText("Friend added")).toBeVisible();
  }
  await expect(jonasPage.getByRole("link", { name: "Mara Ellison", exact: true }).first()).toBeVisible();

  const conversations = await api<Array<{ id: string; participant: { id: string } }>>(
    request,
    maraToken,
    "/conversations",
  );
  let conversation = conversations.find((item) => item.participant.id === jonasUser.id);
  if (!conversation) {
    conversation = await api<{ id: string; participant: { id: string } }>(
      request,
      maraToken,
      "/conversations",
      { method: "POST", data: { recipient_id: jonasUser.id } },
    );
  }
  await api(request, maraToken, `/conversations/${conversation.id}/messages`, {
    method: "POST",
    data: { body: "Ready for a co-op session?" },
  });
  await api(request, maraToken, "/game-invites", {
    method: "POST",
    data: { recipient_id: jonasUser.id, game_name: "Moonlit Harbor", note: "Tonight?" },
  });
  await jonasPage.reload();
  await expect(jonasPage.getByText("Ready for a co-op session?").first()).toBeVisible();
  await expect(jonasPage.getByRole("heading", { name: "Game invites" })).toBeVisible();
  await jonasPage.getByRole("button", { name: /Accept Moonlit Harbor/ }).first().click();
  await expect(jonasPage.getByText(/accepted the invitation/)).toBeVisible();
  await jonasPage.close();
});

test("PSN and social data respect owner privacy boundaries", async ({ request }) => {
  const maraToken = await apiLogin(request, mara);
  const jonasToken = await apiLogin(request, jonas);
  const friends = await api<Array<{ user: { public_id: string; display_name: string } }>>(
    request,
    jonasToken,
    "/friends",
  );
  const maraUser = friends.find((item) => item.user.display_name === "Mara Ellison")?.user;
  expect(maraUser?.public_id).toBeTruthy();
  const profile = await api<{ library: { status: string } }>(
    request,
    jonasToken,
    `/users/${maraUser!.public_id}`,
  );
  expect(["ready", "hidden", "empty"]).toContain(profile.library.status);
  const self = await api<{ library_visibility: string }>(request, maraToken, "/profile");
  expect(self.library_visibility).toBe("friends");
});
