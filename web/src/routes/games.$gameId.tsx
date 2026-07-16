import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bell, Heart, Plus, Share2, Sparkles, Star, Trophy, Users } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { getCatalogGame, getGamePriceHistory } from "@/lib/api";
import { lovableQueryKeys } from "@/lib/lovable-data";

export const Route = createFileRoute("/games/$gameId")({
  head: () => ({ meta: [{ title: "Game — GameFinder" }, { name: "description", content: "Game details from the public catalog." }] }),
  component: GameDetail,
});

function money(amount: number | undefined, currency: string | undefined) {
  return amount === undefined || !currency ? "Data unavailable" : new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

function GameDetail() { return <GameDetailPage gameId={Route.useParams().gameId} />; }

export function GameDetailPage({ gameId }: { gameId: string }) {
  const gameQuery = useQuery({ queryKey: lovableQueryKeys.catalogGame(gameId), queryFn: () => getCatalogGame(gameId) });
  const priceQuery = useQuery({ queryKey: lovableQueryKeys.gamePriceHistory(gameId, "US"), queryFn: () => getGamePriceHistory(gameId, "US") });
  const game = gameQuery.data;
  const price = priceQuery.data;
  const title = game?.name ?? "Data unavailable";
  const image = game?.background_image ?? "Data unavailable";
  const genres = game?.genres ?? [];
  const platforms = game?.platforms ?? [];

  return <AppShell>
    <Link to="/search" className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"><ArrowLeft className="size-3.5" /> Back to search</Link>
    {gameQuery.isError && <div className="mb-6 rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">Failed to load game details.</div>}
    <section className="relative mb-10 overflow-hidden rounded-3xl border border-border"><GameCover from={image} to={image} title={title} className="h-72 w-full sm:h-96" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent p-6 sm:p-8"><div className="mb-3 flex flex-wrap items-center gap-2">{genres.map((genre) => <Chip key={genre} tone="outline">{genre}</Chip>)}</div><h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{platforms.length ? platforms.join(" · ") : "Data unavailable"} · {game?.released ?? "Data unavailable"}</p></div></section>
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12"><div className="space-y-10 lg:col-span-8">
      <section><SectionHeader title="About" /><p className="text-sm leading-relaxed text-muted-foreground">{game?.description_raw ?? "Data unavailable"}</p></section>
      <section><SectionHeader title="Friends who own it" /><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">Connect Steam</p><p className="truncate text-xs text-muted-foreground">Connect Steam to view friends.</p></div><button className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-bold hover:bg-white/5">Invite</button></div></div></section>
      <section><SectionHeader title="Price history" hint="Data returned by the price service." /><div className="rounded-2xl border border-border bg-surface p-6"><div className="mb-4 flex items-end justify-between"><div><p className="font-mono text-xs text-muted-foreground line-through">{money(price?.current?.regular?.amount, price?.current?.regular?.currency)}</p><p className="font-mono text-3xl font-black text-primary">{money(price?.current?.price?.amount, price?.current?.price?.currency)}</p></div><div className="text-right font-mono text-[10px] uppercase tracking-widest text-primary">{price?.history_low_all ? `All-time low: ${money(price.history_low_all.amount, price.history_low_all.currency)}` : "Data unavailable"}</div></div><div className="h-[60px] text-sm text-muted-foreground">{priceQuery.isError ? "Data unavailable" : "Data unavailable"}</div><div className="mt-3 flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground"><span>Data unavailable</span></div></div></section>
      <section><SectionHeader title="You might also like" /><div className="grid grid-cols-2 gap-4 md:grid-cols-4"><div className="group overflow-hidden rounded-xl border border-border bg-surface"><div className="aspect-[3/4] w-full" /><div className="p-3"><div className="mb-1 flex items-center gap-1.5"><Sparkles className="size-3 text-primary" /><span className="font-mono text-[9px] uppercase tracking-widest text-primary">Data unavailable</span></div><p className="truncate text-sm font-bold">Data unavailable</p><p className="mt-1 font-mono text-xs">Data unavailable</p></div></div></div></section>
    </div><div className="space-y-6 lg:col-span-4">
      <div className="rounded-2xl border border-border bg-surface p-6"><p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Price</p><div className="flex items-end justify-between"><p className="font-mono text-3xl font-black text-primary">{money(price?.current?.price?.amount, price?.current?.price?.currency)}</p>{price?.current?.cut !== null && price?.current?.cut !== undefined && <Chip tone="primary">-{price.current.cut}%</Chip>}</div>{price?.current?.regular && <p className="mt-1 font-mono text-xs text-muted-foreground line-through">was {money(price.current.regular.amount, price.current.regular.currency)}</p>}<button className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90">Data unavailable</button><button className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-bold hover:bg-white/5"><Users className="size-4" /> Connect Steam</button><div className="mt-4 grid grid-cols-3 gap-2"><button className="flex items-center justify-center gap-1 rounded-md border border-border bg-secondary py-2 text-xs font-bold hover:bg-white/5"><Heart className="size-3.5" /> Wish</button><button className="flex items-center justify-center gap-1 rounded-md border border-border bg-secondary py-2 text-xs font-bold hover:bg-white/5"><Bell className="size-3.5" /> Alert</button><button className="flex items-center justify-center gap-1 rounded-md border border-border bg-secondary py-2 text-xs font-bold hover:bg-white/5"><Share2 className="size-3.5" /> Share</button></div></div>
      <div className="rounded-2xl border border-border bg-surface p-6"><SectionHeader title="At a glance" /><dl className="space-y-3 text-sm">{[{ l: "Platforms", v: platforms.join(", ") || "Data unavailable", icon: Plus }, { l: "Genres", v: genres.join(", ") || "Data unavailable", icon: Sparkles }, { l: "Rating", v: game?.rating === null || game?.rating === undefined ? "Data unavailable" : String(game.rating), icon: Star }, { l: "Playtime avg.", v: "Data unavailable", icon: Trophy }].map((row) => <div key={row.l} className="flex items-center justify-between gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0"><span className="text-muted-foreground">{row.l}</span><span className="text-right font-bold">{row.v}</span></div>)}</dl></div>
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-6"><div className="mb-2 flex items-center gap-2"><Sparkles className="size-4 text-primary" /><span className="font-mono text-[10px] uppercase tracking-widest text-primary">Why for your squad</span></div><p className="text-sm text-muted-foreground">Connect Steam to see personalized game information.</p></div>
    </div></div>
  </AppShell>;
}
