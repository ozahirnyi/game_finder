import { describe, expect, it } from "vitest";
import { oauthErrorMessage } from "@/features/auth/oauth";

describe("oauthErrorMessage", () => {
  it("explains when a Google account belongs to a different profile", () => {
    expect(oauthErrorMessage("google", "account_already_linked")).toBe(
      "This Google account is already linked to another profile.",
    );
  });

  it("does not expose provider failure details", () => {
    expect(oauthErrorMessage("steam", "authentication_failed")).toBe(
      "Steam sign-in could not be completed. Please try again.",
    );
  });
});
