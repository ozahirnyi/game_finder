import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Avatar, GameCover } from "@/components/GameCover";
import { GameCard } from "@/components/GameCard";
import {
  Chip,
  EmptyState,
  Panel,
  PresenceDot,
  PriceBlock,
  SectionHeader,
} from "@/components/ui-bits";
import { addWishlist, getCatalogGame, getLibraryOverview, getPriceHistory, searchGames } from "@/lib/api";
import { exactCatalogMatch } from "@/lib/catalogMatch";
import { ArrowLeft, Bell, ExternalLink, Heart, Share2, Sparkles, Users } from "lucide-react";

export const Route = createFileRoute("/games/$gameId")({
  validateSearch: (search: Record<string, unknown>): { title?: string; source?: "steam" } => ({
    ...(typeof search.title === "string" ? { title: search.title } : {}),
    ...(search.source === "steam" ? { source: "steam" } : {}),
  }),
  loaderDeps: ({ search }) => ({ title: search.title, source: search.source }),
  loader: async ({ params, deps }) => {
    try {
      if (deps.source === "steam") {
        const overview = await getLibraryOverview();
        const steamGame = overview.games.find(
          (game) => game.source === "steam" && game.external_id === params.gameId,
        );
        if (!steamGame?.external_id) throw new Error("Steam game is not in this library");
        return {
          game: {
            id: steamGame.external_id,
            title: steamGame.title,
            coverFrom: "#1d4ed8",
            coverTo: "#111827",
            coverUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${steamGame.external_id}/header.jpg`,
            genres: [],
            platforms: ["PC"],
            releaseDate: undefined,
            rating: 0,
            description: "This game is from your Steam library. Catalog details are unavailable.",
            price: null,
            originalPrice: null,
            discount: null,
            currency: undefined,
            store: "Steam",
            storeUrl: `https://store.steampowered.com/app/${steamGame.external_id}/`,
            coop: false,
            isSteamLibrary: true,
          },
        };
      }
      let catalog;
      try {
        catalog = await getCatalogGame(params.gameId);
        if (deps.title && !exactCatalogMatch([catalog], deps.title)) {
          throw new Error("Catalog ID does not match library title");
        }
      } catch {
        if (!deps.title) throw new Error("Catalog title unavailable");
        const results = await searchGames(deps.title);
        const match = exactCatalogMatch(results.results, deps.title);
        if (!match) throw new Error("Catalog game unavailable");
        catalog = await getCatalogGame(match.id);
      }
      return {
        game: {
          id: String(catalog.id),
          title: catalog.name,
          coverFrom: "#1d4ed8",
          coverTo: "#111827",
          coverUrl: catalog.background_image ?? undefined,
          genres: catalog.genres ?? [],
          platforms: catalog.platforms ?? [],
          releaseDate: catalog.released ?? undefined,
          rating: catalog.rating ?? 0,
          description: catalog.description_raw ?? undefined,
          price: null,
          originalPrice: null,
          discount: null,
          currency: undefined,
          store: undefined,
          storeUrl: undefined,
          coop: false,
          isSteamLibrary: false,
        },
      };
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.game.title} — Playfinder` },
          {
            name: "description",
            content: `${loaderData.game.title} · ${loaderData.game.genres.join(", ")} · ${loaderData.game.platforms.join(", ")}. Price tracking and friend overlap on Playfinder.`,
          },
          { property: "og:title", content: `${loaderData.game.title} — Playfinder` },
          {
            property: "og:description",
            content:
              loaderData.game.description ??
              `${loaderData.game.title} on Playfinder: price history, stores and friends who own it.`,
          },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary_large_image" },
          ...(loaderData.game.coverUrl
            ? [
                { property: "og:image", content: loaderData.game.coverUrl },
                { name: "twitter:image", content: loaderData.game.coverUrl },
              ]
            : []),
        ]
      : [{ title: "Game not found — Playfinder" }, { name: "robots", content: "noindex" }],
  }),
  component: GameDetail,
  notFoundComponent: () => (
    <AppShell>
      <div className="mx-auto max-w-md py-24 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">404</p>
        <h1 className="mt-3 text-2xl font-bold">Game not in catalog</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn't find that title. It may have been delisted.
        </p>
        <Link
          to="/search"
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          Back to search
        </Link>
      </div>
    </AppShell>
  ),
});

function Sparkline({ priceHistory }: { priceHistory: { price: number; date: string }[] }) {
  const w = 320;
  const h = 60;
  const max = Math.max(...priceHistory.map((p) => p.price));
  const min = Math.min(...priceHistory.map((p) => p.price));
  const pts = priceHistory
    .map((p, i) => {
      const x = (i / (priceHistory.length - 1)) * w;
      const y = h - ((p.price - min) / (max - min || 1)) * (h - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="text-primary">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={1.5} />
      {priceHistory.map((p, i) => {
        const x = (i / (priceHistory.length - 1)) * w;
        const y = h - ((p.price - min) / (max - min || 1)) * (h - 8) - 4;
        return <circle key={i} cx={x} cy={y} r={2} fill="currentColor" />;
      })}
    </svg>
  );
}

function GameDetail() {
  const { game: catalogGame } = Route.useLoaderData();
  const priceQuery = useQuery({
    queryKey: ["price-history", catalogGame.id],
    queryFn: () => getPriceHistory(catalogGame.id),
    enabled: !catalogGame.isSteamLibrary,
  });
  const queryClient = useQueryClient();
  const wishlistMutation = useMutation({
    mutationFn: addWishlist,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }),
  });
  const current = priceQuery.data?.current;
  const game = {
    ...catalogGame,
    price: current?.price?.amount ?? null,
    originalPrice: current?.regular?.amount ?? null,
    discount: current?.cut ?? null,
    currency: current?.price?.currency,
    store: current?.shop ?? catalogGame.store,
    storeUrl: current?.url ?? catalogGame.storeUrl,
  };

  const owners: Array<{ id: string; avatarFrom: string; avatarTo: string; name: string; online: boolean; activity?: string }> = [];
  const similar: Array<{ id: string; title: string; coverUrl?: string; coverFrom: string; coverTo: string; genres: string[]; price?: number | null; originalPrice?: number | null; discount?: number | null; currency?: string; store?: string }> = [];
  const priceUnavailable = game.price == null;
  const priceHistory = (priceQuery.data?.deals ?? [])
    .map((deal, index) => ({
      price: deal?.price?.amount,
      date: `Offer ${index + 1}`,
    }))
    .filter((point): point is { price: number; date: string } => typeof point.price === "number");

  return (
    <AppShell>
      <Link
        to="/search"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to search
      </Link>

      {/* Hero cover */}
      <section className="relative mb-10 overflow-hidden rounded-3xl border border-border">
        <GameCover
          from={game.coverFrom}
          to={game.coverTo}
          title={game.title}
          image={game.coverUrl}
          bare
          className="h-72 w-full sm:h-96"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent p-6 sm:p-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {game.coop && <Chip tone="primary">Co-op</Chip>}
            {game.discount ? <Chip tone="primary">-{game.discount}%</Chip> : null}
            {game.genres.map((g: string) => (
              <Chip key={g} tone="outline">
                {g}
              </Chip>
            ))}
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{game.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {game.platforms.join(" · ")}
            {game.releaseDate ? ` · ${game.releaseDate}` : ""}
            {game.rating > 0 ? ` · ${game.rating} critic score` : ""}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        {/* Main */}
        <div className="space-y-10 lg:col-span-8">
          <section>
            <SectionHeader title="About" />
            {game.description ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{game.description}</p>
            ) : (
              <EmptyState
                title="No description yet"
                description="A description will appear here once the catalog data is available."
              />
            )}
          </section>

          <section>
            <SectionHeader title="Details" />
            <Panel className="p-6">
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  { l: "Genres", v: game.genres.join(", ") },
                  { l: "Platforms", v: game.platforms.join(", ") },
                  { l: "Rating", v: game.rating > 0 ? `${game.rating} / 100` : "Not rated yet" },
                  { l: "Release date", v: game.releaseDate ?? "Unknown" },
                ].map((r) => (
                  <div
                    key={r.l}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3"
                  >
                    <dt className="label-mono text-muted-foreground">{r.l}</dt>
                    <dd className="text-right text-sm font-bold">{r.v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </section>

          <section>
            <SectionHeader title="Friends who own it" hint="Based on your connected friends" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {owners.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
                >
                  <div className="relative shrink-0">
                    <Avatar
                      from={f.avatarFrom}
                      to={f.avatarTo}
                      name={f.name}
                      className="size-11 rounded-full"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5">
                      <PresenceDot online={f.online} />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{f.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {f.online ? f.activity : "Offline"}
                    </p>
                  </div>
                  <Link
                    to="/friends/$friendId"
                    params={{ friendId: f.id }}
                    className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-bold hover:bg-foreground/5"
                  >
                    Profile
                  </Link>
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionHeader title="Price history" hint="Trend across storefronts" />
            <div className="rounded-2xl border border-border bg-surface p-6">
              {priceUnavailable ? (
                <EmptyState
                  title="Price unavailable"
                  description="We have no current price for this title in your region."
                />
              ) : (
                <>
                  <div className="mb-4">
                    <PriceBlock
                      price={game.price}
                      originalPrice={game.originalPrice}
                      discount={game.discount}
                      currency={game.currency}
                      store={game.store}
                      size="lg"
                      align="left"
                    />
                  </div>
                  <Sparkline priceHistory={priceHistory} />
                  <div className="mt-3 flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {priceHistory.map((p) => (
                      <span key={p.date}>{p.date}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>

          <section>
            <SectionHeader title="You might also like" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {similar.map((g) => (
                <GameCard
                  key={g.id}
                  aspect="aspect-[16/9]"
                  game={{
                    gameId: g.id,
                    title: g.title,
                    coverUrl: g.coverUrl,
                    coverFrom: g.coverFrom,
                    coverTo: g.coverTo,
                    genres: g.genres,
                    price: g.price,
                    originalPrice: g.originalPrice,
                    discount: g.discount,
                    currency: g.currency,
                    store: g.store,
                  }}
                />
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <p className="label-mono mb-3 text-muted-foreground">Best price</p>
            <PriceBlock
              price={game.price}
              originalPrice={game.originalPrice}
              discount={game.discount}
              currency={game.currency}
              store={game.store}
              size="lg"
              align="left"
              unavailable={priceUnavailable}
            />

            {!catalogGame.isSteamLibrary && (
              <button
                onClick={() =>
                  wishlistMutation.mutate({
                    id: Number(game.id),
                    name: game.title,
                    background_image: game.coverUrl ?? null,
                  })
                }
                disabled={wishlistMutation.isPending}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90"
              >
                <Heart className="size-4" /> Add to wishlist
              </button>
            )}

            {/* External action — deliberately separated from the card/CTA above */}
            <div className="mt-4 border-t border-border pt-4">
              <p className="label-mono mb-2 text-muted-foreground">External</p>
              {game.storeUrl ? (
                <a
                  href={game.storeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-bold transition hover:border-primary/50"
                >
                  Open in {game.store ?? "store"} <ExternalLink className="size-3.5" />
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No storefront link available for this title yet.
                </p>
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <button className="flex items-center justify-center gap-1 rounded-md border border-border bg-secondary py-2 text-xs font-bold hover:bg-foreground/5">
                <Bell className="size-3.5" /> Alert
              </button>
              <button className="flex items-center justify-center gap-1 rounded-md border border-border bg-secondary py-2 text-xs font-bold hover:bg-foreground/5">
                <Users className="size-3.5" /> Invite
              </button>
              <button className="flex items-center justify-center gap-1 rounded-md border border-border bg-secondary py-2 text-xs font-bold hover:bg-foreground/5">
                <Share2 className="size-3.5" /> Share
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-6">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span className="label-mono text-primary">Why for your squad</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Recommendations based on your library overlap will appear here.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
