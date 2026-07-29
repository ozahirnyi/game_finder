import type { ReactNode } from "react";

export function SectionHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Chip({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "primary" | "outline" | "solid";
}) {
  const styles =
    tone === "primary"
      ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/25"
      : tone === "solid"
        ? "bg-primary text-primary-foreground"
        : tone === "outline"
          ? "border border-border text-muted-foreground"
          : "bg-foreground/5 text-muted-foreground ring-1 ring-inset ring-[var(--hairline)]";
  return (
    <span className={`label-mono inline-flex items-center rounded-md px-1.5 py-1 ${styles}`}>
      {children}
    </span>
  );
}

export function PresenceDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block size-2.5 rounded-full ring-2 ring-background ${
        online ? "bg-primary animate-pulse-soft" : "bg-muted-foreground/40"
      }`}
    />
  );
}

/** Small labelled metric used across dashboard panels. */
export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="label-mono text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-display text-xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

/** Bento cell wrapper: consistent surface, hairline, inner sheen. */
export function Panel({
  children,
  className = "",
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={`panel relative overflow-hidden rounded-2xl ${
        interactive ? "panel-hover" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function PriceBlock({
  price,
  originalPrice,
  discount,
  currency = "USD",
  store,
  size = "md",
}: {
  price?: number | null;
  originalPrice?: number | null;
  discount?: number | null;
  currency?: string;
  store?: string | null;
  size?: "sm" | "md";
}) {
  if (price == null) return <p className="text-sm text-muted-foreground">Price unavailable</p>;
  const money = new Intl.NumberFormat(undefined, { style: "currency", currency });
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        {originalPrice != null && originalPrice > price && (
          <p className="font-mono text-xs text-muted-foreground line-through">
            {money.format(originalPrice)}
          </p>
        )}
        <p
          className={`font-mono font-black text-primary ${size === "sm" ? "text-lg" : "text-3xl"}`}
        >
          {money.format(price)}
        </p>
      </div>
      <div className="text-right">
        {discount != null && discount > 0 && <Chip tone="primary">-{discount}%</Chip>}
        {store && <p className="mt-1 text-xs text-muted-foreground">{store}</p>}
      </div>
    </div>
  );
}
