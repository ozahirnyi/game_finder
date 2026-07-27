import type { ReactNode } from "react";

export const primaryActionClass =
  "rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

export const secondaryActionClass =
  "rounded-lg border border-border bg-surface px-4 py-2 font-bold transition-colors hover:border-primary/60 hover:bg-primary/10 active:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

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
  tone?: "muted" | "primary" | "outline";
}) {
  const styles =
    tone === "primary"
      ? "bg-primary/15 text-primary"
      : tone === "outline"
        ? "border border-border text-muted-foreground"
        : "bg-white/5 text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest ${styles}`}
    >
      {children}
    </span>
  );
}

export function PresenceDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block size-2 rounded-full ring-2 ring-background ${
        online ? "bg-primary animate-pulse-soft" : "bg-muted-foreground/40"
      }`}
    />
  );
}
