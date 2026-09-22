import { useEffect, useMemo, useRef, useState } from "react";

import { getGameMediaCandidates, type MediaCandidate } from "@/lib/gameMedia";

type Props = {
  from: string;
  to: string;
  title: string;
  image?: string;
  fallbackImage?: string;
  candidates?: MediaCandidate[];
  sizes?: string;
  priority?: boolean;
  fit?: "contain" | "cover";
  onExhausted?: () => void;
  className?: string;
  compact?: boolean;
  variant?: "card" | "hero";
  bare?: boolean;
};

function normalizeCandidates(
  candidates: MediaCandidate[] | undefined,
  image?: string,
  fallbackImage?: string,
  variant: "card" | "hero" = "card",
) {
  const values = candidates?.length
    ? candidates
    : variant === "card"
      ? getGameMediaCandidates({ coverUrl: image, heroUrl: fallbackImage }, "poster")
      : [
          ...(image ? [{ src: image, kind: "unknown" as const }] : []),
          ...(fallbackImage ? [{ src: fallbackImage, kind: "unknown" as const }] : []),
        ];
  const seen = new Set<string>();
  return values.filter(
    (value) => value.src && !seen.has(value.src) && Boolean(seen.add(value.src)),
  );
}

export function GameCover({
  title,
  image,
  fallbackImage,
  candidates,
  sizes,
  priority = false,
  fit,
  onExhausted,
  className = "",
  compact = false,
  variant = "card",
  bare = false,
}: Props) {
  const queue = useMemo(
    () => normalizeCandidates(candidates, image, fallbackImage, variant),
    [candidates, image, fallbackImage, variant],
  );
  const queueKey = queue.map((value) => `${value.src}|${value.srcSet ?? ""}`).join("\n");
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [retryingBaseSource, setRetryingBaseSource] = useState(false);

  useEffect(() => {
    setIndex(0);
    setLoaded(false);
    setRetryingBaseSource(false);
  }, [queueKey]);

  const active = queue[index];
  const activeKey = `${index}:${active?.src ?? ""}:${retryingBaseSource}`;
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;
  useEffect(() => {
    if (!active) onExhausted?.();
  }, [active, onExhausted]);

  const initials = title
    .split(/\s|:/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
  // A banner-shaped container must not turn a portrait cover into a crop.  Only
  // media that was verified as wide is safe to use with `object-cover`.
  const resolvedFit =
    fit ??
    (active?.kind === "wide" || (variant === "hero" && active?.kind === "unknown")
      ? "cover"
      : "contain");

  return (
    <div
      className={`relative overflow-hidden ${active ? "" : "bg-surface-2"} ${className}`}
      data-visual-role={variant}
    >
      {active && (
        <img
          key={activeKey}
          ref={(node) => {
            if (node?.complete && node.naturalWidth > 0) setLoaded(true);
          }}
          src={active.src}
          srcSet={retryingBaseSource ? undefined : active.srcSet}
          sizes={
            !retryingBaseSource && active.srcSet
              ? (sizes ?? (variant === "hero" ? "100vw" : "264px"))
              : undefined
          }
          alt={title}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={(event) => {
            if (activeKeyRef.current !== activeKey) return;
            setLoaded(false);
            if (
              !retryingBaseSource &&
              active.srcSet &&
              event.currentTarget.currentSrc &&
              event.currentTarget.currentSrc !== event.currentTarget.src
            ) {
              setRetryingBaseSource(true);
              return;
            }
            setRetryingBaseSource(false);
            setIndex((current) => current + 1);
          }}
          className={`absolute inset-0 size-full ${resolvedFit === "contain" ? "object-contain" : "object-cover"} ${variant === "hero" && resolvedFit === "cover" ? "object-[center_35%]" : ""} transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
      <div className="absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10" />
      {!active && (
        <div
          className="absolute inset-0 flex flex-col justify-end p-3"
          aria-label={`${title} image unavailable`}
        >
          {bare ? (
            <span aria-hidden="true" className="self-center text-2xl text-muted-foreground">
              ◈
            </span>
          ) : compact ? (
            <span className="font-display text-2xl font-bold leading-none tracking-tight text-white/90">
              {initials}
            </span>
          ) : (
            <span className="font-display text-[1.6rem] font-bold leading-[0.95] tracking-tight text-white text-balance">
              {title}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function Avatar({
  from,
  to,
  name,
  image,
  imageAlt = "",
  className = "",
}: {
  from: string;
  to: string;
  name: string;
  image?: string;
  imageAlt?: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [image]);
  const initials = name
    .split(/\s|\./)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
  return (
    <div
      className={`relative grid place-items-center overflow-hidden font-display font-bold text-white/95 ring-1 ring-inset ring-white/15 ${className}`}
      style={{ background: `linear-gradient(140deg, ${from}, ${to})` }}
    >
      {image && !broken ? (
        <img
          src={image}
          alt={imageAlt}
          loading="lazy"
          onError={() => setBroken(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span className="text-xs tracking-tight">{initials}</span>
      )}
    </div>
  );
}
