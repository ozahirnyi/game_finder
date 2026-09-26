import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar, GameCover } from "@/components/GameCover";
import { GameCard } from "@/components/GameCard";
import { GameRecentPlayers } from "@/components/GameRecentPlayers";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { PriceAlertForm } from "@/components/PriceAlertForm";
import {
  formatCatalogRating,
  formatCatalogReleaseDate,
  presentPriceHistory,
  shouldRenderPriceHistory,
} from "@/lib/gamePresentation";
import { summarizePlatforms } from "@/lib/platformPresentation";
import {
  Chip,
  EmptyState,
  Panel,
  PresenceDot,
  PriceBlock,
  SectionHeader,
} from "@/components/ui-bits";
import {
  addSteamWishlist,
  addWishlist,
  ApiError,
  createGameInvite,
  createPriceAlert,
  getCatalogGame,
  getFavorites,
  getFriends,
  getPriceHistory,
  getRecentGamePlayers,
  getRecentSteamGamePlayers,
  getSimilarCatalogGames,
  getSteamGame,
  getSteamPriceHistory,
  getWishlist,
  removeFavorite,
  saveCatalogGameToFavorites,
  searchGames,
  type CatalogGame,
  type PriceAlertCreate,
  type PriceHistoryPeriod,
} from "@/lib/api";
import { exactCatalogMatch, hasCatalogId } from "@/lib/catalogMatch";
import { getGameMediaCandidates } from "@/lib/gameMedia";
import { ArrowLeft, Bell, ExternalLink, Heart, Share2, Sparkles, Users } from "lucide-react";

export const Route = createFileRoute("/games/$gameId")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { title?: string; source?: "steam"; returnTo?: string } => ({
    ...(typeof search.title === "string" ? { title: search.title } : {}),
    ...(search.source === "steam" ? { source: "steam" } : {}),
    ...(typeof search.returnTo === "string" && search.returnTo.startsWith("/search?")
      ? { returnTo: search.returnTo }
      : {}),
  }),
  loaderDeps: ({ search }) => ({ title: search.title, source: search.source }),
  loader: async ({ params, deps }) => {
    try {
      if (deps.source === "steam") {
        const steamGame = await getSteamGame(params.gameId);
        if (steamGame.catalog_game_id) {
          const catalog = await getCatalogGame(steamGame.catalog_game_id);
          if (hasCatalogId(catalog)) {
            return {
              game: {
                id: String(catalog.id),
                title: catalog.name,
                coverFrom: "#1d4ed8",
                coverTo: "#111827",
                heroUrl: catalog.hero_image ?? undefined,
                heroWidth: catalog.hero_width ?? undefined,
                heroHeight: catalog.hero_height ?? undefined,
                screenshotUrl: catalog.screenshot_image ?? undefined,
                screenshotWidth: catalog.screenshot_width ?? undefined,
                screenshotHeight: catalog.screenshot_height ?? undefined,
                coverUrl: catalog.cover_image ?? catalog.background_image ?? undefined,
                fallbackCoverUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${params.gameId}/library_hero.jpg`,
                genres: catalog.genres ?? steamGame.genres ?? [],
                platforms: catalog.platforms ?? steamGame.platforms ?? ["PC"],
                releaseDate: catalog.released ?? steamGame.released ?? undefined,
                rating: catalog.rating ?? steamGame.rating ?? 0,
                description:
                  catalog.description_raw ?? steamGame.description_raw ?? "Steam Store game.",
                price: steamGame.current?.price?.amount ?? null,
                originalPrice: steamGame.current?.regular?.amount ?? null,
                discount: steamGame.current?.cut ?? null,
                currency: steamGame.current?.price?.currency,
                store: steamGame.current?.shop ?? "Steam",
                storeUrl: steamGame.current?.url ?? steamGame.url ?? undefined,
                coop: false,
                isSteamLibrary: false,
                steamAppId: Number(params.gameId),
              },
            };
          }
        }
        return {
          game: {
            id: params.gameId,
            title: steamGame.name,
            coverFrom: "#1d4ed8",
            coverTo: "#111827",
            heroUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${params.gameId}/library_hero.jpg`,
            // Steam's library hero asset is the documented 3840×1240 library-art slot.
            heroWidth: 3840,
            heroHeight: 1240,
            coverUrl: undefined,
            fallbackCoverUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${params.gameId}/header.jpg`,
            genres: steamGame.genres ?? [],
            platforms: steamGame.platforms ?? ["PC"],
            releaseDate: steamGame.released ?? undefined,
            rating: steamGame.rating ?? 0,
            description: steamGame.description_raw ?? "Steam Store game.",
            price: steamGame.current?.price?.amount ?? null,
            originalPrice: steamGame.current?.regular?.amount ?? null,
            discount: steamGame.current?.cut ?? null,
            currency: steamGame.current?.price?.currency,
            store: steamGame.current?.shop ?? "Steam",
            storeUrl:
              steamGame.current?.url ??
              steamGame.url ??
              `https://store.steampowered.com/app/${params.gameId}/`,
            coop: false,
            isSteamLibrary: true,
            steamAppId: Number(params.gameId),
          },
        };
      }
      const loadCatalogGame = async (
        id: string | number,
      ): Promise<CatalogGame & { id: number }> => {
        const catalog = await getCatalogGame(id);
        if (!hasCatalogId(catalog)) throw new Error("Catalog game has no route-safe ID");
        return catalog;
      };
      let catalog: CatalogGame & { id: number };
      try {
        catalog = await loadCatalogGame(params.gameId);
        if (deps.title && !exactCatalogMatch([catalog], deps.title)) {
          throw new Error("Catalog ID does not match library title");
        }
      } catch {
        if (!deps.title) throw new Error("Catalog title unavailable");
        const results = (await searchGames({ query: deps.title })).results.filter(hasCatalogId);
        const match = exactCatalogMatch(results, deps.title);
        if (!match) throw new Error("Catalog game unavailable");
        catalog = await loadCatalogGame(match.id);
      }
      return {
        game: {
          id: String(catalog.id),
          title: catalog.name,
          coverFrom: "#1d4ed8",
          coverTo: "#111827",
          heroUrl: catalog.hero_image ?? undefined,
          heroWidth: catalog.hero_width ?? undefined,
          heroHeight: catalog.hero_height ?? undefined,
          screenshotUrl: catalog.screenshot_image ?? undefined,
          screenshotWidth: catalog.screenshot_width ?? undefined,
          screenshotHeight: catalog.screenshot_height ?? undefined,
          coverUrl: catalog.cover_image ?? catalog.background_image ?? undefined,
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
          steamAppId:
            typeof catalog.steam_appid === "number" && catalog.steam_appid > 0
              ? catalog.steam_appid
              : null,
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
          ...((
            loaderData.game.heroUrl &&
            loaderData.game.heroWidth &&
            loaderData.game.heroHeight &&
            loaderData.game.heroWidth >= 1280 &&
            loaderData.game.heroWidth / loaderData.game.heroHeight >= 1.5
              ? loaderData.game.heroUrl
              : loaderData.game.coverUrl
          )
            ? [
                {
                  property: "og:image",
                  content:
                    (loaderData.game.heroUrl &&
                    loaderData.game.heroWidth &&
                    loaderData.game.heroHeight &&
                    loaderData.game.heroWidth >= 1280 &&
                    loaderData.game.heroWidth / loaderData.game.heroHeight >= 1.5
                      ? loaderData.game.heroUrl
                      : loaderData.game.coverUrl) ?? "",
                },
                {
                  name: "twitter:image",
                  content:
                    (loaderData.game.heroUrl &&
                    loaderData.game.heroWidth &&
                    loaderData.game.heroHeight &&
                    loaderData.game.heroWidth >= 1280 &&
                    loaderData.game.heroWidth / loaderData.game.heroHeight >= 1.5
                      ? loaderData.game.heroUrl
                      : loaderData.game.coverUrl) ?? "",
                },
              ]
            : []),
        ]
      : [{ title: "Game not found — Playfinder" }, { name: "robots", content: "noindex" }],
  }),
  component: GameDetail,
  notFoundComponent: GameNotFound,
});

function searchBackParams(returnTo?: string) {
  if (!returnTo) return {};
  const params = new URLSearchParams(returnTo.slice("/search?".length));
  const query = params.get("q")?.trim();
  return params.get("mode") === "ai" && query ? { mode: "ai", q: query } : {};
}

function SearchBackLink({ returnTo, className }: { returnTo?: string; className: string }) {
  return (
    <Link to="/search" search={searchBackParams(returnTo)} className={className}>
      <ArrowLeft className="size-3.5" /> Back to search
    </Link>
  );
}

function GameNotFound() {
  const { returnTo } = Route.useSearch();
  return (
    <AppShell>
      <div className="mx-auto max-w-md py-24 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">404</p>
        <h1 className="mt-3 text-2xl font-bold">Game not in catalog</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn't find that title. It may have been delisted.
        </p>
        <SearchBackLink
          returnTo={returnTo}
          className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
        />
      </div>
    </AppShell>
  );
}

export function mergeGamePrice<
  T extends {
    price: number | null;
    originalPrice: number | null;
    discount: number | null;
    currency?: string;
    store?: string;
    storeUrl?: string;
  },
>(
  game: T,
  current?: {
    price?: { amount?: number | null; currency?: string | null } | null;
    regular?: { amount?: number | null } | null;
    cut?: number | null;
    shop?: string | null;
    url?: string | null;
  } | null,
): T {
  return {
    ...game,
    price: current?.price?.amount ?? game.price,
    originalPrice: current?.regular?.amount ?? game.originalPrice,
    discount: current?.cut ?? game.discount,
    currency: current?.price?.currency ?? game.currency,
    store: game.store ?? current?.shop ?? undefined,
    storeUrl: game.storeUrl ?? current?.url ?? undefined,
  };
}

function GameDetail() {
  const { game: catalogGame } = Route.useLoaderData();
  const { returnTo } = Route.useSearch();
  const [historyPeriod, setHistoryPeriod] = useState<PriceHistoryPeriod>("6m");
  const priceQuery = useQuery({
    queryKey: [
      "price-history",
      catalogGame.steamAppId ? "steam" : "catalog",
      catalogGame.id,
      historyPeriod,
    ],
    queryFn: () =>
      catalogGame.steamAppId
        ? getSteamPriceHistory(catalogGame.steamAppId, "US", historyPeriod)
        : getPriceHistory(catalogGame.id, "US", historyPeriod),
  });
  const similarQuery = useQuery({
    queryKey: ["catalog-similar-games", catalogGame.id],
    queryFn: () => getSimilarCatalogGames(catalogGame.id),
    enabled: !catalogGame.isSteamLibrary,
  });
  const activePlayersQuery = useQuery({
    queryKey: [
      "recent-game-players",
      catalogGame.steamAppId ? "steam" : "catalog",
      catalogGame.steamAppId ?? catalogGame.id,
    ],
    queryFn: () =>
      catalogGame.steamAppId
        ? getRecentSteamGamePlayers(catalogGame.steamAppId)
        : getRecentGamePlayers(catalogGame.id),
  });
  const queryClient = useQueryClient();
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [wishlistAdded, setWishlistAdded] = useState(false);
  const [favoriteAdded, setFavoriteAdded] = useState(false);
  const wishlistQuery = useQuery({ queryKey: ["wishlist"], queryFn: getWishlist });
  const favoritesQuery = useQuery({
    queryKey: ["favorites"],
    queryFn: getFavorites,
    enabled: !catalogGame.isSteamLibrary,
  });
  const friendsQuery = useQuery({ queryKey: ["friends"], queryFn: getFriends });
  const wishlistMutation = useMutation({
    mutationFn: () =>
      catalogGame.isSteamLibrary
        ? addSteamWishlist(catalogGame.id)
        : addWishlist({
            id: Number(catalogGame.id),
            name: catalogGame.title,
            background_image: catalogGame.coverUrl ?? null,
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      setWishlistAdded(true);
      setActionMessage("Added to wishlist");
    },
  });
  const favoriteMutation = useMutation({
    mutationFn: () => saveCatalogGameToFavorites(Number(catalogGame.id)),
    onSuccess: () => {
      setFavoriteAdded(true);
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });
  const removeFavoriteMutation = useMutation({
    mutationFn: () => removeFavorite(Number(catalogGame.id)),
    onSuccess: () => {
      setFavoriteAdded(false);
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });
  const alertMutation = useMutation({
    mutationFn: async (alert: PriceAlertCreate) => {
      const catalogGameId = Number(catalogGame.id);
      if (!wishlistQuery.data?.some((item) => item.catalog_game_id === catalogGameId)) {
        try {
          await addWishlist({
            id: catalogGameId,
            name: catalogGame.title,
            background_image: catalogGame.coverUrl ?? null,
          });
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 409)) throw error;
        }
      }
      return createPriceAlert({ ...alert, wishlist_catalog_game_id: catalogGameId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      queryClient.invalidateQueries({ queryKey: ["price-alerts"] });
      setShowAlertForm(false);
      setActionMessage("Alert saved");
    },
  });
  const inviteMutation = useMutation({
    mutationFn: (recipient_id: string) =>
      createGameInvite({
        recipient_id,
        game_name: catalogGame.title,
        game_id: Number(catalogGame.id),
        source: catalogGame.isSteamLibrary ? "steam" : "igdb",
        external_id: String(catalogGame.id),
      }),
    onSuccess: () => {
      setShowInviteForm(false);
      setActionMessage("Invite sent");
    },
  });
  const current = priceQuery.data?.current;
  const game = mergeGamePrice(catalogGame, current);
  const wideCandidates = getGameMediaCandidates(
    {
      heroUrl: game.heroUrl,
      coverUrl: game.coverUrl,
      screenshotUrl: game.screenshotUrl,
      steamAppId: game.steamAppId,
      heroWidth: game.heroWidth,
      heroHeight: game.heroHeight,
      screenshotWidth: game.screenshotWidth,
      screenshotHeight: game.screenshotHeight,
    },
    "banner",
  ).filter((candidate) => candidate.kind === "wide");
  const wideKey = wideCandidates.map((candidate) => candidate.src).join("\n");
  const [wideExhausted, setWideExhausted] = useState(false);
  useEffect(() => setWideExhausted(false), [wideKey]);
  const hasHero = wideCandidates.length > 0 && !wideExhausted;
  const isInWishlist =
    wishlistAdded ||
    wishlistQuery.data?.some((item) =>
      catalogGame.isSteamLibrary
        ? item.source === "steam" && item.external_id === String(catalogGame.id)
        : item.source !== "steam" && item.catalog_game_id === Number(catalogGame.id),
    );
  const isFavorite =
    favoriteAdded ||
    !!favoritesQuery.data?.some((item) => item.catalog_game_id === Number(catalogGame.id));

  const owners: Array<{
    id: string;
    avatarFrom: string;
    avatarTo: string;
    name: string;
    online: boolean;
    activity?: string;
  }> = [];
  const priceUnavailable = game.price == null && !priceQuery.data?.is_free;
  const platformSummary = summarizePlatforms(game.platforms);
  const rating = formatCatalogRating(game.rating);
  const releaseDate = formatCatalogReleaseDate(game.releaseDate);
  const heroMetadata = [
    ...platformSummary.visible,
    ...(releaseDate === "Unknown" ? [] : [releaseDate]),
    ...(rating === "Not rated yet" ? [] : [`${rating} critic score`]),
  ];
  const priceHistory = presentPriceHistory(priceQuery.data?.history ?? [], current?.price);
  const historyCurrency = priceHistory.points.find((point) => point.currency)?.currency;
  const showPriceHistory = shouldRenderPriceHistory(priceQuery.data?.is_free === true);
  const historyPeriodLabels: Record<PriceHistoryPeriod, string> = {
    "6m": "6 months",
    "1y": "1 year",
    "2y": "2 years",
  };
  const similar = (similarQuery.data?.results ?? [])
    .filter((candidate) => candidate.id != null && String(candidate.id) !== catalogGame.id)
    .slice(0, 4);
  return (
    <AppShell>
      <SearchBackLink
        returnTo={returnTo}
        className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm font-bold text-foreground transition hover:border-primary/40 hover:text-primary"
      />

      <section
        className={
          hasHero
            ? "relative mb-10 overflow-hidden rounded-3xl border border-border"
            : "mb-10 flex flex-col gap-6 rounded-3xl border border-border bg-surface-1 p-6 sm:flex-row sm:items-end"
        }
      >
        <GameCover
          from={game.coverFrom}
          to={game.coverTo}
          title={game.title}
          candidates={
            hasHero
              ? wideCandidates
              : getGameMediaCandidates(
                  { coverUrl: game.coverUrl, steamAppId: game.steamAppId },
                  "poster",
                )
          }
          onExhausted={hasHero ? () => setWideExhausted(true) : undefined}
          priority={hasHero}
          fit={hasHero ? "cover" : "contain"}
          bare
          variant={hasHero ? "hero" : "card"}
          className={
            hasHero
              ? "h-[340px] w-full sm:h-[420px]"
              : "aspect-[2/3] w-40 shrink-0 self-center sm:w-52"
          }
        />
        <div
          className={
            hasHero
              ? "absolute inset-x-0 bottom-0 min-w-0 p-6 text-white [text-shadow:0_2px_5px_rgb(0_0_0/90%)] sm:p-8"
              : "min-w-0"
          }
        >
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
          <p
            className={`mt-2 max-w-2xl text-sm ${hasHero ? "text-white/90" : "text-muted-foreground"}`}
          >
            {heroMetadata.join(" · ")}
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
                  { l: "Rating", v: rating },
                  { l: "Release date", v: releaseDate },
                ].map((r) => (
                  <div
                    key={r.l}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3"
                  >
                    <dt className="label-mono text-muted-foreground">{r.l}</dt>
                    <dd className="text-right text-sm font-bold">{r.v}</dd>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
                  <dt className="label-mono text-muted-foreground">Platforms</dt>
                  <dd className="text-right text-sm font-bold">
                    {showAllPlatforms
                      ? game.platforms.join(", ")
                      : platformSummary.visible.join(", ")}
                    {platformSummary.remainingCount > 0 && (
                      <button
                        type="button"
                        className="ml-2 text-xs font-semibold text-primary hover:underline"
                        onClick={() => setShowAllPlatforms((visible) => !visible)}
                      >
                        {showAllPlatforms ? "Show fewer platforms" : "Show all platforms"}
                      </button>
                    )}
                  </dd>
                </div>
              </dl>
            </Panel>
          </section>

          {owners.length > 0 && (
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
                      to="/friends"
                      className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-bold hover:bg-foreground/5"
                    >
                      Friends
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          {showPriceHistory && (
            <section>
              <SectionHeader
                title="Steam price history"
                hint={
                  historyCurrency
                    ? `Steam history source currency: ${historyCurrency}.`
                    : "Steam price events."
                }
              />
              <div className="rounded-2xl border border-border bg-surface p-6">
                <div className="mb-5 flex gap-2" aria-label="Price history period">
                  {(Object.entries(historyPeriodLabels) as Array<[PriceHistoryPeriod, string]>).map(
                    ([period, label]) => (
                      <button
                        key={period}
                        type="button"
                        aria-pressed={historyPeriod === period}
                        onClick={() => setHistoryPeriod(period)}
                        className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                      >
                        {label}
                      </button>
                    ),
                  )}
                </div>
                {priceQuery.isPending ? (
                  <p className="text-sm text-muted-foreground">Loading price history…</p>
                ) : priceQuery.isError ? (
                  <div className="text-sm text-muted-foreground">
                    <p>Price history is unavailable.</p>
                    <button
                      type="button"
                      onClick={() => void priceQuery.refetch()}
                      className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-bold"
                    >
                      Retry price history
                    </button>
                  </div>
                ) : (
                  <PriceHistoryChart
                    points={priceHistory.points}
                    currency={historyCurrency ?? game.currency}
                    currentPrice={historyCurrency === game.currency ? game.price : undefined}
                    historyAvailable={priceQuery.data?.history_available ?? false}
                    unavailableMessage={priceQuery.data?.provider_message}
                    periodLabel={historyPeriodLabels[historyPeriod]}
                    onRetry={() => void priceQuery.refetch()}
                  />
                )}
              </div>
            </section>
          )}

          <section>
            <SectionHeader title="You might also like" />
            {catalogGame.isSteamLibrary ? (
              <p className="text-sm text-muted-foreground">
                Similar catalog games are unavailable for this Steam-only title.
              </p>
            ) : similarQuery.isPending ? (
              <p className="text-sm text-muted-foreground">Loading similar games…</p>
            ) : similarQuery.isError ? (
              <div className="text-sm text-muted-foreground">
                <p>Similar games are unavailable.</p>
                <button
                  type="button"
                  onClick={() => void similarQuery.refetch()}
                  className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-bold"
                >
                  Retry similar games
                </button>
              </div>
            ) : similar.length === 0 ? (
              <p className="text-sm text-muted-foreground">No similar games are available yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {similar.map((candidate) => (
                  <GameCard
                    key={candidate.id}
                    showPrice={false}
                    game={{
                      gameId: String(candidate.id),
                      title: candidate.name,
                      heroUrl: candidate.hero_image ?? undefined,
                      coverUrl: candidate.cover_image ?? candidate.background_image ?? undefined,
                      screenshotUrl: candidate.screenshot_image ?? undefined,
                      steamAppId: candidate.steam_appid,
                      coverWidth: candidate.cover_width,
                      coverHeight: candidate.cover_height,
                      heroWidth: candidate.hero_width,
                      heroHeight: candidate.hero_height,
                      screenshotWidth: candidate.screenshot_width,
                      screenshotHeight: candidate.screenshot_height,
                      coverFrom: "#1d4ed8",
                      coverTo: "#111827",
                      genres: candidate.genres,
                      platforms: candidate.platforms,
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <p className="label-mono mb-3 text-muted-foreground">Best price</p>
            {priceQuery.data?.is_free ? (
              <p className="text-3xl font-extrabold">Free</p>
            ) : (
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
            )}
            {!priceQuery.data?.history_available && priceQuery.data?.provider_message && (
              <p className="mt-3 text-sm text-muted-foreground">
                {priceQuery.data.provider_message}
              </p>
            )}

            <button
              onClick={() => wishlistMutation.mutate()}
              disabled={wishlistMutation.isPending || isInWishlist}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90"
            >
              <Heart className="size-4" />{" "}
              {wishlistMutation.isPending
                ? "Adding…"
                : isInWishlist
                  ? "In wishlist"
                  : "Add to wishlist"}
            </button>

            {!catalogGame.isSteamLibrary && (
              <button
                type="button"
                onClick={() =>
                  isFavorite ? removeFavoriteMutation.mutate() : favoriteMutation.mutate()
                }
                disabled={favoriteMutation.isPending || removeFavoriteMutation.isPending}
                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-bold transition hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Heart className="size-4" />
                {favoriteMutation.isPending || removeFavoriteMutation.isPending
                  ? "Saving…"
                  : isFavorite
                    ? "In favorites"
                    : "Favorite"}
              </button>
            )}
            {(favoriteMutation.isError || removeFavoriteMutation.isError) && (
              <p role="alert" className="mt-3 text-xs font-semibold text-destructive">
                Could not update favorites.
              </p>
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
              <button
                onClick={() => setShowAlertForm(true)}
                disabled={catalogGame.isSteamLibrary}
                className="flex items-center justify-center gap-1 rounded-md border border-border bg-secondary py-2 text-xs font-bold hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Bell className="size-3.5" /> Alert
              </button>
              <button
                onClick={() => {
                  setRecipientId(friendsQuery.data?.[0]?.user.id ?? "");
                  setShowInviteForm(true);
                }}
                disabled={friendsQuery.isLoading || !friendsQuery.data?.length}
                title={
                  !friendsQuery.data?.length
                    ? "Add a PlayFinder friend to send an invite."
                    : undefined
                }
                className="flex items-center justify-center gap-1 rounded-md border border-border bg-secondary py-2 text-xs font-bold hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Users className="size-3.5" /> Invite
              </button>
              <button
                onClick={async () => {
                  try {
                    const url = new URL(`/games/${game.id}`, window.location.origin).href;
                    if (navigator.share) await navigator.share({ title: game.title, url });
                    else {
                      await navigator.clipboard.writeText(url);
                      setActionMessage("Link copied");
                    }
                  } catch {
                    setActionMessage("Could not share this link");
                  }
                }}
                className="flex items-center justify-center gap-1 rounded-md border border-border bg-secondary py-2 text-xs font-bold hover:bg-foreground/5"
              >
                <Share2 className="size-3.5" /> Share
              </button>
            </div>
            {actionMessage && (
              <p role="status" className="mt-3 text-xs font-semibold text-muted-foreground">
                {actionMessage}
              </p>
            )}
            {!friendsQuery.isLoading && !friendsQuery.data?.length && (
              <p className="mt-3 text-xs text-muted-foreground">
                Add a PlayFinder friend to send an invite.
              </p>
            )}
            {showAlertForm && (
              <div className="mt-4 border-t border-border pt-4">
                <PriceAlertForm
                  wishlistCatalogGameId={Number(catalogGame.id)}
                  onSubmit={(data) => alertMutation.mutate(data)}
                  onCancel={() => setShowAlertForm(false)}
                  isPending={alertMutation.isPending}
                  errorMessage={
                    alertMutation.error instanceof Error ? alertMutation.error.message : undefined
                  }
                />
              </div>
            )}
            {showInviteForm && (
              <form
                className="mt-4 min-w-0 max-w-full space-y-3 border-t border-border pt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (recipientId) inviteMutation.mutate(recipientId);
                }}
              >
                <label className="grid min-w-0 gap-1 text-xs font-bold">
                  Friend
                  <select
                    value={recipientId}
                    onChange={(event) => setRecipientId(event.target.value)}
                    className="min-w-0 w-full max-w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    {friendsQuery.data?.map((friend) => (
                      <option key={friend.user.id} value={friend.user.id}>
                        {friend.user.display_name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={inviteMutation.isPending}
                    className="rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                  >
                    Send invite
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInviteForm(false)}
                    className="rounded-md border border-border px-3 py-2 text-xs font-bold"
                  >
                    Cancel
                  </button>
                </div>
                {inviteMutation.isError && (
                  <p role="alert" className="text-xs text-destructive">
                    Could not send this invite.
                  </p>
                )}
              </form>
            )}
          </div>
          <GameRecentPlayers
            players={activePlayersQuery.data?.players ?? []}
            status={activePlayersQuery.data?.status ?? "ready"}
            isPending={activePlayersQuery.isPending}
            isError={activePlayersQuery.isError}
            onRetry={() => void activePlayersQuery.refetch()}
          />
        </div>
      </div>
    </AppShell>
  );
}
