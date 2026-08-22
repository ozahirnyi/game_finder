import type { Page } from "@playwright/test";

// Keep this in sync with TOKEN_KEY in src/lib/api.ts.
export const AUTH_TOKEN_STORAGE_KEY = "game_finder_token";

export function createFutureJwt(claims: Record<string, unknown> = {}) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const exp = Math.floor(Date.now() / 1_000) + 60 * 60;
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ exp, ...claims })}.signature`;
}

export async function signIn(page: Page, claims: Record<string, unknown> = {}) {
  const token = createFutureJwt(claims);
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
    key: AUTH_TOKEN_STORAGE_KEY,
    value: token,
  });
  return token;
}
