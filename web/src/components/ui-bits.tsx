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
    <span
      className={`label-mono inline-flex items-center rounded-md px-1.5 py-1 ${styles}`}
    >
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

/* ------------------------------------------------------------------ */
/* Shared loading / empty / error states                               */
/* ------------------------------------------------------------------ */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse-soft rounded-lg bg-foreground/[0.07] ${className}`}
      aria-hidden
    />
  );
}

/** Placeholder grid shown while game data is loading. */
export function CardSkeletonGrid({
  count = 8,
  aspect = "aspect-[3/4]",
  className = "grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4",
}: {
  count?: number;
  aspect?: string;
  className?: string;
}) {
  return (
    <div className={className} role="status" aria-label="Loading games">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border border-border bg-surface"
        >
          <Skeleton className={`${aspect} w-full rounded-none`} />
          <div className="space-y-2 p-4">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RowSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-5 rounded-xl border border-border bg-surface p-4"
        >
          <Skeleton className="size-16 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface px-6 py-14 text-center ${className}`}
    >
      {icon && (
        <div className="mb-4 grid size-11 place-items-center rounded-xl bg-foreground/5 text-muted-foreground">
          {icon}
        </div>
      )}
      <p className="text-base font-bold">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this right now. Try again in a moment.",
  onRetry,
  className = "",
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center ${className}`}
    >
      <p className="text-base font-bold">{title}</p>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold transition hover:border-primary/50"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/** Inline error message for forms and buttons. */
export function InlineError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-xs font-semibold text-destructive">
      {children}
    </p>
  );
}

/**
 * Canonical price block: regular price, current price, discount, currency, store.
 * Renders a neutral "price unavailable" state when there is no price.
 */
export function PriceBlock({
  price,
  originalPrice,
  discount,
  currency = "USD",
  store,
  size = "md",
  align = "right",
  unavailable = false,
}: {
  price?: number | null;
  originalPrice?: number | null;
  discount?: number | null;
  currency?: string;
  store?: string;
  size?: "sm" | "md" | "lg";
  align?: "left" | "right";
  unavailable?: boolean;
}) {
  const alignment = align === "right" ? "items-end text-right" : "items-start text-left";

  if (unavailable || price == null) {
    return (
      <div className={`flex flex-col ${alignment}`}>
        <span className="label-mono text-muted-foreground">Price unavailable</span>
        {store && <span className="label-mono mt-1 text-muted-foreground/70">{store}</span>}
      </div>
    );
  }

  const priceClass =
    size === "lg"
      ? "font-mono text-3xl font-black"
      : size === "sm"
        ? "font-mono text-sm font-bold"
        : "font-mono text-xl font-black";

  return (
    <div className={`flex flex-col ${alignment}`}>
      <div className="flex items-baseline gap-2">
        {originalPrice != null && originalPrice > price && (
          <span className="font-mono text-xs text-muted-foreground line-through">
            {originalPrice.toFixed(2)}
          </span>
        )}
        <span className={`${priceClass} text-primary`}>{price.toFixed(2)}</span>
        <span className="label-mono text-muted-foreground">{currency}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        {discount ? <Chip tone="primary">-{discount}%</Chip> : null}
        {store && <span className="label-mono text-muted-foreground">{store}</span>}
      </div>
    </div>
  );
}
