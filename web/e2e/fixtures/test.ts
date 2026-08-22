import { test as base } from "@playwright/test";
import { installGuestHomeRoutes, type ApiRoutes } from "./routes";
import type { Page } from "@playwright/test";

type Fixtures = { api: ApiRoutes };

export const test = base.extend<Fixtures>({
  api: async ({ page }, provideApi) => {
    await provideApi(await installGuestHomeRoutes(page));
  },
});

export { expect } from "@playwright/test";

export async function waitForHydration(page: Page) {
  await page.waitForFunction(() => !("$_TSR" in window));
}
