import { describe, expect, it } from "vitest";
import {
  FALLBACK_REGION,
  countryFromLanguage,
  shouldFallbackToUsd,
} from "./region";

describe("homepage region", () => {
  it("uses the locale country portion when it is a two-letter code", () => {
    expect(countryFromLanguage("uk-UA")).toBe("UA");
  });

  it("falls back to US for language-only or malformed locale values", () => {
    expect(countryFromLanguage("uk")).toBe(FALLBACK_REGION);
    expect(countryFromLanguage("not_a_locale")).toBe(FALLBACK_REGION);
  });

  it("does not repeat the USD fallback request", () => {
    expect(shouldFallbackToUsd("UA")).toBe(true);
    expect(shouldFallbackToUsd("US")).toBe(false);
  });
});
