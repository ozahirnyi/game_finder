import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { GameCard } from "@/components/GameCard";
import { EmptyState, SectionHeader } from "@/components/ui-bits";
import { getRecommendations, searchGames } from "@/lib/api";
import { gameDetailTarget } from "@/lib/gameRoute";
import { Search, Sparkles } from "lucide-react";

export const Route = createFileRoute("/search")({ component: SearchPage });

const filters = ["All", "Co-op", "PC", "PS5", "On sale", "Roguelike", "RPG", "Multiplayer"];

function SearchPage() {
  const [query, setQuery] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("q") ?? "";
  });
  const [active, setActive] = useState("All");
  const [mode, setMode] = useState<"catalog" | "ai">("catalog");
  const searchQuery = useQuery({
    queryKey: ["search", query],
    queryFn: () => searchGames(query),
    enabled: mode === "catalog" && query.trim().length >= 2,
  });
  const recommendationMutation = useMutation({ mutationFn: getRecommendations });
  const results = searchQuery.data?.results ?? [];

  return (
    <AppShell>
      <SectionHeader title="Search" hint="Find games by title or ask AI for recommendations" />
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("catalog")}
          className={`rounded-md px-3 py-1.5 text-xs font-bold ${mode === "catalog" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
        >
          Search games
        </button>
        <button
          type="button"
          onClick={() => setMode("ai")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold ${mode === "ai" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
        >
          <Sparkles className="size-3.5" /> AI search
        </button>
      </div>
      <form
        aria-label="search form"
        className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 focus-within:border-primary/60"
        onSubmit={(event) => {
          event.preventDefault();
          if (mode === "ai" && query.trim()) recommendationMutation.mutate(query.trim());
        }}
      >
        <Search className="size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder={
            mode === "ai" ? "Describe what you want to play…" : "Search by title, genre, mood…"
          }
        />
        <button
          type="submit"
          className="rounded-md border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          {mode === "ai" ? "Ask AI" : "Search"}
        </button>
      </form>
      {mode === "catalog" && (
        <>
          <div className="mb-8 flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActive(filter)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}
              >
                {filter}
              </button>
            ))}
          </div>
          {query.trim() !== "" && searchQuery.isFetching && (
            <EmptyState
              icon={<Search className="size-5 animate-pulse" />}
              title="Searching games…"
              description="Checking the catalog and Steam."
            />
          )}
          {query.trim() !== "" && !searchQuery.isFetching && results.length === 0 && (
            <EmptyState
              icon={<Search className="size-5" />}
              title="No games match your search"
              description="Try a different title or clear some filters."
            />
          )}
          {results.length > 0 && (
            <div className="stagger grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
              {results.map((game) => {
                const target = gameDetailTarget(game.id, game.steam_appid);
                return (
                  <GameCard
                    key={game.id ?? game.steam_appid}
                    aspect="aspect-[3/4]"
                    game={{
                      gameId: target?.gameId,
                      source: target?.source,
                      title: game.name,
                      coverFrom: "#312e81",
                      coverTo: "#111827",
                      coverUrl: game.background_image ?? undefined,
                      genres: game.genres,
                      platforms: game.platforms,
                    }}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
      {mode === "ai" && (
        <div className="space-y-3">
          {recommendationMutation.isPending && (
            <p className="text-sm text-muted-foreground">Finding games for you…</p>
          )}
          {recommendationMutation.isError && (
            <EmptyState
              icon={<Sparkles className="size-5" />}
              title="AI search is unavailable"
              description="Please try again in a moment."
            />
          )}
          {recommendationMutation.data?.recommendations.map((item) => (
            <article key={item.title} className="rounded-xl border border-border bg-surface p-4">
              <h3 className="font-bold">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.reason}</p>
              <p className="mt-3 text-xs text-primary">{item.tags.join(" · ")}</p>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
