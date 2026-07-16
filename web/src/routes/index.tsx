import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Plus, Search, Sparkles } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { getTrendingGames } from "@/lib/api";
import { lovableQueryKeys, toGameCard } from "@/lib/lovable-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — GameFinder" },
      { name: "description", content: "Browse games from the public catalog." },
    ],
  }),
  component: Dashboard,
});

export function Dashboard() {
  const trendingQuery = useQuery({
    queryKey: lovableQueryKeys.trendingGames(3),
    queryFn: () => getTrendingGames(3),
  });
  const trending = trendingQuery.data?.results.map(toGameCard) ?? [];
  const featured = trending[0];

  return (
    <AppShell>
      <section className="animate-reveal mb-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.25em] text-primary">Discover</p>
            <h1 className="text-4xl font-extrabold tracking-tight text-balance">Find your next game</h1>
            <p className="mt-2 text-muted-foreground">Browse titles from the public game catalog.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/steam" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90">Connect Steam</Link>
          </div>
        </div>

        <Link to="/search" className="mb-8 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-white/20">
          <Search className="size-4" /> Search the public game catalog
          <kbd className="ml-auto rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
        </Link>

        {trendingQuery.isError && <div className="mb-6 rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">Failed to load games.</div>}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {featured ? <Link to="/games/$gameId" params={{ gameId: featured.id ?? "data-unavailable" }} className="group relative overflow-hidden rounded-2xl border border-border bg-surface ring-1 ring-white/5 transition hover:ring-white/20">
            <GameCover from={featured.imageUrl ?? "Data unavailable"} to={featured.imageUrl ?? "Data unavailable"} title={featured.title ?? "Data unavailable"} className="aspect-video w-full" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/80 to-transparent p-6">
              <div className="mb-2 flex items-center gap-2"><Chip tone="primary">Trending</Chip><Chip tone="outline">{featured.released ?? "Data unavailable"}</Chip></div>
              <h3 className="text-2xl font-bold">{featured.title ?? "Data unavailable"}</h3>
              <p className="mt-1 text-sm text-muted-foreground">Data unavailable</p>
            </div>
          </Link> : <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface ring-1 ring-white/5"><div className="aspect-video w-full" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/80 to-transparent p-6"><h3 className="text-2xl font-bold">Data unavailable</h3></div></div>}

          <div className="flex flex-col gap-4">
            {trending.slice(1, 3).map((game) => <Link key={game.id} to="/games/$gameId" params={{ gameId: game.id ?? "data-unavailable" }} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 transition hover:border-white/20">
              <div className="flex min-w-0 items-center gap-4"><GameCover from={game.imageUrl ?? "Data unavailable"} to={game.imageUrl ?? "Data unavailable"} title={game.title ?? "Data unavailable"} compact className="size-20 shrink-0 rounded-lg" /><div className="min-w-0"><h4 className="truncate font-bold">{game.title ?? "Data unavailable"}</h4><p className="mt-0.5 text-xs text-muted-foreground">{game.released ?? "Data unavailable"}</p><div className="mt-2 flex items-center gap-1.5"><Chip>Data unavailable</Chip></div></div></div><span className="shrink-0 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-bold">View</span>
            </Link>)}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="space-y-12 lg:col-span-8">
          <section className="animate-reveal" style={{ animationDelay: "100ms" }}>
            <SectionHeader title="Trending games" hint="Titles returned by the public catalog." action={<Link to="/search" className="flex items-center gap-1 text-sm font-semibold text-primary">Explore <ArrowRight className="size-3.5" /></Link>} />
            <div className="grid grid-cols-2 gap-5 lg:grid-cols-3">
              {trending.map((game) => <Link key={game.id} to="/games/$gameId" params={{ gameId: game.id ?? "data-unavailable" }} className="group cursor-pointer overflow-hidden rounded-xl border border-border bg-surface transition hover:border-white/20">
                <GameCover from={game.imageUrl ?? "Data unavailable"} to={game.imageUrl ?? "Data unavailable"} title={game.title ?? "Data unavailable"} className="aspect-[4/5] w-full" />
                <div className="p-4"><div className="mb-2 flex items-center gap-1.5"><Sparkles className="size-3 text-primary" /><span className="font-mono text-[10px] uppercase tracking-widest text-primary">Trending</span></div><h5 className="text-sm font-bold group-hover:text-primary">{game.title ?? "Data unavailable"}</h5><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{game.released ?? "Data unavailable"}</p><div className="mt-3 flex items-center justify-between"><span className="font-mono text-sm">Data unavailable</span></div></div>
              </Link>)}
            </div>
          </section>
          <section className="animate-reveal" style={{ animationDelay: "150ms" }}><div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-6"><div className="mb-6 flex items-center gap-3"><span className="size-2 animate-pulse-soft rounded-full bg-primary" /><h2 className="text-lg font-bold">Wishlist drops</h2><span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Data unavailable</span></div><div className="space-y-3"><p className="text-sm text-muted-foreground">Connect Steam to view your saved games.</p></div></div></section>
        </div>
        <div className="space-y-10 lg:col-span-4">
          <section className="animate-reveal" style={{ animationDelay: "200ms" }}><SectionHeader title="Online now" /><div className="space-y-2"><p className="rounded-xl border border-transparent p-3 text-sm text-muted-foreground">Connect Steam to view friends.</p></div></section>
          <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6"><div className="absolute -right-8 -bottom-8 size-32 rounded-full bg-primary/20 blur-3xl" /><div className="relative"><p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-primary">Steam</p><h3 className="mb-2 font-bold">Connect Steam</h3><p className="mb-4 text-sm text-muted-foreground">Connect your account to view your library.</p><Link to="/steam" className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-bold hover:bg-white/5">Connect Steam <ArrowRight className="size-3.5" /></Link></div></section>
          <section className="animate-reveal" style={{ animationDelay: "250ms" }}><SectionHeader title="Activity" /><div className="space-y-4 font-mono text-[11px] leading-relaxed"><p className="text-muted-foreground">Data unavailable</p></div><button className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground"><Plus className="size-3" /> Post an update</button></section>
        </div>
      </div>
    </AppShell>
  );
}
