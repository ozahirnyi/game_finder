import { Link } from "@tanstack/react-router";
import { GameCover } from "./GameCover";
import { Chip, PriceBlock } from "./ui-bits";

export type GameCardData = {
  gameId?: string;
  title: string;
  coverUrl?: string | null;
  coverFrom?: string;
  coverTo?: string;
  genres?: string[];
  platforms?: string[];
  price?: number | null;
  originalPrice?: number | null;
  discount?: number | null;
  currency?: string;
  store?: string | null;
};

export function GameCard({
  game,
  aspect = "aspect-[3/4]",
  showPrice = true,
}: {
  game: GameCardData;
  aspect?: string;
  showPrice?: boolean;
}) {
  const content = (
    <>
      <GameCover
        from={game.coverFrom ?? "#c75f28"}
        to={game.coverTo ?? "#22243a"}
        title={game.title}
        image={game.coverUrl}
        bare
        className={`${aspect} w-full`}
      />
      <div className="flex flex-1 flex-col p-4">
        <h3 className="truncate text-sm font-bold group-hover:text-primary">{game.title}</h3>
        {game.genres && game.genres.length > 0 && (
          <p className="mt-1 truncate text-xs text-muted-foreground">{game.genres.join(" · ")}</p>
        )}
        {game.platforms && game.platforms.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {game.platforms.map((platform) => (
              <Chip key={platform}>{platform}</Chip>
            ))}
          </div>
        )}
        {showPrice && (
          <div className="mt-auto pt-4">
            <PriceBlock
              price={game.price}
              originalPrice={game.originalPrice}
              discount={game.discount}
              currency={game.currency}
              store={game.store}
              size="sm"
            />
          </div>
        )}
      </div>
    </>
  );
  const className =
    "group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface transition hover:border-primary/40";
  return game.gameId ? (
    <Link to="/games/$gameId" params={{ gameId: game.gameId }} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
