import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Search, Tag, Users } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { AppShell } from "@/components/AppShell";
import { GameCard } from "@/components/GameCard";
import { GameCover } from "@/components/GameCover";
import { Chip, EmptyState, Panel, PriceBlock, SectionHeader, Stat } from "@/components/ui-bits";
import {
  getAuthSnapshot,
  getDashboard,
  getDeals,
  getFriends,
  getLibraryOverview,
  getProfile,
  getTrendingGames,
  searchGames,
  subscribeToAuthChanges,
  type DashboardRecommendation,
} from "@/lib/api";
import { gameDetailTarget } from "@/lib/gameRoute";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const signedIn = useSyncExternalStore(subscribeToAuthChanges, getAuthSnapshot, () => false);
  const [region, setRegion] = useState("US");
  const [query, setQuery] = useState("");
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: getProfile, enabled: signedIn });
  const libraryQuery = useQuery({
    queryKey: ["library-overview"],
    queryFn: getLibraryOverview,
    enabled: signedIn,
  });
  const friendsQuery = useQuery({ queryKey: ["friends"], queryFn: getFriends, enabled: signedIn });
  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
    enabled: signedIn,
  });
  const trendingQuery = useQuery({
    queryKey: ["trending-games"],
    queryFn: getTrendingGames,
    enabled: !signedIn,
  });
  const searchQuery = useQuery({
    queryKey: ["home-search", query],
    queryFn: () => searchGames({ query }),
    enabled: query.trim().length >= 2,
  });
  const dealsQuery = useQuery({ queryKey: ["deals", region], queryFn: () => getDeals(region, 13) });
  const deals = dealsQuery.data?.results ?? [];
  const results = searchQuery.data?.results ?? [];
  const best = deals[0];
  const rest = deals.slice(1);
  const bestTarget = best ? gameDetailTarget(best.id, best.steam_appid) : undefined;
  const recommendationBlock = dashboardQuery.data?.recommendations;
  const recommendations = recommendationBlock?.data?.recommendations ?? [];
  const trendingGames = trendingQuery.data?.results ?? [];

  return (
    <AppShell>
      <section className="animate-reveal ember-glow grain sheen relative mb-8 overflow-hidden rounded-3xl border border-border bg-surface p-6 sm:p-10">
        <p className="label-mono relative mb-3 text-primary">
          {signedIn ? "Tonight" : "Playfinder"}
        </p>
        <h1 className="relative max-w-2xl text-[2.5rem] font-bold leading-[0.95] tracking-[-0.035em] text-balance sm:text-6xl">
          {signedIn ? "Play with friends tonight" : "Find your next game"}
        </h1>
        <p className="relative mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
          {signedIn
            ? `${profileQuery.data?.display_name ?? "Your dashboard"} · ${libraryQuery.data?.games.length ?? 0} games in your library · ${friendsQuery.data?.length ?? 0} friends connected`
            : "Search games, discover new favourites, and catch live price drops — before you even sign in."}
        </p>
        <form
          action="/search"
          className="relative mt-7 flex flex-col gap-3 sm:flex-row"
          method="get"
        >
          <div className="flex flex-1 items-center gap-3 rounded-2xl border border-border bg-background/70 px-5 py-4 backdrop-blur focus-within:border-primary/60">
            <Search className="size-4 text-muted-foreground" />
            <input
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search games by title"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button
            type="submit"
            className="grid shrink-0 place-items-center rounded-2xl bg-primary px-7 py-4 text-sm font-bold text-primary-foreground shadow-[0_14px_40px_-16px_var(--primary)] transition hover:opacity-90"
          >
            Search games
          </button>
        </form>
        {query.trim() !== "" && (
          <div className="animate-pop relative mt-4 overflow-hidden rounded-2xl border border-border bg-background/80 backdrop-blur">
            {query.trim().length < 2 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                Type at least 2 characters to search.
              </p>
            ) : searchQuery.isFetching ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">Searching games…</p>
            ) : results.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                No matches for “{query}”. Try a shorter title.
              </p>
            ) : (
              results.map((game) => {
                const target = gameDetailTarget(game.id, game.steam_appid);
                return target ? (
                  <Link
                    key={game.id ?? game.steam_appid}
                    to="/games/$gameId"
                    params={{ gameId: target.gameId }}
                    search={{
                      title: game.name,
                      ...(target.source ? { source: target.source } : {}),
                    }}
                    className="flex items-center gap-3 border-b border-border px-4 py-3 text-sm font-semibold transition-colors last:border-b-0 hover:bg-surface-2"
                  >
                    {game.name}
                    <span className="ml-auto label-mono text-muted-foreground">View details</span>
                  </Link>
                ) : null;
              })
            )}
          </div>
        )}
      </section>

      {signedIn && (
        <section className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2">
          <Panel className="p-6">
            <SectionHeader
              title="Your library"
              hint={libraryQuery.data?.steam_error ?? "Steam and PlayStation games"}
            />
            <p className="mt-3 text-sm text-muted-foreground">
              {libraryQuery.data?.games.length
                ? `${libraryQuery.data.games.length} games ready to explore.`
                : "Sync Steam or import PlayStation games to fill your library."}
            </p>
            <Link
              to="/library"
              className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Open library
            </Link>
          </Panel>
          <Panel className="p-6">
            <SectionHeader title="Friends online" hint="Your gaming circle" />
            <p className="mt-3 text-sm text-muted-foreground">
              {friendsQuery.data?.length
                ? `${friendsQuery.data.length} friends connected.`
                : "Add friends to see shared games and activity."}
            </p>
            <Link
              to="/friends"
              className="mt-4 inline-flex rounded-lg border border-border px-4 py-2 text-sm font-bold"
            >
              Open friends
            </Link>
          </Panel>
        </section>
      )}

      <section className="animate-reveal mb-8">
        <div className="mb-5">
          <p className="label-mono mb-2 text-primary">{signedIn ? "For you" : "Discover"}</p>
          <h2 className="text-3xl font-bold tracking-[-0.03em]">
            {signedIn ? "Recommended for you" : "Popular games"}
          </h2>
        </div>
        {signedIn ? (
          dashboardQuery.isPending ? (
            <Panel className="p-6 text-sm text-muted-foreground">Finding recommendations…</Panel>
          ) : recommendationBlock?.status === "ready" && recommendations.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recommendations.map((recommendation) => (
                <RecommendationCard
                  key={`${recommendation.igdb_id ?? recommendation.title}`}
                  recommendation={recommendation}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title={
                recommendationBlock?.status === "error"
                  ? "Recommendations are unavailable"
                  : "No recommendations yet"
              }
              description={
                recommendationBlock?.message ??
                "Connect Steam, import your library, or update your profile to get personalized recommendations."
              }
            />
          )
        ) : trendingQuery.isPending ? (
          <Panel className="p-6 text-sm text-muted-foreground">Popular games · loading</Panel>
        ) : trendingQuery.isError ? (
          <Panel className="p-6 text-sm text-muted-foreground">
            <p>Popular games are unavailable.</p>
            <button
              type="button"
              onClick={() => trendingQuery.refetch()}
              className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-bold"
            >
              Retry popular games
            </button>
          </Panel>
        ) : trendingGames.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {trendingGames.map((game) => (
              <GameCard
                key={game.id}
                game={{
                  gameId: String(game.id),
                  title: game.name,
                  coverUrl: game.background_image ?? undefined,
                  coverFrom: "#c75f28",
                  coverTo: "#22243a",
                }}
              />
            ))}
          </div>
        ) : (
          <Panel className="p-6 text-sm text-muted-foreground">No popular games are available right now.</Panel>
        )}
      </section>

      <section className="animate-reveal mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono mb-2 flex items-center gap-2 text-primary">
            <Tag className="size-3" /> Live deals
          </p>
          <h2 className="text-3xl font-bold tracking-[-0.03em]">Price drops</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="label-mono text-muted-foreground">Region</span>
          <select
            aria-label="Region"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold outline-none focus:border-primary/60"
          >
            {["US", "UA", "GB", "EU"].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </section>
      {dealsQuery.isPending ? (
        <Panel className="p-6 text-sm text-muted-foreground">Live deals · loading</Panel>
      ) : dealsQuery.isError ? (
        <Panel className="p-6 text-sm text-muted-foreground">
          <p>Price drops are unavailable for {region}.</p>
          <button
            type="button"
            onClick={() => dealsQuery.refetch()}
            className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-bold"
          >
            Retry price drops
          </button>
        </Panel>
      ) : deals.length === 0 ? (
        <Panel className="p-6 text-sm text-muted-foreground">
          No price drops are available for {region}.
        </Panel>
      ) : best ? (
        <div className="stagger grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="animate-reveal group lg:col-span-7">
            {bestTarget ? (
              <Link
                to="/games/$gameId"
                params={{ gameId: bestTarget.gameId }}
                search={{
                  title: best.name,
                  ...(bestTarget.source ? { source: bestTarget.source } : {}),
                }}
                className="block h-full"
              >
                <FeaturedDeal deal={best} />
              </Link>
            ) : (
              <FeaturedDeal deal={best} />
            )}
          </div>
          <div className="animate-reveal flex flex-col gap-5 lg:col-span-5">
            <Panel className="ember-glow grain p-5">
              <div className="relative grid grid-cols-2 gap-4">
                <Stat label="Deals" value={deals.length} />
                <Stat label="Region" value={region} />
              </div>
            </Panel>
            <Panel className="flex-1 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-bold">
                  <Users className="size-4 text-primary" /> Friends online
                </h3>
                <Link to="/friends" className="label-mono text-primary">
                  All
                </Link>
              </div>
              {signedIn ? (
                <p className="text-sm text-muted-foreground">
                  {friendsQuery.data?.length
                    ? `${friendsQuery.data.length} friends are connected.`
                    : "Add friends to see shared games and activity."}
                </p>
              ) : (
                <EmptyState
                  title="Sign in to see friends"
                  description="Your friends and their activity appear here."
                />
              )}
            </Panel>
          </div>
          {rest.map((deal, index) => {
            const target = gameDetailTarget(deal.id, deal.steam_appid);
            return (
              <div
                key={deal.id ?? deal.steam_appid ?? deal.name}
                className="animate-reveal lg:col-span-3"
                style={{ animationDelay: `${60 + index * 40}ms` }}
              >
                <GameCard
                  game={{
                    gameId: target?.gameId,
                    source: target?.source,
                    title: deal.name,
                    coverUrl: deal.background_image ?? undefined,
                    coverFrom: "#c75f28",
                    coverTo: "#22243a",
                    price: deal.current?.price?.amount ?? undefined,
                    originalPrice: deal.current?.regular?.amount ?? undefined,
                    discount: deal.current?.cut,
                    currency: deal.current?.price?.currency ?? undefined,
                    store: deal.current?.shop ?? undefined,
                  }}
                />
              </div>
            );
          })}
          {!signedIn && (
            <div className="animate-reveal lg:col-span-12">
              <Panel className="ember-glow grain flex flex-col items-start justify-between gap-5 p-6 sm:flex-row sm:items-center">
                <div className="relative">
                  <h3 className="text-xl font-bold tracking-tight">
                    Save games and get price-drop alerts
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Browsing is free. An account adds wishlist alerts, your library, and friends.
                  </p>
                </div>
                <div className="relative flex shrink-0 flex-wrap gap-2">
                  <Link
                    to="/sign-in"
                    className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/sign-up"
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90"
                  >
                    Create account <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </Panel>
            </div>
          )}
        </div>
      ) : null}
    </AppShell>
  );
}

function RecommendationCard({ recommendation }: { recommendation: DashboardRecommendation }) {
  const content = (
    <Panel interactive className="h-full p-5">
      {recommendation.cover_url && (
        <GameCover
          title={recommendation.title}
          image={recommendation.cover_url}
          from="#c75f28"
          to="#22243a"
          className="mb-4 aspect-[16/9] w-full"
        />
      )}
      <h3 className="text-lg font-bold">{recommendation.title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{recommendation.reason}</p>
      {recommendation.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {recommendation.tags.map((tag) => (
            <Chip key={tag} tone="outline">
              {tag}
            </Chip>
          ))}
        </div>
      )}
    </Panel>
  );

  return (
    <Link
      to="/games/$gameId"
      params={{ gameId: String(recommendation.igdb_id ?? 0) }}
      search={{ title: recommendation.title }}
      className="block h-full"
    >
      {content}
    </Link>
  );
}

function FeaturedDeal({
  deal,
}: {
  deal: NonNullable<
    ReturnType<typeof getDeals> extends Promise<infer Result>
      ? Result extends { results: (infer Deal)[] }
        ? Deal
        : never
      : never
  >;
}) {
  return (
    <Panel interactive className="h-full">
      <GameCover
        from="#c75f28"
        to="#22243a"
        title={deal.name}
        image={deal.background_image ?? undefined}
        bare
        className="aspect-[16/9] w-full"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent p-6 pt-16">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Chip tone="solid">-{deal.current?.cut ?? 0}%</Chip>
          <Chip tone="primary">{deal.current?.shop ?? "Store"}</Chip>
        </div>
        <h3 className="text-3xl font-bold tracking-tight">{deal.name}</h3>
        <div className="mt-3">
          <PriceBlock
            price={deal.current?.price?.amount}
            originalPrice={deal.current?.regular?.amount}
            discount={deal.current?.cut}
            currency={deal.current?.price?.currency}
            store={deal.current?.shop ?? undefined}
            align="left"
          />
        </div>
      </div>
    </Panel>
  );
}
