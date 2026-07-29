import { describe, expect, it } from "vitest";

import { librarySource, libraryPlaytime, wishlistPriceLabel } from "./collectionPresentation";

describe("collection presentation", () => {
  it("normalizes API library sources for the archive tabs", () => {
    expect(librarySource("steam")).toBe("Steam");
    expect(librarySource("psn")).toBe("PlayStation");
  });

  it("formats API playtime minutes without inventing a value", () => {
    expect(libraryPlaytime(125)).toBe("2.1h");
    expect(libraryPlaytime(null)).toBe("—");
  });

  it("keeps the wishlist price card honest when the API has no price", () => {
    expect(wishlistPriceLabel()).toBe("Price unavailable");
  });
});
