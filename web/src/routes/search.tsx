import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { getRecommendations, searchGames, type RecommendationItem } from "@/lib/api";
import { lovableQueryKeys, toGameCard } from "@/lib/lovable-data";

export const Route = createFileRoute("/search")({ component: SearchPage });

function normalized(value: string | null) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function AiRecommendationCard({ item }: { item: RecommendationItem }) {
  const matchQuery = useQuery({
    queryKey: ["ai-search-catalog-match", item.title],
    queryFn: () => searchGames(item.title),
  });
  const match = matchQuery.data?.results.find((game) => normalized(game.name) === normalized(item.title)) ?? matchQuery.data?.results[0];

  return <article className="rounded-xl border border-border bg-surface p-5">
    <Sparkles className="mb-3 size-4 text-primary" />
    <h3 className="font-bold">{item.title}</h3>
    <p className="mt-2 text-sm text-muted-foreground">{item.reason}</p>
    {item.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{item.tags.map((tag) => <Chip key={tag}>{tag}</Chip>)}</div>}
    {match?.id ? <Link to="/games/$gameId" params={{ gameId: String(match.id) }} aria-label={`View game details for ${item.title}`} className="mt-4 inline-block text-sm font-bold text-primary hover:underline">View game details</Link> : matchQuery.isSuccess ? <p className="mt-4 text-xs text-muted-foreground">A catalog match is not available yet.</p> : <p className="mt-4 text-xs text-muted-foreground">Finding the catalog entry…</p>}
  </article>;
}

export function SearchPage() {
  const [mode, setMode] = useState<"catalog" | "ai">("catalog");
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const catalog = useQuery({ queryKey: lovableQueryKeys.search(query), queryFn: () => searchGames(query), enabled: mode === "catalog" && query.trim().length > 1 });
  const ai = useQuery({ queryKey: ["ai-search", submitted], queryFn: () => getRecommendations(submitted), enabled: mode === "ai" && Boolean(submitted) });
  const games = catalog.data?.results.map(toGameCard) ?? [];
  const ask = () => setSubmitted(query.trim());

  return <AppShell>
    <SectionHeader title="Search" hint={mode === "ai" ? "Describe a game, mood, budget, or who you want to play with." : "Search the public game catalog by title."} />
    <div className="mb-6 flex gap-2"><button onClick={() => setMode("catalog")} className={`rounded-lg px-4 py-2 text-sm font-bold ${mode === "catalog" ? "bg-primary text-primary-foreground" : "border border-border"}`}>Title search</button><button onClick={() => setMode("ai")} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${mode === "ai" ? "bg-primary text-primary-foreground" : "border border-border"}`}><Sparkles className="size-4" />AI Search</button></div>
    <div className="mb-8 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"><Search className="size-4 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && mode === "ai") ask(); }} className="flex-1 bg-transparent text-sm outline-none" placeholder={mode === "ai" ? "Describe what you want to play…" : "Search by title…"} />{mode === "ai" && <button onClick={ask} disabled={!query.trim()} className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50">Ask AI</button>}</div>
    {mode === "ai" ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{!submitted && <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">Tell AI what you want to play to get recommendations.</p>}{ai.isLoading && <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">Finding recommendations…</p>}{ai.isError && <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">AI search is not available right now. Please try again.</p>}{ai.data?.recommendations.length === 0 && <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">No recommendations matched that description. Try mentioning a genre, platform, or mood.</p>}{ai.data?.recommendations.map((item) => <AiRecommendationCard key={item.title} item={item} />)}</div> : <div className="grid grid-cols-2 gap-5 md:grid-cols-4">{query.trim().length < 2 && <p className="col-span-full rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">Enter at least two characters to search the catalog.</p>}{catalog.isLoading && <p className="col-span-full rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">Searching the catalog…</p>}{catalog.isError && <p className="col-span-full rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">Catalog search is not available right now. Try again shortly.</p>}{catalog.isSuccess && games.length === 0 && <p className="col-span-full rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">No catalog games matched “{query}”.</p>}{games.map((game) => game.id ? <Link key={game.id} to="/games/$gameId" params={{ gameId: game.id }} className="overflow-hidden rounded-xl border border-border bg-surface"><GameCover from={game.imageUrl ?? "#1f2937"} to="#111827" title={game.title ?? "Untitled game"} className="aspect-[3/4] w-full" /><p className="p-3 font-bold">{game.title}</p></Link> : <article key={game.title} className="overflow-hidden rounded-xl border border-border bg-surface"><GameCover from={game.imageUrl ?? "#1f2937"} to="#111827" title={game.title ?? "Untitled game"} className="aspect-[3/4] w-full" /><p className="p-3 font-bold">{game.title}</p></article>)}</div>}
  </AppShell>;
}
