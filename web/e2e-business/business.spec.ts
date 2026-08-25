import { expect, test } from "@playwright/test";

const credentials = {
  email: process.env.E2E_FIXTURE_MARA_EMAIL,
  password: process.env.E2E_FIXTURE_MARA_PASSWORD,
};

async function signIn(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/sign-in");
  const emailInput = page.getByPlaceholder("you@example.com");
  const passwordInput = page.getByPlaceholder("••••••••");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await emailInput.fill(email);
    await passwordInput.fill(password);
    await passwordInput.press("Tab");
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

test.beforeAll(() => {
  if (!credentials.email || !credentials.password) {
    throw new Error("Dedicated business-E2E credentials are required");
  }
});

test("a second dedicated account can sign in independently", async ({ browser }) => {
  const email = process.env.E2E_FIXTURE_JONAS_EMAIL;
  const password = process.env.E2E_FIXTURE_JONAS_PASSWORD;
  if (!email || !password) throw new Error("Jonas business-E2E credentials are required");
  const page = await browser.newPage();
  await signIn(page, email, password);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Find your next game" })).toBeVisible();
  await page.close();
});

test("auth state survives reload and a second sign-in", async ({ page }) => {
  await signIn(page, credentials.email!, credentials.password!);
  await expect(page.getByRole("heading", { name: "Your profile" })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/account/);
  await page.getByRole("link", { name: /sign out/i }).click();
  await page.waitForURL(/sign-in/);
  await signIn(page, credentials.email!, credentials.password!);
  await expect(page.getByRole("heading", { name: "Your profile" })).toBeVisible();
});

test("catalog ownership remains after navigation and reload", async ({ page, request }) => {
  const apiBase = process.env.E2E_API_BASE_URL?.trim();
  if (!apiBase) throw new Error("E2E_API_BASE_URL is required for the catalog persistence flow");
  const login = await request.post(`${apiBase}/auth/login`, {
    form: { username: credentials.email!, password: credentials.password! },
  });
  if (!login.ok()) throw new Error(`Catalog flow login failed: ${login.status()}`);
  const { access_token: token } = await login.json();
  const wishlist = await request.post(`${apiBase}/wishlist`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { catalog_game_id: 991002, title: "Signal in the Pines", cover_url: null },
  });
  if (!wishlist.ok() && wishlist.status() !== 409) {
    throw new Error(`Catalog fixture setup failed: ${wishlist.status()} ${await wishlist.text()}`);
  }
  await signIn(page, credentials.email!, credentials.password!);
  await page.goto("/wishlist");
  await expect(page.getByText("Signal in the Pines").first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Signal in the Pines").first()).toBeVisible();
});
