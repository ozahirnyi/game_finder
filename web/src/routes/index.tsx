import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { GameCover, Avatar } from "@/components/GameCover";
import { Chip, PresenceDot, SectionHeader } from "@/components/ui-bits";
import {
  activity,
  aiRecommendations,
  friends,
  games,
  currentUser,
} from "@/lib/mockData";
import { Search, Sparkles, ArrowRight, Plus } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — GameFinder" },
      {
        name: "description",
        content:
          "Tonight with friends: shared games, LFG opportunities, AI picks, and wishlist deals in one dark, focused view.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const featured = games.find((g) => g.id === "helldivers2")!;
  const shared = games.filter((g) => g.status === "Playing with Friends");
  const online = friends.filter((f) => f.online);
  const wishlistDeals = games.filter((g) => g.discount);
  const recs = aiRecommendations.map((r) => ({
    ...r,
    game: games.find((g) => g.id === r.gameId)!,
  }));

  return (
    <AppShell>
      {/* Hero */}
      <section className="animate-reveal mb-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.25em] text-primary">
              Tonight · {new Date().toLocaleDateString("en", { weekday: "long" })}
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-balance">
              Play with friends tonight
            </h1>
            <p className="mt-2 text-muted-foreground">
              {online.length} friends online · {shared.length} games your squad already owns.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-3">
              {online.slice(0, 4).map((f) => (
                <Avatar
                  key={f.id}
                  from={f.avatarFrom}
                  to={f.avatarTo}
                  name={f.name}
                  className="size-11 rounded-full ring-4 ring-background"
                />
              ))}
            </div>
            <Link
              to="/friends"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90"
            >
              Host a session
            </Link>
          </div>
        </div>

        {/* Quick search */}
        <Link
          to="/search"
          className="mb-8 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-white/20"
        >
          <Search className="size-4" />
          Search 42,000 games by title, genre, mood…
          <kbd className="ml-auto rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>
        </Link>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Link
            to="/games/$gameId"
            params={{ gameId: featured.id }}
            className="group relative overflow-hidden rounded-2xl border border-border bg-surface ring-1 ring-white/5 transition hover:ring-white/20"
          >
            <GameCover
              from={featured.coverFrom}
              to={featured.coverTo}
              title={featured.title}
              className="aspect-video w-full"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/80 to-transparent p-6">
              <div className="mb-2 flex items-center gap-2">
                <Chip tone="primary">Shared · 12 friends</Chip>
                <Chip tone="outline">Co-op · 4p</Chip>
              </div>
              <h3 className="text-2xl font-bold">{featured.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Marcus and Alex are looking for 2 more Divers right now.
              </p>
            </div>
          </Link>


          <div className="flex flex-col gap-4">
            {shared
              .filter((g) => g.id !== "helldivers2")
              .slice(0, 2)
              .map((g) => (
                <Link
                  key={g.id}
                  to="/games/$gameId"
                  params={{ gameId: g.id }}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 transition hover:border-white/20"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <GameCover
                      from={g.coverFrom}
                      to={g.coverTo}
                      title={g.title}
                      compact
                      className="size-20 shrink-0 rounded-lg"
                    />
                    <div className="min-w-0">
                      <h4 className="truncate font-bold">{g.title}</h4>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {g.id === "bg3"
                          ? "Marcus is in Act II"
                          : "4/4 slots available in party"}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5">
                        {g.genres.slice(0, 2).map((x) => (
                          <Chip key={x}>{x}</Chip>
                        ))}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-bold">
                    Join
                  </span>
                </Link>
              ))}

          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        {/* Left column */}
        <div className="space-y-12 lg:col-span-8">
          {/* AI recs */}
          <section className="animate-reveal" style={{ animationDelay: "100ms" }}>
            <SectionHeader
              title="AI picks for your group"
              hint="Cross-referenced against everyone's library and mood."
              action={
                <Link
                  to="/search"
                  className="flex items-center gap-1 text-sm font-semibold text-primary"
                >
                  Explore <ArrowRight className="size-3.5" />
                </Link>
              }
            />
            <div className="grid grid-cols-2 gap-5 lg:grid-cols-3">
              {recs.map((r) => (
                <Link
                  key={r.gameId}
                  to="/games/$gameId"
                  params={{ gameId: r.gameId }}
                  className="group cursor-pointer overflow-hidden rounded-xl border border-border bg-surface transition hover:border-white/20"
                >
                  <GameCover
                    from={r.game.coverFrom}
                    to={r.game.coverTo}
                    title={r.game.title}
                    className="aspect-[4/5] w-full"
                  />
                  <div className="p-4">
                    <div className="mb-2 flex items-center gap-1.5">
                      <Sparkles className="size-3 text-primary" />
                      <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
                        AI pick
                      </span>
                    </div>
                    <h5 className="text-sm font-bold group-hover:text-primary">
                      {r.game.title}
                    </h5>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {r.reason}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-mono text-sm">${r.game.price}</span>
                      {r.game.discount && (
                        <Chip tone="primary">-{r.game.discount}%</Chip>
                      )}
                    </div>
                  </div>
                </Link>
              ))}

            </div>
          </section>

          {/* Wishlist deals */}
          <section className="animate-reveal" style={{ animationDelay: "150ms" }}>
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-6">
              <div className="mb-6 flex items-center gap-3">
                <span className="size-2 animate-pulse-soft rounded-full bg-primary" />
                <h2 className="text-lg font-bold">Wishlist drops</h2>
                <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Price history synced
                </span>
              </div>
              <div className="space-y-3">
                {wishlistDeals.slice(0, 3).map((g) => (
                  <Link
                    key={g.id}
                    to="/games/$gameId"
                    params={{ gameId: g.id }}
                    className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-transparent bg-background/40 p-3 transition hover:border-border hover:bg-background/80"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <GameCover
                        from={g.coverFrom}
                        to={g.coverTo}
                        title={g.title}
                        compact
                        className="size-12 shrink-0 rounded-md"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{g.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Lowest price in 6 months · 2 friends own it
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-mono text-[10px] text-muted-foreground line-through">
                          ${g.originalPrice}
                        </p>
                        <p className="font-mono text-sm font-bold text-primary">
                          ${g.price}
                        </p>
                      </div>
                      <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border">
                        <ArrowRight className="size-3.5" />
                      </span>
                    </div>
                  </Link>
                ))}

              </div>
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-10 lg:col-span-4">
          <section className="animate-reveal" style={{ animationDelay: "200ms" }}>
            <SectionHeader title="Online now" />
            <div className="space-y-2">
              {online.map((f) => (
                <Link
                  key={f.id}
                  to="/friends"
                  className="flex items-center gap-3 rounded-xl border border-transparent p-3 transition hover:border-border hover:bg-surface"
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
                      {f.activity}
                    </p>
                  </div>
                  {f.lft ? (
                    <Chip tone="primary">LFG</Chip>
                  ) : (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {f.compatibility}%
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>

          <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6">
            <div className="absolute -right-8 -bottom-8 size-32 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-primary">
                Steam · Connected
              </p>
              <h3 className="mb-2 font-bold">
                {currentUser.stats.library} games imported
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                We refresh your library every 15 minutes to spot new shared titles.
              </p>
              <Link
                to="/steam"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-bold hover:bg-white/5"
              >
                Manage sync <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </section>

          <section className="animate-reveal" style={{ animationDelay: "250ms" }}>
            <SectionHeader title="Activity" />
            <div className="space-y-4 font-mono text-[11px] leading-relaxed">
              {activity.map((a) => {
                const f = friends.find((x) => x.id === a.who)!;
                return (
                  <div key={a.id} className="flex gap-3">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary/60" />
                    <p className="text-muted-foreground">
                      <span className="text-primary">{f.name}</span>{" "}
                      {a.verb}{" "}
                      <span className="text-foreground">{a.target}</span>{" "}
                      {a.tag}.{" "}
                      <span className="text-muted-foreground/60">{a.time}</span>
                    </p>
                  </div>
                );
              })}
            </div>
            <button className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground">
              <Plus className="size-3" /> Post an update
            </button>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
