import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { GameCard } from "@/components/GameCard";
import { EmptyState, SectionHeader } from "@/components/ui-bits";
import { games } from "@/lib/mockData";
import { Search, SlidersHorizontal } from "lucide-react";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — Playfinder" },
      {
        name: "description",
        content: "Search games by title, genre, platform and active deals across stores.",
      },
      { property: "og:title", content: "Search — Playfinder" },
      {
        property: "og:description",
        content: "Find games by title, genre, platform and price across storefronts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SearchPage,
});

const filters = ["All", "Co-op", "PC", "PS5", "On sale", "Roguelike", "RPG", "Multiplayer"];

function SearchPage() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("All");

  const results = games.filter((g) =>
    query.trim() ? g.title.toLowerCase().includes(query.trim().toLowerCase()) : true,
  );

  return (
    <AppShell>
      <SectionHeader title="Search" hint="Find a game by title, genre or platform" />

      <form
        className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 focus-within:border-primary/60"
        onSubmit={(e) => e.preventDefault()}
      >
        <Search className="size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Search by title, genre, mood…"
        />
        <button
          type="button"
          className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          <SlidersHorizontal className="size-3.5" /> Filters
        </button>
      </form>

      <div className="mb-8 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActive(f)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              f === active
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="label-mono text-muted-foreground">
          {query.trim() === ""
            ? "Start typing to search"
            : `${results.length} results`}
        </p>
        <div className="flex items-center gap-2">
          <select className="rounded-md border border-border bg-surface px-2 py-1 text-xs">
            <option>Relevance</option>
            <option>Price ↑</option>
            <option>Discount</option>
            <option>Rating</option>
          </select>
        </div>
      </div>

      {query.trim() !== "" && results.length === 0 && (
        <EmptyState
          icon={<Search className="size-5" />}
          title="No games match your search"
          description="Try a different title or clear some filters."
        />
      )}

      {results.length > 0 && (
        <div className="stagger grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {results.map((g) => (
            <GameCard
              key={g.id}
              aspect="aspect-[3/4]"
              game={{
                gameId: g.id,
                title: g.title,
                coverUrl: g.coverUrl,
                coverFrom: g.coverFrom,
                coverTo: g.coverTo,
                genres: g.genres,
                platforms: g.platforms,
                price: g.price,
                originalPrice: g.originalPrice,
                discount: g.discount,
                currency: g.currency,
                store: g.store,
              }}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
