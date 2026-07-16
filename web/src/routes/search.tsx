import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { games } from "@/lib/mockData";
import { Search, SlidersHorizontal, Plus, Heart, Users } from "lucide-react";


export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — GameFinder" },
      { name: "description", content: "Search games by title, genre, platform, mood, and active deals." },
    ],
  }),
  component: SearchPage,
});

const filters = [
  { label: "All", active: true },
  { label: "Co-op" },
  { label: "PC" },
  { label: "PS5" },
  { label: "Under $30" },
  { label: "On sale" },
  { label: "Roguelike" },
  { label: "RPG" },
  { label: "Multiplayer" },
];

function SearchPage() {
  return (
    <AppShell>
      <SectionHeader
        title="Search"
        hint="42,184 games indexed across 8 storefronts."
      />

      <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <Search className="size-4 text-muted-foreground" />
        <input
          defaultValue="co-op roguelike"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Search by title, genre, mood…"
        />
        <button className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground">
          <SlidersHorizontal className="size-3.5" /> Filters
        </button>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.label}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              f.active
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {games.length} results · sorted by relevance
        </p>
        <select className="rounded-md border border-border bg-surface px-2 py-1 text-xs">
          <option>Relevance</option>
          <option>Price ↑</option>
          <option>Discount</option>
          <option>Rating</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
        {games.map((g) => (
          <article
            key={g.id}
            className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition hover:border-white/20"
          >
            <Link
              to="/games/$gameId"
              params={{ gameId: g.id }}
              className="relative block"
            >
              <GameCover
                from={g.coverFrom}
                to={g.coverTo}
                title={g.title}
                className="aspect-[3/4] w-full"
              />
              {g.discount && (
                <span className="absolute left-3 top-3 rounded bg-primary px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
                  -{g.discount}%
                </span>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-2 items-center gap-1.5 bg-gradient-to-t from-background/95 to-transparent p-3 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
                <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
                  <Plus className="size-4" />
                </span>
                <span className="grid size-8 place-items-center rounded-md border border-border bg-background/80 backdrop-blur">
                  <Heart className="size-4" />
                </span>
                <span className="grid size-8 place-items-center rounded-md border border-border bg-background/80 backdrop-blur">
                  <Users className="size-4" />
                </span>
              </div>
            </Link>
            <Link
              to="/games/$gameId"
              params={{ gameId: g.id }}
              className="flex flex-1 flex-col p-4"
            >
              <h5 className="font-bold leading-tight group-hover:text-primary">
                {g.title}
              </h5>
              <p className="mt-1 text-xs text-muted-foreground">
                {g.genres.join(" · ")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {g.platforms.map((p) => (
                  <Chip key={p}>{p}</Chip>
                ))}
              </div>
              <div className="mt-auto flex items-end justify-between pt-4">
                <div>
                  {g.rating > 0 && (
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {g.rating} · Score
                    </p>
                  )}
                </div>
                <div className="text-right">
                  {g.originalPrice && (
                    <p className="font-mono text-[10px] text-muted-foreground line-through">
                      ${g.originalPrice}
                    </p>
                  )}
                  <p className="font-mono text-sm font-bold">${g.price}</p>
                </div>
              </div>
            </Link>
          </article>
        ))}

      </div>
    </AppShell>
  );
}
