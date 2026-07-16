import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Avatar, GameCover } from "@/components/GameCover";
import { Chip, PresenceDot, SectionHeader } from "@/components/ui-bits";
import { friends, games, priceHistory, type Game } from "@/lib/mockData";
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
  loader: ({ params }) => {
    const game = games.find((g) => g.id === params.gameId);
    if (!game) throw notFound();
    return { game };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.game.title} — GameFinder` },
          {
            name: "description",
            content: `${loaderData.game.title} · ${loaderData.game.genres.join(", ")} · ${loaderData.game.platforms.join(", ")}. Shared with your friends on GameFinder.`,
          },
        ]
      : [{ title: "Game not found — GameFinder" }, { name: "robots", content: "noindex" }],
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

function GameDetail() {
  const { game } = Route.useLoaderData();

  const owners = friends.slice(0, 4);
  const similar = games.filter((g: Game) => g.id !== game.id && g.genres.some((x) => game.genres.includes(x))).slice(0, 4);

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
          from={game.coverFrom}
          to={game.coverTo}
          title={game.title}
          className="h-72 w-full sm:h-96"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent p-6 sm:p-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {game.coop && <Chip tone="primary">Co-op · 4p</Chip>}
            {game.discount && <Chip tone="primary">-{game.discount}%</Chip>}
            {game.status === "Playing with Friends" && (
              <Chip tone="primary">Squad active</Chip>
            )}
            {game.genres.map((g: string) => (
              <Chip key={g} tone="outline">
                {g}
              </Chip>
            ))}

          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            {game.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {game.platforms.join(" · ")} · {owners.length} friends own it ·{" "}
            {game.rating > 0 ? `${game.rating} critic score` : "Unreleased"}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        {/* Main */}
        <div className="space-y-10 lg:col-span-8">
          <section>
            <SectionHeader title="About" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              {game.title} is a {game.genres.join(" / ").toLowerCase()} experience built
              for {game.platforms.join(" and ")}. GameFinder ranks it against your library
              and your circle's shared titles to surface the best moments to play together
              tonight. Cross-referenced with 12 professional reviews and 4,821 friends'
              playtime.
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
                  <button className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-bold hover:bg-white/5">
                    Invite
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
                  {game.originalPrice && (
                    <p className="font-mono text-xs text-muted-foreground line-through">
                      ${game.originalPrice}
                    </p>
                  )}
                  <p className="font-mono text-3xl font-black text-primary">
                    ${game.price}
                  </p>
                </div>
                {game.discount && (
                  <div className="text-right font-mono text-[10px] uppercase tracking-widest text-primary">
                    Lowest in 6 months
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
              Buy · Best price
            </p>
            <div className="flex items-end justify-between">
              <p className="font-mono text-3xl font-black text-primary">
                ${game.price}
              </p>
              {game.discount && <Chip tone="primary">-{game.discount}%</Chip>}
            </div>
            {game.originalPrice && (
              <p className="mt-1 font-mono text-xs text-muted-foreground line-through">
                was ${game.originalPrice}
              </p>
            )}
            <button className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90">
              Buy on Steam
            </button>
            <button className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-bold hover:bg-white/5">
              <Users className="size-4" /> Invite friends to buy together
            </button>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button className="flex items-center justify-center gap-1 rounded-md border border-border bg-secondary py-2 text-xs font-bold hover:bg-white/5">
                <Heart className="size-3.5" /> Wish
              </button>
              <button className="flex items-center justify-center gap-1 rounded-md border border-border bg-secondary py-2 text-xs font-bold hover:bg-white/5">
                <Bell className="size-3.5" /> Alert
              </button>
              <button className="flex items-center justify-center gap-1 rounded-md border border-border bg-secondary py-2 text-xs font-bold hover:bg-white/5">
                <Share2 className="size-3.5" /> Share
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
                  v: game.rating > 0 ? `${game.rating} / 100` : "TBD",
                  icon: Star,
                },
                {
                  l: "Playtime avg.",
                  v: `${game.playtime ?? 32}h`,
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
              Marcus, Alex, and Sasha all own {game.title}. Their combined playtime is
              234h — a great candidate for tonight's session.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
