import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { addWishlist, ApiError, createGameInvite, createPriceAlert, getCatalogGame, getFriends, getPriceHistory, getWishlist, searchGames } from "@/lib/api";
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
        const title = deps.title;
        if (!title) throw new Error("Steam game title unavailable");
        return {
          game: {
            id: params.gameId,
            title,
            coverFrom: "#1d4ed8",
            coverTo: "#111827",
            coverUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${params.gameId}/library_hero.jpg`,
            fallbackCoverUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${params.gameId}/header.jpg`,
            genres: [],
            platforms: ["PC"],
            releaseDate: undefined,
            rating: 0,
            description: "Steam Store game. Catalog details are unavailable.",
            price: null,
            originalPrice: null,
            discount: null,
            currency: undefined,
            store: "Steam",
            storeUrl: `https://store.steampowered.com/app/${params.gameId}/`,
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
          fallbackCoverUrl: undefined,
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
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [targetPrice, setTargetPrice] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [wishlistAdded, setWishlistAdded] = useState(false);
  const wishlistQuery = useQuery({ queryKey: ["wishlist"], queryFn: getWishlist, enabled: !catalogGame.isSteamLibrary });
  const friendsQuery = useQuery({ queryKey: ["friends"], queryFn: getFriends });
  const wishlistMutation = useMutation({
    mutationFn: addWishlist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      setWishlistAdded(true);
      setActionMessage("Added to wishlist");
    },
  });
  const alertMutation = useMutation({
    mutationFn: async (target_price: number) => {
      const catalogGameId = Number(catalogGame.id);
      if (!wishlistQuery.data?.some((item) => item.catalog_game_id === catalogGameId)) {
        try {
          await addWishlist({ id: catalogGameId, name: catalogGame.title, background_image: catalogGame.coverUrl ?? null });
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 409)) throw error;
        }
      }
      return createPriceAlert({ wishlist_catalog_game_id: catalogGameId, target_price, delivery_channels: ["in_app"] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      queryClient.invalidateQueries({ queryKey: ["price-alerts"] });
      setShowAlertForm(false);
      setTargetPrice("");
      setActionMessage("Alert saved");
    },
  });
  const inviteMutation = useMutation({
    mutationFn: (recipient_id: string) => createGameInvite({ recipient_id, game_name: catalogGame.title, game_id: Number(catalogGame.id) }),
    onSuccess: () => {
      setShowInviteForm(false);
      setActionMessage("Invite sent");
    },
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
  const isInWishlist = wishlistAdded || wishlistQuery.data?.some(
    (item) => item.catalog_game_id === Number(catalogGame.id),
  );

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
          fallbackImage={game.fallbackCoverUrl}
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
                disabled={wishlistMutation.isPending || isInWishlist}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90"
              >
                <Heart className="size-4" /> {wishlistMutation.isPending ? "Adding…" : isInWishlist ? "In wishlist" : "Add to wishlist"}
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
              <button onClick={() => setShowAlertForm(true)} disabled={catalogGame.isSteamLibrary} className="flex items-center justify-center gap-1 rounded-md border border-border bg-secondary py-2 text-xs font-bold hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50">
                <Bell className="size-3.5" /> Alert
              </button>
              <button onClick={() => { setRecipientId(friendsQuery.data?.[0]?.user.id ?? ""); setShowInviteForm(true); }} disabled={friendsQuery.isLoading || !friendsQuery.data?.length} title={!friendsQuery.data?.length ? "Add a PlayFinder friend to send an invite." : undefined} className="flex items-center justify-center gap-1 rounded-md border border-border bg-secondary py-2 text-xs font-bold hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50">
                <Users className="size-3.5" /> Invite
              </button>
              <button onClick={async () => {
                try {
                  const url = new URL(`/games/${game.id}`, window.location.origin).href;
                  if (navigator.share) await navigator.share({ title: game.title, url });
                  else { await navigator.clipboard.writeText(url); setActionMessage("Link copied"); }
                } catch { setActionMessage("Could not share this link"); }
              }} className="flex items-center justify-center gap-1 rounded-md border border-border bg-secondary py-2 text-xs font-bold hover:bg-foreground/5">
                <Share2 className="size-3.5" /> Share
              </button>
            </div>
            {actionMessage && <p role="status" className="mt-3 text-xs font-semibold text-muted-foreground">{actionMessage}</p>}
            {!friendsQuery.isLoading && !friendsQuery.data?.length && (
              <p className="mt-3 text-xs text-muted-foreground">Add a PlayFinder friend to send an invite.</p>
            )}
            {showAlertForm && (
              <form className="mt-4 space-y-3 border-t border-border pt-4" onSubmit={(event) => { event.preventDefault(); const value = Number(targetPrice); if (Number.isFinite(value) && value > 0) alertMutation.mutate(value); }}>
                <label className="grid gap-1 text-xs font-bold">Target price
                  <input aria-label="Target price" type="number" min="0.01" step="0.01" required value={targetPrice} onChange={(event) => setTargetPrice(event.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
                </label>
                <div className="flex gap-2"><button type="submit" disabled={alertMutation.isPending} className="rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Save alert</button><button type="button" onClick={() => setShowAlertForm(false)} className="rounded-md border border-border px-3 py-2 text-xs font-bold">Cancel</button></div>
                {alertMutation.isError && <p role="alert" className="text-xs text-destructive">Could not save this alert.</p>}
              </form>
            )}
            {showInviteForm && (
              <form className="mt-4 space-y-3 border-t border-border pt-4" onSubmit={(event) => { event.preventDefault(); if (recipientId) inviteMutation.mutate(recipientId); }}>
                <label className="grid gap-1 text-xs font-bold">Friend
                  <select value={recipientId} onChange={(event) => setRecipientId(event.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm">{friendsQuery.data?.map((friend) => <option key={friend.user.id} value={friend.user.id}>{friend.user.display_name}</option>)}</select>
                </label>
                <div className="flex gap-2"><button type="submit" disabled={inviteMutation.isPending} className="rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Send invite</button><button type="button" onClick={() => setShowInviteForm(false)} className="rounded-md border border-border px-3 py-2 text-xs font-bold">Cancel</button></div>
                {inviteMutation.isError && <p role="alert" className="text-xs text-destructive">Could not send this invite.</p>}
              </form>
            )}
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
