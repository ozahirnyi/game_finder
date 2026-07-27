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
