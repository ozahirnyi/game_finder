import styles from "./game-cover.module.css";

export type GameCoverProps = {
  title: string;
  src: string | null;
  className?: string;
};

export function GameCover({ title, src, className }: GameCoverProps) {
  return src ? (
    // The API provides remote artwork URLs that are not known to Next's image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={className} src={src} alt={title} />
  ) : (
    <div aria-label={`${title} cover unavailable`} className={[styles.fallback, className].filter(Boolean).join(" ")} role="img">
      <span>{title}</span>
    </div>
  );
}
