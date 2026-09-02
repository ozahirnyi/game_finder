import { describe, expect, it } from "vitest";

import {
  formatCatalogRating,
  formatCatalogReleaseDate,
  presentPriceHistory,
} from "./gamePresentation";

describe("catalog metadata presentation", () => {
  it("rounds ratings to one decimal place with the score scale", () => {
    expect(formatCatalogRating(89.246)).toBe("89.2 / 100");
  });

  it("does not add a trailing decimal to an integer rating", () => {
    expect(formatCatalogRating(89)).toBe("89 / 100");
  });

  it("uses the same unavailable rating copy for missing and invalid values", () => {
    expect(formatCatalogRating(null)).toBe("Not rated yet");
    expect(formatCatalogRating(-1)).toBe("Not rated yet");
  });

  it("formats an ISO calendar date without a timezone shift", () => {
    expect(formatCatalogReleaseDate("2025-09-25")).toBe("25 Sep 2025");
  });

  it("rejects missing and non-ISO release values", () => {
    expect(formatCatalogReleaseDate("17 Sep, 2020")).toBe("Unknown");
    expect(formatCatalogReleaseDate(undefined)).toBe("Unknown");
  });
});

describe("price history presentation", () => {
  it("keeps valid chronological points and supplies concise endpoint labels", () => {
    expect(
      presentPriceHistory([
        { timestamp: "2025-09-25T00:00:00+00:00", price: { amount: 24.99, currency: "USD" } },
        { timestamp: "2025-08-01T00:00:00+00:00", price: { amount: 19.99, currency: "USD" } },
        { timestamp: "not-a-date", price: { amount: 1, currency: "USD" } },
      ]),
    ).toEqual({
      points: [
        { date: "2025-08-01T00:00:00+00:00", price: 19.99 },
        { date: "2025-09-25T00:00:00+00:00", price: 24.99 },
      ],
      labels: ["1 Aug", "25 Sep"],
      historicalLow: 19.99,
    });
  });
});
