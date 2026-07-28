import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar, GameCover } from "@/components/GameCover";
import { Chip, Panel, PresenceDot, Stat } from "@/components/ui-bits";
import { deals, friends, games, regions } from "@/lib/mockData";
import { Search, ArrowRight, Tag, ExternalLink, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Playfinder — Find your next game" },
      {
        name: "description",
        content:
          "Search games across stores, track live price drops by region, and see what your friends are playing — no account required.",
      },
      { property: "og:title", content: "Playfinder — Find your next game" },
      {
        property: "og:description",
        content:
          "Search games, discover new favourites, and catch live price drops before you sign in.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const [region, setRegion] = useState<string>("US");
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return games.filter((g) => g.title.toLowerCase().includes(q)).slice(0, 4);
  }, [query]);

  const online = friends.filter((f) => f.online);
  const best = deals[2];
  const rest = deals.filter((d) => d.id !== best.id);

  return (
    <AppShell>
      {/* Hero search */}
      <section className="animate-reveal ember-glow grain sheen relative mb-8 overflow-hidden rounded-3xl border border-border bg-surface p-6 sm:p-10">
        <p className="label-mono relative mb-3 text-primary">Playfinder</p>
        <h1 className="relative max-w-2xl text-[2.5rem] font-bold leading-[0.95] tracking-[-0.035em] text-balance sm:text-6xl">
          Find your next game
        </h1>
        <p className="relative mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
          Search games, discover new favourites, and catch live price drops — before you even sign
          in.
        </p>

        <form
          className="relative mt-7 flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="flex flex-1 items-center gap-3 rounded-2xl border border-border bg-background/70 px-5 py-4 backdrop-blur focus-within:border-primary/60">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search games by title"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Link
            to="/search"
            className="grid shrink-0 place-items-center rounded-2xl bg-primary px-7 py-4 text-sm font-bold text-primary-foreground shadow-[0_14px_40px_-16px_var(--primary)] transition hover:opacity-90"
          >
            Search games
          </Link>
        </form>

        {/* Live inline results (typeahead) */}
        {query.trim() !== "" && (
          <div className="animate-pop relative mt-4 overflow-hidden rounded-2xl border border-border bg-background/80 backdrop-blur">
            {results.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                No matches for “{query}”. Try a shorter title.
              </p>
            ) : (
              results.map((g) => (
                <Link
                  key={g.id}
                  to="/games/$gameId"
                  params={{ gameId: g.id }}
                  className="flex items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-2"
                >
                  <GameCover
                    from={g.coverFrom}
                    to={g.coverTo}
                    title={g.title}
                    compact
                    className="size-10 shrink-0 rounded-md"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{g.title}</span>
                  <span className="label-mono text-muted-foreground">${g.price}</span>
                </Link>
              ))
            )}
          </div>
        )}
      </section>

      {/* Price drops */}
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
            onChange={(e) => setRegion(e.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold outline-none focus:border-primary/60"
          >
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="stagger grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Featured deal */}
        <a
          href={best.storeUrl}
          target="_blank"
          rel="noreferrer"
          className="animate-reveal group lg:col-span-7"
        >
          <Panel interactive className="h-full">
            <GameCover
              from={best.coverFrom}
              to={best.coverTo}
              title={best.title}
              bare
              className="aspect-[16/9] w-full transition-transform duration-500 ease-[var(--ease-studio)] group-hover:scale-[1.03]"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent p-6 pt-16">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Chip tone="solid">-{best.discount}%</Chip>
                <Chip tone="primary">{best.store}</Chip>
                <Chip tone="outline">Lowest in 6 months</Chip>
              </div>
              <h3 className="text-3xl font-bold tracking-tight">{best.title}</h3>
              <p className="mt-2 flex items-center gap-3 font-mono text-sm">
                <span className="text-muted-foreground line-through">
                  {best.originalPrice} {best.currency}
                </span>
                <span className="text-lg font-bold text-primary">
                  {best.price} {best.currency}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  Open store <ExternalLink className="size-3" />
                </span>
              </p>
            </div>
          </Panel>
        </a>

        {/* Stats + friends teaser */}
        <div className="animate-reveal flex flex-col gap-5 lg:col-span-5">
          <Panel className="ember-glow grain p-5">
            <div className="relative grid grid-cols-3 gap-4">
              <Stat label="Deals" value={deals.length} />
              <Stat label="Region" value={region} />
              <Stat label="Updated" value="4m" />
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
            <div className="space-y-1">
              {online.slice(0, 3).map((f) => (
                <Link
                  key={f.id}
                  to="/friends"
                  className="flex items-center gap-3 rounded-xl border border-transparent p-2.5 transition-all duration-200 hover:translate-x-0.5 hover:border-border hover:bg-surface-2"
                >
                  <div className="relative shrink-0">
                    <Avatar
                      from={f.avatarFrom}
                      to={f.avatarTo}
                      name={f.name}
                      className="size-9 rounded-full"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5">
                      <PresenceDot online={f.online} />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{f.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{f.activity}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Panel>
        </div>

        {/* Deal grid */}
        {rest.map((d, i) => (
          <a
            key={d.id}
            href={d.storeUrl}
            target="_blank"
            rel="noreferrer"
            className="animate-reveal group lg:col-span-3"
            style={{ animationDelay: `${60 + i * 40}ms` }}
          >
            <Panel interactive className="h-full">
              <GameCover
                from={d.coverFrom}
                to={d.coverTo}
                title={d.title}
                bare
                className="aspect-[16/9] w-full transition-transform duration-500 ease-[var(--ease-studio)] group-hover:scale-[1.04]"
              />
              <span className="label-mono absolute right-3 top-3 rounded-md bg-primary px-1.5 py-1 text-primary-foreground">
                -{d.discount}%
              </span>
              <div className="p-4">
                <h4 className="truncate font-display text-sm font-bold group-hover:text-primary">
                  {d.title}
                </h4>
                <p className="label-mono mt-1 text-muted-foreground">{d.store}</p>
                <p className="mt-3 flex items-baseline gap-2 font-mono text-sm">
                  <span className="text-muted-foreground line-through">{d.originalPrice}</span>
                  <span className="font-bold text-primary">
                    {d.price} {d.currency}
                  </span>
                </p>
              </div>
            </Panel>
          </a>
        ))}

        {/* Account CTA */}
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
      </div>
    </AppShell>
  );
}
