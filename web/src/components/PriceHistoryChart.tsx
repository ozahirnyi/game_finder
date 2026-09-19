import { useEffect, useRef, useState } from "react";
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

const DEFAULT_CHART_WIDTH = 320;
const CHART_HEIGHT = 88;

export function PriceHistoryChart({
  points,
  currency,
  currentPrice,
  historyAvailable,
  unavailableMessage,
  periodLabel = "6 months",
  onRetry,
}: {
  points: PriceHistoryPoint[];
  currency?: string;
  currentPrice?: number | null;
  historyAvailable?: boolean;
  unavailableMessage?: string | null;
  periodLabel?: string;
  onRetry?: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const chartRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(DEFAULT_CHART_WIDTH);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || typeof ResizeObserver === "undefined") return;

    const updateWidth = () => {
      const bounds = chart.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        setWidth(Math.round((bounds.width / bounds.height) * CHART_HEIGHT));
      }
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(chart);
    return () => observer.disconnect();
  }, []);

  if (points.length === 0) {
    if (historyAvailable === false) {
      const currentPriceSuffix =
        typeof currentPrice === "number" && Number.isFinite(currentPrice)
          ? ` Current price: ${formatPrice(currentPrice, currency)}.`
          : "";
      return <div className="text-sm text-muted-foreground">
        <p>{unavailableMessage ?? "Price history is temporarily unavailable."}{currentPriceSuffix}</p>
        {onRetry && <button type="button" onClick={onRetry} className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-bold">Retry price history</button>}
      </div>;
    }
    if (typeof currentPrice === "number" && Number.isFinite(currentPrice)) {
      return (
        <p className="text-sm text-muted-foreground">
          No price changes in the last {periodLabel}. Current price:{" "}
          {formatPrice(currentPrice, currency)}.
        </p>
      );
    }
    return <p className="text-sm text-muted-foreground">No price history is available yet.</p>;
  }
  const height = CHART_HEIGHT;
  const plotLeft = 42;
  const plotRight = 8;
  const plotWidth = width - plotLeft - plotRight;
  const values = points.flatMap((point) => [point.price, point.regular].filter((value): value is number => typeof value === "number"));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const scaleValues = max === min ? [max] : [max, (min + max) / 2, min];
  const timestamps = points.map((point) => Date.parse(point.date));
  const firstTimestamp = timestamps[0];
  const timestampSpan = Math.max(timestamps[timestamps.length - 1] - firstTimestamp, 1);
  const xFor = (index: number) => points.length === 1
    ? plotLeft + plotWidth / 2
    : plotLeft + ((timestamps[index] - firstTimestamp) / timestampSpan) * plotWidth;
  const yFor = (value: number) => height - ((value - min) / (max - min || 1)) * (height - 16) - 8;
  const coordinates = points.map((point, index) => {
    return { x: xFor(index), y: yFor(point.price) };
  });
  const regularCoordinates = points.flatMap((point, index) =>
    typeof point.regular === "number" ? [{ x: xFor(index), y: yFor(point.regular) }] : [],
  );
  const lowPoint = points.reduce((lowest, point) => (point.price < lowest.price ? point : lowest));
  const activePoint = activeIndex == null ? undefined : points[Math.min(activeIndex, points.length - 1)];
  const discount = activePoint?.cut ?? (
    typeof activePoint?.regular === "number" && activePoint.regular > activePoint.price
      ? Math.round((1 - activePoint.price / activePoint.regular) * 100)
      : 0
  );
  const steppedPath = (values: Array<{ x: number; y: number }>) => values.reduce(
    (path, point, index) => index === 0 ? `M ${point.x} ${point.y}` : `${path} H ${point.x} V ${point.y}`,
    "",
  );
  const activeCoordinate = activeIndex == null ? undefined : coordinates[Math.min(activeIndex, coordinates.length - 1)];
  const activeIndexForX = (x: number) => {
    if (x < plotLeft || x > width - plotRight) return null;
    return coordinates.reduce(
      (active, point, index) => point.x <= x ? index : active,
      0,
    );
  };
  const tooltipStyle = !activeCoordinate
    ? undefined
    : activeCoordinate.x <= width * 0.15
      ? { left: "0%", transform: "translate(0, -115%)" }
      : activeCoordinate.x >= plotLeft + plotWidth * 0.75
        ? {
            left: `${(activeCoordinate.x / width) * 100}%`,
            transform: "translate(-100%, -115%)",
          }
        : {
            left: `${(activeCoordinate.x / width) * 100}%`,
            transform: "translate(-50%, -115%)",
          };

  return (
    <div>
      <div className="relative h-24">
      <svg
        ref={chartRef}
        aria-label="Price history chart"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
        className="h-24 w-full text-primary"
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const x = ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * width;
          setActiveIndex(activeIndexForX(Math.min(width, Math.max(0, x))));
        }}
        onPointerLeave={() => setActiveIndex(null)}
      >
        <g aria-label="Price scale" className="text-muted-foreground">
          {scaleValues.map((value) => {
            const y = yFor(value);
            return (
              <g key={value}>
                <line
                  x1={plotLeft}
                  x2={width - plotRight}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.16}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <text x={plotLeft - 5} y={y + 3} textAnchor="end" fontSize={8} fill="currentColor">
                  {formatPrice(value, currency)}
                </text>
              </g>
            );
          })}
        </g>
        <path
          aria-label="Sale price history"
          d={steppedPath(coordinates)}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        {activeCoordinate && (
          <line
            aria-label="Selected price date"
            x1={activeCoordinate.x}
            x2={activeCoordinate.x}
            y1={8}
            y2={height - 8}
            stroke="currentColor"
            strokeOpacity={0.45}
            strokeWidth={1}
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {regularCoordinates.length > 0 && (
          <path
            aria-label="Regular price history"
            d={steppedPath(regularCoordinates)}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.35}
            strokeWidth={1.5}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {coordinates.map(({ x, y }, index) => (
          <g
            key={points[index].date}
            role="button"
            tabIndex={0}
            aria-label={`${formatHistoryDate(points[index].date)} sale price ${formatPrice(points[index].price, points[index].currency ?? currency)}`}
            onFocus={() => setActiveIndex(index)}
            onMouseEnter={() => setActiveIndex(index)}
          >
            <circle cx={x} cy={y} r={7} fill="transparent" />
            {activeIndex === index && <circle cx={x} cy={y} r={2.5} fill="currentColor" />}
          </g>
        ))}
      </svg>
      {activePoint && activeCoordinate && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 min-w-max whitespace-nowrap rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg"
          style={{
            ...tooltipStyle,
            top: `${(activeCoordinate.y / height) * 100}%`,
          }}
        >
          <p className="font-semibold">{formatHistoryDate(activePoint.date)}</p>
          <p>Sale price: {formatPrice(activePoint.price, activePoint.currency ?? currency)}</p>
          <p>Regular price: {typeof activePoint.regular === "number" ? formatPrice(activePoint.regular, activePoint.currency ?? currency) : "Not recorded"}</p>
          <p>Discount: {discount}%</p>
        </div>
      )}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{formatHistoryDate(points[0].date)}</span>
        {points.length > 1 && <span>{formatHistoryDate(points[points.length - 1].date)}</span>}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Historical low{" "}
        <span className="font-bold text-foreground">
          {formatPrice(lowPoint.price, lowPoint.currency ?? currency)}
        </span>
      </p>
    </div>
  );
}
