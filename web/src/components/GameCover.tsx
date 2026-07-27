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
  const imageUrl = /^https?:\/\//i.test(from) ? from : null;
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background: `radial-gradient(120% 90% at 15% 10%, ${from}55 0%, transparent 55%), linear-gradient(135deg, ${to} 0%, ${from}22 100%), ${to}`,
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={title}
          className="absolute inset-0 size-full object-cover"
          loading="lazy"
        />
      ) : null}
    </div>
  );
}

export function Avatar({
  from,
  to,
  name,
  imageUrl,
  className = "",
}: {
  from: string;
  to: string;
  name: string;
  imageUrl?: string | null;
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
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          className="size-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="text-xs">{initials}</span>
      )}
    </div>
  );
}
