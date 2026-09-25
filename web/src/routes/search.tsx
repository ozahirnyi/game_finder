import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { GameCard } from "@/components/GameCard";
import { EmptyState, SectionHeader } from "@/components/ui-bits";
import {
  ApiError,
  getAuthSnapshot,
  getProfile,
  getRecommendationQuota,
  getRecommendations,
  searchGames,
  subscribeToAuthChanges,
  type CatalogFeature,
  type CatalogGenre,
  type CatalogPlatform,
  type RecommendationResponse,
} from "@/lib/api";
import { gameDetailTarget } from "@/lib/gameRoute";
import { normalizePriceCountry } from "@/lib/priceRegion";
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

function useDebouncedValue(value: string, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}

function getAiSearchError(error: unknown) {
  const detail =
    error instanceof ApiError && typeof error.detail === "object" && error.detail !== null
      ? (error.detail as { code?: unknown })
      : null;
  const code = typeof detail?.code === "string" ? detail.code : "";

  if (error instanceof ApiError && error.status === 401) {
    return { title: "Sign in required", description: "Sign in again to use AI search." };
  }
  if (code === "ai_daily_quota_exhausted") {
    return {
      title: "Daily AI search limit reached",
      description: "Try again after the daily limit resets.",
    };
  }
  if (code === "ai_recommendation_cooldown") {
    return {
      title: "Please wait before searching again",
      description: "AI searches are limited to one request per minute.",
    };
  }
  if (error instanceof ApiError && error.status === 429) {
    return {
      title: "AI search limit reached",
      description: "Check your remaining AI searches and try again when they are available.",
    };
  }
  if (
    code === "ai_recommendations_unavailable" ||
    (error instanceof ApiError && error.status >= 500)
  ) {
    return {
      title: "AI provider is temporarily unavailable",
      description: "Please try again in a moment.",
    };
  }

  return { title: "AI search is unavailable", description: "Please try again in a moment." };
}

function SearchPage() {
  const [query, setQuery] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("q") ?? "";
  });
  const debouncedQuery = useDebouncedValue(query, 700);
  const [platforms, setPlatforms] = useState<CatalogPlatform[]>([]);
  const [features, setFeatures] = useState<CatalogFeature[]>([]);
  const [genres, setGenres] = useState<CatalogGenre[]>([]);
  const [onSale, setOnSale] = useState(false);
  const [mode, setMode] = useState<"catalog" | "ai">(() => {
    if (typeof window === "undefined") return "catalog";
    return new URLSearchParams(window.location.search).get("mode") === "ai" ? "ai" : "catalog";
  });
  const queryClient = useQueryClient();
  const signedIn = useSyncExternalStore(subscribeToAuthChanges, getAuthSnapshot, () => false);
  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    enabled: signedIn,
    staleTime: 60_000,
  });
  const regionReady = !signedIn || profileQuery.data !== undefined;
  const profileFailed = signedIn && profileQuery.isError && profileQuery.data === undefined;
  const region = normalizePriceCountry(profileQuery.data?.price_country_code);
  const searchQuery = useQuery({
    queryKey: ["search", debouncedQuery, platforms, features, genres, onSale, region],
    queryFn: () =>
      searchGames({
        query: debouncedQuery.trim(),
        platforms,
        features,
        genres,
        onSale,
        country: region,
      }),
    enabled: mode === "catalog" && regionReady,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[6] === region ? previousData : undefined,
  });
  const aiRecommendationQuery = useQuery<RecommendationResponse>({
    queryKey: ["ai-recommendations", query.trim()],
    enabled: false,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
  });
  const quotaQuery = useQuery({
    queryKey: ["recommendation-quota"],
    queryFn: getRecommendationQuota,
    enabled: mode === "ai",
    staleTime: 10_000,
  });
  const recommendationMutation = useMutation({
    mutationFn: getRecommendations,
    onSuccess: (data, prompt) => {
      queryClient.setQueryData(["ai-recommendations", prompt.trim()], data);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["recommendation-quota"] }),
  });
  const results = regionReady ? (searchQuery.data?.results ?? []) : [];
  const recommendations = aiRecommendationQuery.data;
  const aiSearchError = recommendationMutation.isError
    ? getAiSearchError(recommendationMutation.error)
    : null;
  const quota = quotaQuery.data;
  const cooldownActive = Boolean(
    quota?.cooldown_until && new Date(quota.cooldown_until).getTime() > Date.now(),
  );
  const quotaExhausted = quota?.remaining === 0;
  const aiSearchBlocked = cooldownActive || quotaExhausted;
  const quotaTime = quotaExhausted ? quota?.reset_at : quota?.cooldown_until;
  const quotaAvailability = quotaTime
    ? new Date(quotaTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  function syncUrl(
    nextQuery: string,
    nextPlatforms = platforms,
    nextFeatures = features,
    nextGenres = genres,
    nextOnSale = onSale,
    nextMode = mode,
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
    if (nextMode === "ai") url.searchParams.set("mode", "ai");
    else url.searchParams.delete("mode");
    window.history.replaceState({}, "", url);
  }

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    syncUrl(nextQuery);
  }
  function updateMode(nextMode: "catalog" | "ai") {
    setMode(nextMode);
    syncUrl(query, platforms, features, genres, onSale, nextMode);
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
          onClick={() => updateMode("catalog")}
          className={`rounded-md px-3 py-1.5 text-xs font-bold ${mode === "catalog" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
        >
          Search games
        </button>
        <button
          type="button"
          onClick={() => updateMode("ai")}
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
          if (mode === "ai" && query.trim() && !aiSearchBlocked) {
            recommendationMutation.mutate(query.trim());
          }
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
          disabled={mode === "ai" && (aiSearchBlocked || recommendationMutation.isPending)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          {mode === "ai" ? "Ask AI" : "Search"}
        </button>
      </form>
      {mode === "ai" && quota && (
        <p className="-mt-4 mb-6 text-xs text-muted-foreground" role="status">
          {quota.remaining} of {quota.limit} AI searches remaining today
          {quotaExhausted && quotaAvailability && ` · Resets at ${quotaAvailability}`}
          {cooldownActive &&
            !quotaExhausted &&
            quotaAvailability &&
            ` · Available again at ${quotaAvailability}`}
        </p>
      )}
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
          {profileFailed ? (
            <EmptyState
              icon={<Search className="size-5" />}
              title="Couldn't load your price region"
              description="Search is paused so prices won't be shown in the wrong currency."
              action={
                <button
                  type="button"
                  onClick={() => void profileQuery.refetch()}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold"
                >
                  Retry
                </button>
              }
            />
          ) : (
            <>
              {(!regionReady || searchQuery.isPending) && (
                <EmptyState
                  icon={<Search className="size-5 animate-pulse" />}
                  title="Searching games…"
                  description="Checking the catalog and Steam."
                />
              )}
              {regionReady && !searchQuery.isPending && results.length === 0 && (
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
                        game={{
                          gameId: target?.gameId,
                          source: target?.source,
                          title: game.name,
                          coverFrom: "#312e81",
                          coverTo: "#111827",
                          heroUrl: game.hero_image ?? undefined,
                          coverUrl: game.cover_image ?? game.background_image ?? undefined,
                          screenshotUrl: game.screenshot_image ?? undefined,
                          steamAppId: game.steam_appid ?? undefined,
                          steamPriceTitle: game.steam_price_title ?? undefined,
                          coverWidth: game.cover_width,
                          coverHeight: game.cover_height,
                          heroWidth: game.hero_width,
                          heroHeight: game.hero_height,
                          screenshotWidth: game.screenshot_width,
                          screenshotHeight: game.screenshot_height,
                          price: game.current?.price?.amount ?? null,
                          originalPrice: game.current?.regular?.amount ?? null,
                          discount: game.current?.cut,
                          currency: game.current?.price?.currency,
                          store: game.current?.shop ?? undefined,
                          isFree: game.is_free,
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
        </>
      )}
      {mode === "ai" && (
        <div className="space-y-3">
          {recommendationMutation.isPending && (
            <p className="text-sm text-muted-foreground">Finding games for you…</p>
          )}
          {aiSearchError && (
            <EmptyState
              icon={<Sparkles className="size-5" />}
              title={aiSearchError.title}
              description={aiSearchError.description}
            />
          )}
          {recommendations?.recommendations.length === 0 && (
            <EmptyState
              icon={<Sparkles className="size-5" />}
              title="No AI matches found"
              description="Try describing a different mood, genre, or platform."
            />
          )}
          {recommendations?.recommendations && (
            <div className="stagger grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-5">
              {recommendations.recommendations.flatMap((item) => {
                const game = item.game;
                if (!game || !Number.isInteger(game.id)) return [];
                return [
                  <GameCard
                    key={game.id}
                    showPrice={false}
                    game={{
                      gameId: String(game.id),
                      title: game.name,
                      description: item.reason,
                      returnTo: `/search?mode=ai&q=${encodeURIComponent(query.trim())}`,
                      coverFrom: "#312e81",
                      coverTo: "#111827",
                      heroUrl: game.hero_image ?? undefined,
                      coverUrl: game.cover_image ?? game.background_image ?? undefined,
                      screenshotUrl: game.screenshot_image ?? undefined,
                      steamAppId: game.steam_appid ?? undefined,
                      coverWidth: game.cover_width,
                      coverHeight: game.cover_height,
                      heroWidth: game.hero_width,
                      heroHeight: game.hero_height,
                      screenshotWidth: game.screenshot_width,
                      screenshotHeight: game.screenshot_height,
                      platforms: game.platforms,
                    }}
                  />,
                ];
              })}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
