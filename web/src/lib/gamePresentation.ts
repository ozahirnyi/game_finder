export type PriceHistoryApiPoint = {
  timestamp?: string | null;
  price?: { amount?: number | null; currency?: string | null } | null;
  regular?: { amount?: number | null; currency?: string | null } | null;
  cut?: number | null;
};

export type PriceHistoryPoint = {
  date: string;
  price: number;
  currency?: string;
  regular?: number;
  cut?: number;
};

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

export function presentPriceHistory(
  history: PriceHistoryApiPoint[],
  current?: { amount?: number | null; currency?: string | null } | null,
) {
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
        ? [{
            date: item.timestamp,
            price,
            currency: item.price?.currency ?? undefined,
            regular: typeof item.regular?.amount === "number" && Number.isFinite(item.regular.amount)
              ? item.regular.amount
              : undefined,
            cut: typeof item.cut === "number" && Number.isFinite(item.cut) ? item.cut : undefined,
          }]
        : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const compactPoints = points.filter((point, index) => {
    const previous = points[index - 1];
    return !previous || point.price !== previous.price || point.regular !== previous.regular ||
      point.cut !== previous.cut || point.currency !== previous.currency;
  });
  const labels =
    compactPoints.length > 1
      ? [formatHistoryDate(compactPoints[0].date), formatHistoryDate(compactPoints[compactPoints.length - 1].date)]
      : compactPoints.length === 1
        ? [formatHistoryDate(compactPoints[0].date)]
        : [];
  return {
    points: compactPoints,
    labels,
    historicalLow: compactPoints.length ? Math.min(...compactPoints.map((point) => point.price)) : undefined,
    isCurrentOnly:
      compactPoints.length === 0 && typeof current?.amount === "number" && Number.isFinite(current.amount),
  };
}

export function hasRenderablePriceHistory(history: PriceHistoryApiPoint[]): boolean {
  return presentPriceHistory(history).points.length > 0;
}

export function shouldRenderPriceHistory(isFree: boolean): boolean {
  return !isFree;
}
