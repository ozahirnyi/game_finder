import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { GameCard } from "@/components/GameCard";
import { EmptyState, SectionHeader } from "@/components/ui-bits";
import {
  getRecommendations,
  searchGames,
  type CatalogFeature,
  type CatalogGenre,
  type CatalogPlatform,
} from "@/lib/api";
import { gameDetailTarget } from "@/lib/gameRoute";
import { Search, Sparkles } from "lucide-react";

export const Route = createFileRoute("/search")({ component: SearchPage });

const filters: Array<{
  label: string;
  type?: "platform" | "feature" | "genre" | "sale";
  value?: string;
}> = [
  { label: "All" },
  { label: "On sale", type: "sale" },
  { label: "Co-op", type: "feature", value: "co_op" },
  { label: "Solo", type: "feature", value: "single_player" },
  { label: "PC", type: "platform", value: "pc" },
  { label: "Consoles", type: "platform", value: "console" },
  { label: "Adventure", type: "genre", value: "adventure" },
  { label: "Roguelike", type: "genre", value: "roguelike" },
  { label: "RPG", type: "genre", value: "rpg" },
  { label: "Shooter", type: "genre", value: "shooter" },
  { label: "Strategy", type: "genre", value: "strategy" },
  { label: "Multiplayer", type: "feature", value: "multiplayer" },
];

function SearchPage() {
  const [query, setQuery] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("q") ?? "";
  });
  const [platforms, setPlatforms] = useState<CatalogPlatform[]>([]);
  const [features, setFeatures] = useState<CatalogFeature[]>([]);
  const [genres, setGenres] = useState<CatalogGenre[]>([]);
  const [onSale, setOnSale] = useState(false);
  const [mode, setMode] = useState<"catalog" | "ai">("catalog");
  const searchQuery = useQuery({
    queryKey: ["search", query, platforms, features, genres, onSale],
    queryFn: () => searchGames({ query: query.trim(), platforms, features, genres, onSale }),
    enabled: mode === "catalog",
  });
  const recommendationMutation = useMutation({ mutationFn: getRecommendations });
  const results = searchQuery.data?.results ?? [];

  function syncUrl(
    nextQuery: string,
    nextPlatforms = platforms,
    nextFeatures = features,
    nextGenres = genres,
    nextOnSale = onSale,
  ) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (nextQuery) url.searchParams.set("q", nextQuery);
    else url.searchParams.delete("q");
    url.searchParams.delete("platform");
    nextPlatforms.forEach((value) => url.searchParams.append("platform", value));
    url.searchParams.delete("feature");
    nextFeatures.forEach((value) => url.searchParams.append("feature", value));
    url.searchParams.delete("genre");
    nextGenres.forEach((value) => url.searchParams.append("genre", value));
    if (nextOnSale) url.searchParams.set("on_sale", "true");
    else url.searchParams.delete("on_sale");
    window.history.replaceState({}, "", url);
  }

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    syncUrl(nextQuery);
  }
  function toggleFilter(filter: (typeof filters)[number]) {
    if (!filter.type) {
      setPlatforms([]);
      setFeatures([]);
      setGenres([]);
      setOnSale(false);
      syncUrl(query, [], [], [], false);
      return;
    }
    if (filter.type === "sale") {
      const next = !onSale;
      setOnSale(next);
      syncUrl(query, platforms, features, genres, next);
      return;
    }
    if (filter.type === "platform") {
      const next = platforms.includes(filter.value as CatalogPlatform)
        ? platforms.filter((item) => item !== filter.value)
        : [...platforms, filter.value as CatalogPlatform];
      setPlatforms(next);
      syncUrl(query, next);
    }
    if (filter.type === "feature") {
      const next = features.includes(filter.value as CatalogFeature)
        ? features.filter((item) => item !== filter.value)
        : [...features, filter.value as CatalogFeature];
      setFeatures(next);
      syncUrl(query, platforms, next);
    }
    if (filter.type === "genre") {
      const next = genres.includes(filter.value as CatalogGenre)
        ? genres.filter((item) => item !== filter.value)
        : [...genres, filter.value as CatalogGenre];
      setGenres(next);
      syncUrl(query, platforms, features, next);
    }
  }

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
          onChange={(event) => updateQuery(event.target.value)}
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
            {filters.map((filter) => {
              const active =
                filter.type === "platform"
                  ? platforms.includes(filter.value as CatalogPlatform)
                  : filter.type === "feature"
                    ? features.includes(filter.value as CatalogFeature)
                    : filter.type === "genre"
                      ? genres.includes(filter.value as CatalogGenre)
                      : filter.type === "sale"
                        ? onSale
                        : !platforms.length && !features.length && !genres.length && !onSale;
              return (
                <button
                  key={filter.label}
                  onClick={() => toggleFilter(filter)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
          {searchQuery.isFetching && (
            <EmptyState
              icon={<Search className="size-5 animate-pulse" />}
              title="Searching games…"
              description="Checking the catalog and Steam."
            />
          )}
          {!searchQuery.isFetching && results.length === 0 && (
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
          {recommendationMutation.data?.recommendations.length === 0 && (
            <EmptyState
              icon={<Sparkles className="size-5" />}
              title="No AI matches found"
              description="Try describing a different mood, genre, or platform."
            />
          )}
          {recommendationMutation.data?.recommendations.map((item) => (
            <article key={item.title} className="rounded-xl border border-border bg-surface p-4">
              <h3 className="font-bold">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.reason}</p>
              <p className="mt-3 text-xs text-primary">{item.tags.join(" · ")}</p>
              {item.igdb_id != null ? (
                <a
                  className="mt-3 inline-block text-sm font-bold text-primary"
                  href={`/games/${item.igdb_id}`}
                >
                  View {item.title} details
                </a>
              ) : (
                <a
                  className="mt-3 inline-block text-sm font-bold text-primary"
                  href={`/search?q=${encodeURIComponent(item.title)}`}
                >
                  Search for {item.title}
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
