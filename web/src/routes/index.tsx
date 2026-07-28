import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Tag } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, Panel, SectionHeader } from "@/components/ui-bits";
import { getDeals, getTrendingGames, searchGames } from "@/lib/api";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [query, setQuery] = useState("");
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
        <p className="label-mono mb-3 text-primary">Playfinder</p>
        <h1 className="max-w-2xl text-5xl font-bold tracking-tight">Find your next game</h1>
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
      <SectionHeader title="Price drops" hint="Live store prices" />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {deals.map((deal) => (
          <a
            key={deal.id ?? deal.name}
            href={deal.url ?? undefined}
            target="_blank"
            rel="noreferrer"
          >
            <Panel interactive className="h-full">
              <GameCover
                from="#c75f28"
                to="#22243a"
                title={deal.name}
                bare
                className="aspect-video w-full"
              />
              <div className="p-4">
                <div className="mb-2 flex gap-2">
                  <Chip tone="primary">
                    <Tag className="mr-1 size-3" />
                    {deal.current?.cut ? `-${deal.current.cut}%` : "Deal"}
                  </Chip>
                </div>
                <h2 className="font-bold">{deal.name}</h2>
                <p className="mt-2 font-mono text-primary">
                  {deal.current?.price
                    ? `${deal.current.price.amount} ${deal.current.price.currency}`
                    : "View offer"}
                </p>
              </div>
            </Panel>
          </a>
        ))}
      </div>
      <SectionHeader title="Trending" hint="Live catalogue" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {(trendingQuery.data?.results ?? []).map((game) => (
          <Link key={game.id} to="/games/$gameId" params={{ gameId: String(game.id) }}>
            <Panel interactive>
              <GameCover
                from="#c75f28"
                to="#22243a"
                title={game.name}
                className="aspect-[3/4] w-full"
              />
              <p className="p-3 text-sm font-bold">{game.name}</p>
            </Panel>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
