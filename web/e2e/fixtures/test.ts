import { test as base } from "@playwright/test";
import { installGuestHomeRoutes, type ApiRoutes } from "./routes";

type Fixtures = { api: ApiRoutes };

export const test = base.extend<Fixtures>({
  api: async ({ page }, use) => {
    await use(await installGuestHomeRoutes(page));
  },
});

export { expect } from "@playwright/test";
