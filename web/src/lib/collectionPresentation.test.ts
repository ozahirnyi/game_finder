import { describe, expect, it } from "vitest";

import { librarySource, libraryPlaytime, wishlistPriceLabel } from "./collectionPresentation";

describe("collection presentation", () => {
  it("normalizes API library sources for the archive tabs", () => {
    expect(librarySource("steam")).toBe("Steam");
    expect(librarySource("psn")).toBe("PlayStation");
  });

  it("formats API playtime as whole hours without decimals", () => {
    expect(libraryPlaytime(125)).toBe("2h");
    expect(libraryPlaytime(120630)).toBe("2010h");
    expect(libraryPlaytime(null)).toBe("—");
  });

  it("formats a current wishlist price and keeps the unavailable state for missing data", () => {
    expect(wishlistPriceLabel({ amount: 19.99, currency: "USD" })).toBe("19.99 USD");
    expect(wishlistPriceLabel()).toBe("Price unavailable");
  });
});
