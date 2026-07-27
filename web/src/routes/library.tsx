import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { PsnLibraryPanel } from "@/features/library/PsnLibraryPanel";
import { SteamLibraryPanel } from "@/features/library/SteamLibraryPanel";
import { getLibraryOverview, resolveSteamLibraryGame, type LibraryGame } from "@/lib/api";

type LibraryFilter = "all" | "playfinder" | "steam" | "psn";
const filters: { value: LibraryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "playfinder", label: "PlayFinder" },
  { value: "steam", label: "Steam" },
  { value: "psn", label: "PSN" },
];

export const Route = createFileRoute("/library")({ component: LibraryPage });

function LibraryGameRow({ game }: { game: LibraryGame }) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState(false);
  const body = <>
    <GameCover from={game.cover_url ?? "#14b8a6"} to="#0f172a" title={game.title} compact className="size-16 shrink-0 rounded-lg" />
    <div className="min-w-0"><h4 className="truncate font-bold">{game.title}</h4><p className="text-xs text-muted-foreground">{game.playtime_forever ? `${Math.round(game.playtime_forever / 60)}h played` : "Saved in your library"}</p></div>
    <Chip tone="primary">{game.source === "manual" ? "PlayFinder" : game.source}</Chip>
  </>;
  const className = "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-5 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  if (game.detail_game_id) return <Link to="/games/$gameId" params={{ gameId: game.detail_game_id }} className={className}>{body}</Link>;
  return <div><button type="button" className={`${className} w-full text-left`} disabled={resolving} onClick={async () => { try { setResolving(true); setError(""); const value = await resolveSteamLibraryGame(Number(game.external_id)); navigate({ to: "/games/$gameId", params: { gameId: String(value.game_id) } }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not open this Steam game."); } finally { setResolving(false); } }}>{body}</button>{error ? <p role="alert" className="mt-2 text-sm text-destructive">{error}</p> : null}</div>;
}

export function LibraryPage() {
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [showConnections, setShowConnections] = useState(false);
  const query = useQuery({ queryKey: ["library-overview"], queryFn: getLibraryOverview });
  const games = query.data?.games ?? [];
  const visibleGames = games.filter((game) => filter === "all" ? true : filter === "playfinder" ? game.source === "manual" : game.source === filter);
  const sourceLabel = filters.find((item) => item.value === filter)?.label ?? "Library";
  return <AppShell>
    <SectionHeader title="Library" hint={query.isPending ? "Loading your games…" : `${games.length} games across your connected libraries`} action={<button type="button" className="text-sm font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => setShowConnections((shown) => !shown)}>{showConnections ? "Hide connections" : "Manage connections"}</button>} />
    <div role="group" aria-label="Library platform" className="mb-8 flex flex-wrap gap-2">
      {filters.map((item) => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={`rounded-lg border px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${filter === item.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:border-primary/60 hover:bg-primary/10"}`}>{item.label}</button>)}
    </div>
    {query.isError ? <p role="alert" className="rounded-xl border border-border bg-surface p-6 text-sm text-muted-foreground">Your library could not be loaded. Please try again.</p> : visibleGames.length ? <div className="space-y-3">{visibleGames.map((game) => <LibraryGameRow key={`${game.source}-${game.id}`} game={game} />)}</div> : <div className="rounded-xl border border-border bg-surface p-6 text-sm text-muted-foreground"><p>No {sourceLabel} games are in your library yet.</p><Link to="/search" className="mt-4 inline-block font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Find games</Link></div>}
    {query.data?.steam_error ? <p role="alert" className="mt-4 text-sm text-muted-foreground">{query.data.steam_error}</p> : null}
    {showConnections ? <div className="mt-10 space-y-8"><SteamLibraryPanel linked={undefined} error={undefined} /><PsnLibraryPanel /></div> : null}
  </AppShell>;
}
