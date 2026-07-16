import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Avatar, GameCover } from "@/components/GameCover";
import { Chip, PresenceDot, SectionHeader } from "@/components/ui-bits";
import { getCatalogGame, getGamePriceHistory } from "@/lib/api";
import { lovableQueryKeys } from "@/lib/lovable-data";
import {
  ArrowLeft,
  Bell,
  Heart,
  Plus,
  Share2,
  Sparkles,
  Star,
  Trophy,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/games/$gameId")({
  head: () => ({ meta: [{ title: "Game — GameFinder" }, { name: "description", content: "Game details from the public catalog." }] }),
  component: GameDetail,
});

const priceHistory: Array<{ price: number; date: string }> = [];
function Sparkline() {
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

function GameDetail() { return <GameDetailPage gameId={Route.useParams().gameId} />; }
export function GameDetailPage({ gameId }: { gameId: string }) {
  const gameQuery = useQuery({ queryKey: lovableQueryKeys.catalogGame(gameId), queryFn: () => getCatalogGame(gameId) });
  const priceQuery = useQuery({ queryKey: lovableQueryKeys.gamePriceHistory(gameId, "US"), queryFn: () => getGamePriceHistory(gameId, "US") });
  const game = gameQuery.data ?? { id: 0, name: "Data unavailable", released: null, background_image: null, description_raw: null, rating: null, genres: [], platforms: [] };
  const owners: Array<{ id: string; avatarFrom: string; avatarTo: string; name: string; online: boolean; activity: string }> = [];
  const similar: Array<{ id: string; coverFrom: string; coverTo: string; title: string; price: string }> = [];

  return (
    <AppShell>
      <Link
        to="/search"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to search
      </Link>

      {/* Hero */}
      <section className="relative mb-10 overflow-hidden rounded-3xl border border-border">
        <GameCover
              from={game.background_image ?? "Data unavailable"}
              to={game.background_image ?? "Data unavailable"}
              title={game.name}
          className="h-72 w-full sm:h-96"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent p-6 sm:p-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {game.genres.map((g: string) => (
              <Chip key={g} tone="outline">
                {g}
              </Chip>
            ))}

          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            {game.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {game.platforms.join(" · ") || "Data unavailable"} · {game.released ?? "Data unavailable"}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        {/* Main */}
        <div className="space-y-10 lg:col-span-8">
          <section>
            <SectionHeader title="About" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              {game.description_raw ?? "Data unavailable"}
            </p>
          </section>

          <section>
            <SectionHeader title="Friends who own it" />
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
                  <button disabled title="Connect Steam to invite friends" className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-bold hover:bg-white/5">
                    Connect Steam
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionHeader
              title="Price history"
              hint="6-month trend across storefronts."
            />
            <div className="rounded-2xl border border-border bg-surface p-6">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  {priceQuery.data?.current?.regular && (
                    <p className="font-mono text-xs text-muted-foreground line-through">
                      Data unavailable
                    </p>
                  )}
                  <p className="font-mono text-3xl font-black text-primary">
                    Data unavailable
                  </p>
                </div>
                {priceQuery.data?.current?.cut !== null && priceQuery.data?.current?.cut !== undefined && (
                  <div className="text-right font-mono text-[10px] uppercase tracking-widest text-primary">
                    Data unavailable
                  </div>
                )}
              </div>
              <Sparkline />
              <div className="mt-3 flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {priceHistory.map((p) => (
                  <span key={p.date}>{p.date}</span>
                ))}
              </div>
            </div>
          </section>

          <section>
            <SectionHeader title="You might also like" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {similar.map((g) => (
                <Link
                  key={g.id}
                  to="/games/$gameId"
                  params={{ gameId: g.id }}
                  className="group overflow-hidden rounded-xl border border-border bg-surface transition hover:border-white/20"
                >
                  <GameCover
                    from={g.coverFrom}
                    to={g.coverTo}
                    title={g.title}
                    className="aspect-[3/4] w-full"
                  />
                  <div className="p-3">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Sparkles className="size-3 text-primary" />
                      <span className="font-mono text-[9px] uppercase tracking-widest text-primary">
                        Similar
                      </span>
                    </div>
                    <p className="truncate text-sm font-bold group-hover:text-primary">
                      {g.title}
                    </p>
                    <p className="mt-1 font-mono text-xs">${g.price}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Price
            </p>
            <div className="flex items-end justify-between">
              <p className="font-mono text-3xl font-black text-primary">
                Data unavailable
              </p>
              {priceQuery.data?.current?.cut !== null && priceQuery.data?.current?.cut !== undefined && <Chip tone="primary">-{priceQuery.data.current.cut}%</Chip>}
            </div>
            {priceQuery.data?.current?.regular && (
              <p className="mt-1 font-mono text-xs text-muted-foreground line-through">
                Data unavailable
              </p>
            )}
            <button disabled title="Purchase links are unavailable" className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90">
              Data unavailable
            </button>
            <button disabled title="Connect Steam to invite friends" className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-bold hover:bg-white/5">
              <Users className="size-4" /> Connect Steam
            </button>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button disabled title="Wishlist actions are unavailable" className="flex items-center justify-center gap-1 rounded-md border border-border bg-secondary py-2 text-xs font-bold hover:bg-white/5">
                <Heart className="size-3.5" /> Unavailable
              </button>
              <button disabled title="Alert actions are unavailable" className="flex items-center justify-center gap-1 rounded-md border border-border bg-secondary py-2 text-xs font-bold hover:bg-white/5">
                <Bell className="size-3.5" /> Unavailable
              </button>
              <button disabled title="Sharing is unavailable" className="flex items-center justify-center gap-1 rounded-md border border-border bg-secondary py-2 text-xs font-bold hover:bg-white/5">
                <Share2 className="size-3.5" /> Unavailable
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6">
            <SectionHeader title="At a glance" />
            <dl className="space-y-3 text-sm">
              {[
                { l: "Platforms", v: game.platforms.join(", "), icon: Plus },
                {
                  l: "Genres",
                  v: game.genres.join(", "),
                  icon: Sparkles,
                },
                {
                  l: "Critic score",
                  v: game.rating === null ? "Data unavailable" : String(game.rating),
                  icon: Star,
                },
                {
                  l: "Playtime avg.",
                  v: "Data unavailable",
                  icon: Trophy,
                },
              ].map((r) => (
                <div key={r.l} className="flex items-center justify-between gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0">
                  <span className="text-muted-foreground">{r.l}</span>
                  <span className="text-right font-bold">{r.v}</span>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-6">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
                Why for your squad
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Connect Steam to see personalized game information.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
