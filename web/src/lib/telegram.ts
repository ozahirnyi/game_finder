const TELEGRAM_APP_FALLBACK_DELAY_MS = 1500;

export function telegramAppDeepLink(webUrl: string): string {
  try {
    const url = new URL(webUrl);
    const username = url.pathname.split("/").filter(Boolean);
    const startParameter = url.searchParams.get("start");
    if (
      url.protocol !== "https:" ||
      url.hostname !== "t.me" ||
      username.length !== 1 ||
      !startParameter
    ) {
      return webUrl;
    }

    const query = new URLSearchParams({ domain: username[0], start: startParameter });
    return `tg://resolve?${query.toString()}`;
  } catch {
    return webUrl;
  }
}

export function openTelegramLink(webUrl: string, popup: Window | null): void {
  if (!popup) {
    window.location.assign(webUrl);
    return;
  }

  let handedOffToApp = false;
  const cleanup = () => {
    window.clearTimeout(fallbackTimer);
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    popup.removeEventListener("blur", onBlur);
  };
  const onBlur = () => {
    handedOffToApp = true;
    cleanup();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") onBlur();
  };
  const fallbackTimer = window.setTimeout(() => {
    cleanup();
    if (!handedOffToApp && !popup.closed) popup.location.href = webUrl;
  }, TELEGRAM_APP_FALLBACK_DELAY_MS);

  window.addEventListener("blur", onBlur, { once: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  popup.addEventListener("blur", onBlur, { once: true });
  popup.location.href = telegramAppDeepLink(webUrl);
}
