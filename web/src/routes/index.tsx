import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { AppShell } from "@/components/AppShell";
import { GameCard } from "@/components/GameCard";
import { SectionHeader } from "@/components/ui-bits";
import {
  getAuthSnapshot,
  getDeals,
  getFriends,
  getLibraryOverview,
  getProfile,
  getTrendingGames,
  searchGames,
  subscribeToAuthChanges,
} from "@/lib/api";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const signedIn = useSyncExternalStore(subscribeToAuthChanges, getAuthSnapshot, () => false);
  const [query, setQuery] = useState("");
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: getProfile, enabled: signedIn });
  const libraryQuery = useQuery({
    queryKey: ["library-overview"],
    queryFn: getLibraryOverview,
    enabled: signedIn,
  });
  const friendsQuery = useQuery({ queryKey: ["friends"], queryFn: getFriends, enabled: signedIn });
  const dealsQuery = useQuery({ queryKey: ["deals", "US", "home"], queryFn: () => getDeals("US") });
  const trendingQuery = useQuery({ queryKey: ["trending"], queryFn: getTrendingGames });
  const searchQuery = useQuery({
    queryKey: ["home-search", query],
    queryFn: () => searchGames(query),
    enabled: query.trim().length >= 2,
  });
  const deals = dealsQuery.data?.results ?? [];

  return (
    <AppShell>
      <section className="ember-glow grain mb-8 rounded-3xl border border-border bg-surface p-6 sm:p-10">
        <p className="label-mono mb-3 text-primary">{signedIn ? "Tonight" : "Playfinder"}</p>
        <h1 className="max-w-2xl text-5xl font-bold tracking-tight">
          {signedIn ? "Play with friends tonight" : "Find your next game"}
        </h1>
        {signedIn && (
          <p className="mt-3 text-sm text-muted-foreground">
            {profileQuery.data?.display_name ?? "Your dashboard"} ·{" "}
            {libraryQuery.data?.games.length ?? 0} games in your library ·{" "}
            {friendsQuery.data?.length ?? 0} friends connected
          </p>
        )}
        <div className="mt-7 flex items-center gap-3 rounded-2xl border border-border bg-background px-5 py-4">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search games by title"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        {(searchQuery.data?.results ?? []).slice(0, 4).map((game) => (
          <Link
            key={game.id}
            to="/games/$gameId"
            params={{ gameId: String(game.id) }}
            className="mt-2 flex rounded-xl border border-border p-3 text-sm font-semibold hover:bg-surface-2"
          >
            {game.name}
          </Link>
        ))}
      </section>
      {signedIn && (
        <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2">
          <section className="rounded-2xl border border-border bg-surface p-6">
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
          </section>
          <section className="rounded-2xl border border-border bg-surface p-6">
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
          </section>
        </div>
      )}
      <SectionHeader title="Price drops" hint="Live store prices" />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {deals.map((deal) => (
          <GameCard
            key={deal.id ?? deal.name}
            aspect="aspect-video"
            game={{
              gameId: deal.id == null ? undefined : String(deal.id),
              title: deal.name,
              coverUrl: deal.background_image,
              price: deal.current?.price?.amount,
              originalPrice: deal.current?.regular?.amount,
              discount: deal.current?.cut,
              currency: deal.current?.price?.currency,
              store: deal.current?.shop,
            }}
          />
        ))}
      </div>
      <SectionHeader title="Trending" hint="Live catalogue" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {(trendingQuery.data?.results ?? []).map((game) => (
          <GameCard
            key={game.id}
            game={{
              gameId: String(game.id),
              title: game.name,
              coverUrl: game.background_image,
              genres: game.genres,
              platforms: game.platforms,
            }}
          />
        ))}
      </div>
    </AppShell>
  );
}
