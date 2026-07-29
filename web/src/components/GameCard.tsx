import { Link } from "@tanstack/react-router";
import { GameCover } from "@/components/GameCover";
import { Chip, PriceBlock } from "@/components/ui-bits";

export type GameCardData = {
  /** Internal catalog id — the card always links here, never to an external store. */
  gameId?: string;
  title: string;
  coverUrl?: string;
  coverFrom: string;
  coverTo: string;
  genres?: string[];
  platforms?: string[];
  price?: number | null;
  originalPrice?: number | null;
  discount?: number | null;
  currency?: string;
  store?: string;
};

/**
 * Canonical game card. Always navigates to the internal game page —
 * external storefront links live on the detail page only.
 */
export function GameCard({
  game,
  aspect = "aspect-[16/9]",
  showPrice = true,
}: {
  game: GameCardData;
  aspect?: string;
  showPrice?: boolean;
}) {
  const inner = (
    <>
      <div className="relative">
        <GameCover
          from={game.coverFrom}
          to={game.coverTo}
          title={game.title}
          image={game.coverUrl}
          bare
          className={`${aspect} w-full transition-transform duration-500 ease-[var(--ease-studio)] group-hover:scale-[1.04]`}
        />
        {game.discount ? (
          <span className="label-mono absolute right-3 top-3 rounded-md bg-primary px-1.5 py-1 text-primary-foreground">
            -{game.discount}%
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h4 className="truncate font-display text-sm font-bold transition-colors group-hover:text-primary">
          {game.title}
        </h4>
        {game.genres && game.genres.length > 0 && (
          <p className="mt-1 truncate text-xs text-muted-foreground">{game.genres.join(" · ")}</p>
        )}
        {game.platforms && game.platforms.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {game.platforms.map((p) => (
              <Chip key={p}>{p}</Chip>
            ))}
          </div>
        )}
        {showPrice && (
          <div className="mt-auto pt-4">
            <PriceBlock
              price={game.price ?? null}
              originalPrice={game.originalPrice ?? null}
              discount={game.discount ?? null}
              currency={game.currency}
              store={game.store}
              size="sm"
              align="left"
            />
          </div>
        )}
      </div>
    </>
  );

  const className =
    "hover-lift group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface transition hover:border-primary/40";

  if (!game.gameId) {
    return <div className={className}>{inner}</div>;
  }

  return (
    <Link to="/games/$gameId" params={{ gameId: game.gameId }} className={className}>
      {inner}
    </Link>
  );
}
