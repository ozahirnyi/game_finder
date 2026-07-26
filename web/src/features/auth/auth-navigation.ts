const OAUTH_RETURN_TO_KEY = "game_finder_oauth_return_to";
const INTERNAL_ORIGIN = "https://playfinder.invalid";

export function validateInternalReturnTo(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 2048 ||
    value.trim() !== value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return null;
  }

  try {
    const target = new URL(value, INTERNAL_ORIGIN);
    if (target.origin !== INTERNAL_ORIGIN) return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

export function rememberOAuthReturnTo(returnTo: string) {
  if (typeof window === "undefined") return;
  const safeReturnTo = validateInternalReturnTo(returnTo) ?? "/";
  window.sessionStorage.setItem(OAUTH_RETURN_TO_KEY, safeReturnTo);
}

export function consumeOAuthReturnTo(explicitReturnTo?: string) {
  const explicit = validateInternalReturnTo(explicitReturnTo);
  if (typeof window === "undefined") return explicit ?? "/";

  const stored = validateInternalReturnTo(
    window.sessionStorage.getItem(OAUTH_RETURN_TO_KEY),
  );
  window.sessionStorage.removeItem(OAUTH_RETURN_TO_KEY);
  return explicit ?? stored ?? "/";
}
