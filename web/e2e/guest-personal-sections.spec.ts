import { expect, test } from "./fixtures/test";

test("guest chats align with the other personal sections at each page width", async ({ page }) => {
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });

    await page.goto("/library");
    const libraryTitle = page.getByRole("heading", { name: "Library", exact: true });
    await expect(libraryTitle).toBeVisible();
    await libraryTitle.evaluate(async (element) => {
      await Promise.all(
        element
          .closest(".animate-reveal")
          ?.getAnimations()
          .map((animation) => animation.finished) ?? [],
      );
    });
    const libraryTop = (await libraryTitle.boundingBox())?.y;

    await page.goto("/messages");
    const chatsTitle = page.getByRole("heading", { name: "Chats", exact: true });
    await expect(chatsTitle).toBeVisible();
    await chatsTitle.evaluate(async (element) => {
      await Promise.all(
        element
          .closest(".animate-reveal")
          ?.getAnimations()
          .map((animation) => animation.finished) ?? [],
      );
    });
    const chatsTop = (await chatsTitle.boundingBox())?.y;

    expect(libraryTop).toBeDefined();
    expect(chatsTop).toBeDefined();
    expect(Math.abs(chatsTop! - libraryTop!)).toBeLessThanOrEqual(1);
  }
});
