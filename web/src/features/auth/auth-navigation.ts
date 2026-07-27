const OAUTH_RETURN_TO_KEY = "game_finder_oauth_return_to";
const MESSAGE_DRAFT_PREFIX = "game_finder_message_draft:";
const INTERNAL_ORIGIN = "https://playfinder.invalid";
export const MESSAGE_DRAFT_RESUME_KEY = "resume";

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

function messageDraftStorageKey(friendId: string) {
  return `${MESSAGE_DRAFT_PREFIX}${friendId}`;
}

export function messageDraftResumePath(friendId: string) {
  return `/friends/${encodeURIComponent(friendId)}/messages?draftKey=${MESSAGE_DRAFT_RESUME_KEY}`;
}

export function rememberMessageDraft(friendId: string, draft: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    messageDraftStorageKey(friendId),
    draft.slice(0, 2000),
  );
}

export function consumeMessageDraft(friendId: string, draftKey?: string) {
  if (
    typeof window === "undefined" ||
    draftKey !== MESSAGE_DRAFT_RESUME_KEY
  ) {
    return "";
  }
  const storageKey = messageDraftStorageKey(friendId);
  const draft = window.sessionStorage.getItem(storageKey) ?? "";
  window.sessionStorage.removeItem(storageKey);
  return draft.slice(0, 2000);
}
