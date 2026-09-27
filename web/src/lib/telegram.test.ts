import { describe, expect, it, vi } from "vitest";
import { openTelegramLink, telegramAppDeepLink } from "./telegram";

describe("telegramAppDeepLink", () => {
  it("converts a Telegram web start link into a native app link", () => {
    expect(telegramAppDeepLink("https://t.me/playfinder_alerts_bot?start=token_123-abc")).toBe(
      "tg://resolve?domain=playfinder_alerts_bot&start=token_123-abc",
    );
  });

  it("leaves non bot links unchanged", () => {
    expect(telegramAppDeepLink("https://example.com/account")).toBe("https://example.com/account");
    expect(telegramAppDeepLink("https://t.me/playfinder_alerts_bot")).toBe(
      "https://t.me/playfinder_alerts_bot",
    );
  });

  it("falls back to the web link if the app does not take focus", () => {
    vi.useFakeTimers();
    const popup = Object.assign(new EventTarget(), {
      location: { href: "about:blank" },
      closed: false,
    }) as unknown as Window;

    openTelegramLink("https://t.me/playfinder_alerts_bot?start=token_123-abc", popup);

    expect(popup.location.href).toBe(
      "tg://resolve?domain=playfinder_alerts_bot&start=token_123-abc",
    );
    vi.advanceTimersByTime(1500);
    expect(popup.location.href).toBe("https://t.me/playfinder_alerts_bot?start=token_123-abc");
    vi.useRealTimers();
  });

  it("does not replace the native link when Telegram takes focus", () => {
    vi.useFakeTimers();
    const popup = Object.assign(new EventTarget(), {
      location: { href: "about:blank" },
      closed: false,
    }) as unknown as Window;

    openTelegramLink("https://t.me/playfinder_alerts_bot?start=token_123-abc", popup);

    popup.dispatchEvent(new Event("blur"));
    vi.advanceTimersByTime(1500);
    expect(popup.location.href).toBe(
      "tg://resolve?domain=playfinder_alerts_bot&start=token_123-abc",
    );
    vi.useRealTimers();
  });
});
