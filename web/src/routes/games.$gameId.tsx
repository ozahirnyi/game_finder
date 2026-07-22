import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ExternalLink, Share2, Star } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, SectionHeader } from "@/components/ui-bits";
import {
  getCatalogGame,
  getGamePriceHistory,
  getSavedGame,
  searchGames,
  type PriceMoney,
  type SavedGame,
} from "@/lib/api";
import { lovableQueryKeys } from "@/lib/lovable-data";

export const Route = createFileRoute("/games/$gameId")({
  head: () => ({
    meta: [
      { title: "Game — GameFinder" },
      { name: "description", content: "Game details from the public catalog." },
    ],
  }),
  component: GameDetail,
});

function formatMoney(money: PriceMoney | null | undefined) {
  return money
    ? new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: money.currency,
      }).format(money.amount)
    : "Price not listed";
}

function savedGameCover(game: SavedGame) {
  if (game.source === "steam" && game.external_id && game.img_icon_url) {
    return `https://media.steampowered.com/steamcommunity/public/images/apps/${game.external_id}/${game.img_icon_url}.jpg`;
  }
  return "#14b8a6";
}

function SavedGameDetail({ game }: { game: SavedGame }) {
  const playtime = game.playtime_forever
    ? `${Math.round(game.playtime_forever / 60)} hours played`
    : "No playtime was imported";
  return (
    <AppShell>
      <Link
        to="/library"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to library
      </Link>
      <section className="overflow-hidden rounded-3xl border border-border bg-surface">
        <GameCover
          from={savedGameCover(game)}
          to="#0f172a"
          title={game.title}
          className="h-56 w-full sm:h-72"
        />
        <div className="p-6 sm:p-8">
          <Chip tone="primary">{game.source}</Chip>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight">
            {game.title}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {game.info || game.notes || "This game is saved in your library."}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Source
              </p>
              <p className="mt-1 font-bold capitalize">{game.source}</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Playtime
              </p>
              <p className="mt-1 font-bold">{playtime}</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Added
              </p>
              <p className="mt-1 font-bold">
                {new Date(game.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function PricePanel({ gameId }: { gameId: string }) {
  const priceQuery = useQuery({
    queryKey: lovableQueryKeys.gamePriceHistory(gameId, "US"),
    queryFn: () => getGamePriceHistory(gameId, "US"),
  });
  const prices = priceQuery.data;
  const primaryLink = prices?.current?.url ?? prices?.url;

  return (
    <section>
      <SectionHeader
        title="Prices"
        hint="Current offers and historical lows from IsThereAnyDeal."
      />
      <div className="rounded-2xl border border-border bg-surface p-6">
        {priceQuery.isLoading && (
          <p className="text-sm text-muted-foreground">
            Loading current prices…
          </p>
        )}
        {priceQuery.isError && (
          <p className="text-sm text-muted-foreground">
            Price information is not available right now. You can retry by
            refreshing this page.
          </p>
        )}
        {prices && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                {prices.current?.regular && (
                  <p className="font-mono text-xs text-muted-foreground line-through">
                    {formatMoney(prices.current.regular)}
                  </p>
                )}
                <p className="font-mono text-3xl font-black text-primary">
                  {formatMoney(prices.current?.price)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {prices.current?.shop
                    ? `Available at ${prices.current.shop}`
                    : "No current storefront offer was returned."}
                </p>
              </div>
              {prices.current?.cut !== null &&
                prices.current?.cut !== undefined && (
                  <Chip tone="primary">-{prices.current.cut}%</Chip>
                )}
            </div>
            {primaryLink && (
              <a
                href={primaryLink}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
              >
                Open at {prices.current?.shop ?? "store"}
                <ExternalLink className="size-4" />
              </a>
            )}
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { label: "All-time low", value: prices.history_low_all },
                { label: "1-year low", value: prices.history_low_1y },
                { label: "3-month low", value: prices.history_low_3m },
              ].map((low) => (
                <div
                  key={low.label}
                  className="rounded-xl border border-border bg-secondary/40 p-3"
                >
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {low.label}
                  </p>
                  <p className="mt-1 font-mono text-lg font-bold">
                    {formatMoney(low.value)}
                  </p>
                </div>
              ))}
            </div>
            {prices.deals.length > 0 && (
              <div className="mt-6 border-t border-border pt-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Other current offers
                </p>
                <div className="space-y-2">
                  {prices.deals.slice(0, 5).map((deal, index) => (
                    <div
                      key={`${deal.shop ?? "store"}-${index}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <span>{deal.shop ?? "Store"}</span>
                      <span className="font-mono font-bold">
                        {formatMoney(deal.price)}
                      </span>
                      {deal.url && (
                        <a
                          href={deal.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-bold text-primary hover:underline"
                        >
                          Open offer
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function GameDetail() {
  return <GameDetailPage gameId={Route.useParams().gameId} />;
}

export function GameDetailPage({ gameId }: { gameId: string }) {
  const isSavedGame =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      gameId,
    );
  const savedGameQuery = useQuery({
    queryKey: ["saved-game", gameId],
    queryFn: () => getSavedGame(gameId),
    enabled: isSavedGame,
  });
  const catalogMatchQuery = useQuery({
    queryKey: ["saved-game-catalog-match", savedGameQuery.data?.title],
    queryFn: () => searchGames(savedGameQuery.data!.title),
    enabled: Boolean(isSavedGame && savedGameQuery.data?.title),
  });
  const catalogGameId = isSavedGame
    ? catalogMatchQuery.data?.results[0]?.id
    : gameId;
  const gameQuery = useQuery({
    queryKey: lovableQueryKeys.catalogGame(String(catalogGameId ?? gameId)),
    queryFn: () => getCatalogGame(String(catalogGameId)),
    enabled: Boolean(!isSavedGame || catalogGameId),
  });
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [expandedDescription, setExpandedDescription] = useState(false);

  if (isSavedGame && savedGameQuery.isLoading)
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">
          Loading your library game…
        </p>
      </AppShell>
    );
  if (isSavedGame && savedGameQuery.isError)
    return (
      <AppShell>
        <Link to="/library" className="text-sm font-bold text-primary">
          Back to library
        </Link>
        <p className="mt-4 text-sm text-muted-foreground">
          This saved game could not be opened. It may have been removed from
          your library.
        </p>
      </AppShell>
    );
  if (isSavedGame && catalogMatchQuery.isLoading)
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">
          Opening catalog details…
        </p>
      </AppShell>
    );
  if (isSavedGame && (!catalogGameId || catalogMatchQuery.isError))
    return savedGameQuery.data ? (
      <SavedGameDetail game={savedGameQuery.data} />
    ) : null;
  if (gameQuery.isLoading)
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading game details…</p>
      </AppShell>
    );
  if (gameQuery.isError || !gameQuery.data)
    return (
      <AppShell>
        <Link to="/search" className="text-sm font-bold text-primary">
          Back to search
        </Link>
        <p className="mt-4 text-sm text-muted-foreground">
          Game details could not be loaded. Try searching for the game again.
        </p>
      </AppShell>
    );

  const game = gameQuery.data;
  const share = async () => {
    try {
      const url = window.location.href;
      if (navigator.share) await navigator.share({ title: game.name, url });
      else await navigator.clipboard.writeText(url);
      setShareState("copied");
    } catch {
      setShareState("failed");
    }
  };

  return (
    <AppShell>
      <Link
        to="/search"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to search
      </Link>
      <section className="relative mb-10 overflow-hidden rounded-3xl border border-border">
        <GameCover
          from={game.background_image ?? "#0f172a"}
          to="#0f172a"
          title={game.name}
          className="h-72 w-full sm:h-96"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent p-6 sm:p-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {game.genres.map((genre) => (
              <Chip key={genre} tone="outline">
                {genre}
              </Chip>
            ))}
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            {game.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {[
              game.platforms.join(" · "),
              game.released ? `Released ${game.released}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Public catalog entry"}
          </p>
        </div>
      </section>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <main className="space-y-10 lg:col-span-8">
          <section>
            <SectionHeader title="About" />
            <button
              type="button"
              onClick={() => setExpandedDescription((value) => !value)}
              className="w-full text-left text-sm leading-relaxed text-muted-foreground"
            >
              <span className={expandedDescription ? "" : "line-clamp-3"}>
                {game.description_raw ||
                  "No public description is available for this catalog entry."}
              </span>
            </button>
            {game.description_raw ? (
              <button
                type="button"
                onClick={() => setExpandedDescription((value) => !value)}
                className="mt-2 text-xs font-bold text-primary"
              >
                {expandedDescription
                  ? "Collapse description"
                  : "Show full description"}
              </button>
            ) : null}
          </section>
          <PricePanel gameId={String(game.id)} />
        </main>
        <aside className="space-y-6 lg:col-span-4">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <SectionHeader title="At a glance" />
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0">
                <span className="text-muted-foreground">Platforms</span>
                <span className="text-right font-bold">
                  {game.platforms.join(", ") || "Not listed"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                <span className="text-muted-foreground">Genres</span>
                <span className="text-right font-bold">
                  {game.genres.join(", ") || "Not listed"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                <span className="text-muted-foreground">Critic score</span>
                <span className="inline-flex items-center gap-1 text-right font-bold">
                  {game.rating === null ? (
                    "Not rated"
                  ) : (
                    <>
                      <Star className="size-3.5 text-primary" />
                      {game.rating}
                    </>
                  )}
                </span>
              </div>
            </dl>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-6">
            <button
              onClick={share}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-bold hover:bg-white/5"
            >
              <Share2 className="size-4" /> Share game
            </button>
            {shareState === "copied" && (
              <p className="mt-3 text-xs text-muted-foreground">Link copied.</p>
            )}
            {shareState === "failed" && (
              <p className="mt-3 text-xs text-muted-foreground">
                The link could not be shared from this browser.
              </p>
            )}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
