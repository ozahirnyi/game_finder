import { describe, expect, it } from "vitest";

import {
  formatCatalogRating,
  formatCatalogReleaseDate,
  hasRenderablePriceHistory,
  presentPriceHistory,
  shouldRenderPriceHistory,
} from "./gamePresentation";
import { hasCatalogId } from "./catalogMatch";

describe("catalog metadata presentation", () => {
  it("accepts only catalog games with a verified numeric ID", () => {
    expect(hasCatalogId({ id: 274755, name: "Hades" })).toBe(true);
    expect(hasCatalogId({ id: null, name: "Coverless result" })).toBe(false);
  });

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
  it("hides price history only for free games", () => {
    expect(shouldRenderPriceHistory(true)).toBe(false);
    expect(shouldRenderPriceHistory(false)).toBe(true);
  });

  it("shows the price-history section only when there are historical points", () => {
    expect(hasRenderablePriceHistory([])).toBe(false);
    expect(
      hasRenderablePriceHistory([
        { timestamp: "2025-09-25T00:00:00+00:00", price: { amount: 0, currency: "USD" } },
      ]),
    ).toBe(true);
  });

  it("keeps valid chronological points with source currencies and concise endpoint labels", () => {
    expect(
      presentPriceHistory([
        { timestamp: "2025-09-25T00:00:00+00:00", price: { amount: 24.99, currency: "USD" } },
        { timestamp: "2025-08-01T00:00:00+00:00", price: { amount: 19.99, currency: "USD" } },
        { timestamp: "not-a-date", price: { amount: 1, currency: "USD" } },
      ]),
    ).toEqual({
      points: [
        { date: "2025-08-01T00:00:00+00:00", price: 19.99, currency: "USD" },
        { date: "2025-09-25T00:00:00+00:00", price: 24.99, currency: "USD" },
      ],
      labels: ["1 Aug", "25 Sep"],
      historicalLow: 19.99,
      isCurrentOnly: false,
    });
  });

  it("keeps consecutive identical price observations to preserve the chart timeline", () => {
    expect(presentPriceHistory([
        { timestamp: "2026-01-01T00:00:00Z", price: { amount: 29.99, currency: "USD" }, regular: { amount: 29.99, currency: "USD" }, cut: 0 },
        { timestamp: "2026-01-08T00:00:00Z", price: { amount: 29.99, currency: "USD" }, regular: { amount: 29.99, currency: "USD" }, cut: 0 },
        { timestamp: "2026-01-15T00:00:00Z", price: { amount: 14.99, currency: "USD" }, regular: { amount: 29.99, currency: "USD" }, cut: 50 },
      ]).points).toMatchObject([
      { date: "2026-01-01T00:00:00Z", price: 29.99 },
      { date: "2026-01-08T00:00:00Z", price: 29.99 },
      { date: "2026-01-15T00:00:00Z", price: 14.99, cut: 50 },
    ]);
  });

  it("marks a current price without source changes as a current-only state", () => {
    expect(presentPriceHistory([], { amount: 9.99, currency: "USD" })).toMatchObject({
      points: [],
      isCurrentOnly: true,
    });
  });
});
