export type PriceHistoryApiPoint = {
  timestamp?: string | null;
  price?: { amount?: number | null; currency?: string | null } | null;
};

export type PriceHistoryPoint = { date: string; price: number };

const shortMonth = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

function parseIsoCalendarDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
    ? parsed
    : undefined;
}

function parseIsoTimestamp(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function formatCatalogRating(rating?: number | null): string {
  return typeof rating === "number" && Number.isFinite(rating) && rating > 0
    ? `${Number(rating.toFixed(1))} / 100`
    : "Not rated yet";
}

export function formatCatalogReleaseDate(released?: string | null): string {
  const date = typeof released === "string" ? parseIsoCalendarDate(released) : undefined;
  if (!date) return "Unknown";
  return `${date.getUTCDate()} ${shortMonth.format(date)} ${date.getUTCFullYear()}`;
}

export function formatHistoryDate(timestamp: string): string {
  const date = parseIsoTimestamp(timestamp);
  return date ? `${date.getUTCDate()} ${shortMonth.format(date)}` : "";
}

export function presentPriceHistory(history: PriceHistoryApiPoint[]) {
  const points = history
    .flatMap((item) => {
      const date =
        typeof item.timestamp === "string" ? parseIsoTimestamp(item.timestamp) : undefined;
      const price = item.price?.amount;
      return date &&
        typeof price === "number" &&
        Number.isFinite(price) &&
        price >= 0 &&
        item.timestamp
        ? [{ date: item.timestamp, price }]
        : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const labels =
    points.length > 1
      ? [formatHistoryDate(points[0].date), formatHistoryDate(points[points.length - 1].date)]
      : points.length === 1
        ? [formatHistoryDate(points[0].date)]
        : [];
  return {
    points,
    labels,
    historicalLow: points.length ? Math.min(...points.map((point) => point.price)) : undefined,
  };
}
