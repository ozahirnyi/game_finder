import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { getDashboard } from "@/lib/api";
import { lovableQueryKeys } from "@/lib/lovable-data";
import { ArrowRight, Search, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({ component: Dashboard });
const message = (value: { message?: string | null }, fallback: string) => value.message || fallback;

export function Dashboard() {
  const query = useQuery({ queryKey: lovableQueryKeys.dashboard, queryFn: getDashboard });
  const data = query.data;
  const recommendations = data?.recommendations.data?.recommendations ?? [];
  const deals = data?.deals.data?.results ?? [];
  const library = data?.library.data;
  const steamConnected = data?.steam.status === "ready" && data.steam.data && ("steam" in data.steam.data ? data.steam.data.steam.linked : data.steam.data.linked);

  return <AppShell>
    <section className="animate-reveal mb-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 font-mono text-[11px] uppercase tracking-[0.25em] text-primary">Discover</p><h1 className="text-4xl font-extrabold tracking-tight text-balance">Find your next game</h1><p className="mt-2 text-muted-foreground">Your library, recommendations, and price changes in one place.</p></div>
        <Link to="/steam" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90">{steamConnected ? "View Steam library" : "Connect Steam"}</Link>
      </div>
      <Link to="/search" className="mb-8 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-white/20"><Search className="size-4" />Search the game catalog</Link>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[
        ["Library", library?.total_games], ["Hours", library?.total_playtime_hours === undefined ? undefined : `${library.total_playtime_hours}h`], ["Manual", library?.manual_games], ["PSN", library?.psn_games],
      ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-border bg-surface p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-black">{value ?? (query.isPending ? "…" : "—")}</p></div>)}</div>
    </section>
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12"><div className="space-y-12 lg:col-span-8">
      <section><SectionHeader title="Recommended for you" hint={data?.recommendations.status === "ready" ? "Based on your saved games." : message(data?.recommendations ?? {}, "Add games to receive recommendations.")} action={<Link to="/search" className="flex items-center gap-1 text-sm font-semibold text-primary">Explore <ArrowRight className="size-3.5" /></Link>} />
        {recommendations.length ? <div className="grid grid-cols-2 gap-5 lg:grid-cols-3">{recommendations.map((item) => <Link key={item.title} to="/search" className="overflow-hidden rounded-xl border border-border bg-surface transition hover:border-white/20"><GameCover from="#14b8a6" to="#0f172a" title={item.title} className="aspect-[4/5] w-full" /><div className="p-4"><div className="mb-2 flex items-center gap-1.5"><Sparkles className="size-3 text-primary" /><span className="font-mono text-[10px] uppercase tracking-widest text-primary">For you</span></div><h3 className="font-bold">{item.title}</h3><p className="mt-1 text-xs text-muted-foreground">{item.reason}</p></div></Link>)}</div> : <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">{message(data?.recommendations ?? {}, "Add a game to your library to get recommendations.")}</p>}</section>
      <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-6"><SectionHeader title="Price drops" hint={deals.length ? "Current deals returned by price providers." : message(data?.deals ?? {}, "No price drops right now.")} />{deals.length ? <div className="space-y-3">{deals.slice(0, 3).map((deal) => <a key={deal.name} href={deal.url ?? undefined} className="flex items-center justify-between rounded-xl bg-background/40 p-3"><span className="font-bold">{deal.name}</span><Chip tone="primary">{deal.current?.price ? `${deal.current.price.amount} ${deal.current.price.currency}` : "View deal"}</Chip></a>)}</div> : null}</section>
    </div><aside className="space-y-10 lg:col-span-4"><section><SectionHeader title="Steam" /><div className="rounded-2xl border border-border bg-surface p-6"><h3 className="mb-2 font-bold">{steamConnected ? "Steam connected" : "Connect Steam"}</h3><p className="mb-4 text-sm text-muted-foreground">{steamConnected ? "Your Steam library is ready to sync." : message(data?.steam ?? {}, "Connect Steam to sync your library and see friends.")}</p><Link to="/steam" className="inline-flex rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-bold">{steamConnected ? "Open Steam" : "Connect Steam"}</Link></div></section></aside></div>
  </AppShell>;
}
