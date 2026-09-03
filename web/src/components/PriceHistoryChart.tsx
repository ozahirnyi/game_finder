import { formatHistoryDate, type PriceHistoryPoint } from "@/lib/gamePresentation";

function formatPrice(amount: number, currency?: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)}${currency ? ` ${currency}` : ""}`;
  }
}

export function PriceHistoryChart({
  points,
  currency,
  currentPrice,
  historyAvailable,
}: {
  points: PriceHistoryPoint[];
  currency?: string;
  currentPrice?: number | null;
  historyAvailable?: boolean;
}) {
  if (points.length === 0) {
    if (historyAvailable === false) {
      const currentPriceSuffix =
        typeof currentPrice === "number" && Number.isFinite(currentPrice)
          ? ` Current price: ${formatPrice(currentPrice, currency)}.`
          : "";
      return (
        <p className="text-sm text-muted-foreground">
          Price history is temporarily unavailable.{currentPriceSuffix}
        </p>
      );
    }
    if (typeof currentPrice === "number" && Number.isFinite(currentPrice)) {
      return (
        <p className="text-sm text-muted-foreground">
          No price changes in the last 6 months. Current price:{" "}
          {formatPrice(currentPrice, currency)}.
        </p>
      );
    }
    return <p className="text-sm text-muted-foreground">No price history is available yet.</p>;
  }
  if (points.length === 1) {
    const point = points[0];
    return (
      <p className="text-sm text-muted-foreground">
        Recorded {formatHistoryDate(point.date)} at {formatPrice(point.price, currency)}.
      </p>
    );
  }

  const width = 320;
  const height = 88;
  const min = Math.min(...points.map((point) => point.price));
  const max = Math.max(...points.map((point) => point.price));
  const coordinates = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((point.price - min) / (max - min || 1)) * (height - 16) - 8;
    return { x, y };
  });
  const low = Math.min(...points.map((point) => point.price));

  return (
    <div>
      <svg
        aria-label="Price history chart"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
        className="h-24 w-full text-primary"
      >
        <polyline
          points={coordinates.map(({ x, y }) => `${x},${y}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        {coordinates.map(({ x, y }, index) => (
          <circle key={points[index].date} cx={x} cy={y} r={2.5} fill="currentColor" />
        ))}
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{formatHistoryDate(points[0].date)}</span>
        <span>{formatHistoryDate(points[points.length - 1].date)}</span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Historical low{" "}
        <span className="font-bold text-foreground">{formatPrice(low, currency)}</span>
      </p>
    </div>
  );
}
