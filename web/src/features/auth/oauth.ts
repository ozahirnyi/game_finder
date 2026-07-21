export type OAuthProvider = "google" | "steam";

export function oauthErrorMessage(
  provider: OAuthProvider,
  error: string | undefined,
): string {
  if (provider === "google" && error === "account_already_linked") {
    return "This Google account is already linked to another profile.";
  }
  if (error === "authorization_failed") {
    return `${provider === "google" ? "Google" : "Steam"} sign-in was cancelled.`;
  }
  return `${provider === "google" ? "Google" : "Steam"} sign-in could not be completed. Please try again.`;
}
