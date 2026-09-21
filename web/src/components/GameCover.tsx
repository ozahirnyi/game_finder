import { useEffect, useState } from "react";

type Props = {
  from: string;
  to: string;
  title: string;
  /** Real cover art. Falls back to the gradient when missing or broken. */
  image?: string;
  /** Optional alternate cover when the primary provider asset is unavailable. */
  fallbackImage?: string;
  /** Portrait cover art used without cropping when a wide hero is unavailable. */
  portraitImage?: string;
  className?: string;
  compact?: boolean;
  /** A wide, detail-page composition for existing provider cover art. */
  variant?: "card" | "hero";
  /** Hide the large title — use when the surrounding card already shows it. */
  bare?: boolean;
};

export function GameCover({
  from,
  to,
  title,
  image,
  fallbackImage,
  portraitImage,
  className = "",
  compact = false,
  variant = "card",
  bare = false,
}: Props) {
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [portraitBroken, setPortraitBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
    setLoaded(false);
    setUsingFallback(false);
    setPortraitBroken(false);
  }, [image, fallbackImage, portraitImage]);

  const activeImage = usingFallback ? fallbackImage : image;
  const showImage = !!activeImage && !broken;
  const showPortrait = !showImage && variant === "hero" && !!portraitImage && !portraitBroken;
  const hasRenderableMedia = showImage || showPortrait;
  const mediaBackground = `radial-gradient(130% 100% at 12% 4%, ${from}66 0%, transparent 58%), linear-gradient(150deg, ${to} 0%, #0f0f0f 100%)`;

  const initials = title
    .split(/\s|:/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <div
      className={`grain relative overflow-hidden ${hasRenderableMedia ? "" : "bg-surface-2"} ${className}`}
      data-visual-role={variant}
      style={hasRenderableMedia ? { background: mediaBackground } : undefined}
    >
      {showImage && (
        <img
          src={activeImage}
          alt={title}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (!usingFallback && fallbackImage) {
              setLoaded(false);
              setUsingFallback(true);
            } else {
              setBroken(true);
            }
          }}
          className={`absolute inset-0 size-full object-cover ${
            variant === "hero" ? "object-[center_35%]" : ""
          } transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {showPortrait && (
        <div className="absolute inset-0 grid place-items-center p-3">
          <img
            src={portraitImage}
            alt={title}
            loading="lazy"
            decoding="async"
            onError={() => setPortraitBroken(true)}
            className="h-[88%] max-w-[58%] rounded-md object-contain shadow-2xl shadow-black/60"
          />
        </div>
      )}
      {hasRenderableMedia && (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_92%,rgba(255,255,255,0.10),transparent_52%)]" />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 to-transparent" />
        </>
      )}
      <div className="absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10" />
      {!showImage && !showPortrait && (
        <div className="absolute inset-0 flex flex-col justify-end p-3">
          {bare ? null : compact ? (
            <span className="font-display text-2xl font-bold leading-none tracking-tight text-white/90">
              {initials}
            </span>
          ) : (
            <span className="font-display text-[1.6rem] font-bold leading-[0.95] tracking-tight text-white text-balance drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
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
  const initials = name
    .split(/\s|\./)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
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
