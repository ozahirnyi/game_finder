type Props = {
  from: string;
  to: string;
  title: string;
  className?: string;
  compact?: boolean;
};

export function GameCover({
  from,
  to,
  title,
  className = "",
  compact = false,
}: Props) {
  const initials = title
    .split(/\s|:/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background: `radial-gradient(120% 90% at 15% 10%, ${from}55 0%, transparent 55%), linear-gradient(135deg, ${to} 0%, ${from}22 100%), ${to}`,
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_90%,rgba(255,255,255,0.08),transparent_50%)]" />
      <div className="absolute inset-0 flex flex-col justify-between p-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/50">
          GF · {title.split(" ")[0].slice(0, 4).toUpperCase()}
        </span>
        {compact ? (
          <span className="font-black text-2xl tracking-tighter text-white/90 leading-none">
            {initials}
          </span>
        ) : (
          <span className="font-black text-3xl tracking-tighter text-white/95 leading-[0.9]">
            {title}
          </span>
        )}
      </div>
    </div>
  );
}

export function Avatar({
  from,
  to,
  name,
  className = "",
}: {
  from: string;
  to: string;
  name: string;
  className?: string;
}) {
  const initials = name
    .split(/\s|\./)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div
      className={`grid place-items-center font-bold text-white/95 ${className}`}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <span className="text-xs">{initials}</span>
    </div>
  );
}
