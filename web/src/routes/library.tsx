import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { GameCover } from "@/components/GameCover";
import { Chip, SectionHeader } from "@/components/ui-bits";
import { isAuthenticated, listSavedGames } from "@/lib/api";
import { lovableQueryKeys, toSavedGameCard } from "@/lib/lovable-data";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Library — GameFinder" },
      {
        name: "description",
        content:
          "Your synced library across storefronts, with statuses and shared-with-friends visibility.",
      },
    ],
  }),
  component: LibraryPage,
});

const tabs = [
  "All",
  "Playing with Friends",
  "Playing",
  "Want to Play",
  "Completed",
  "Paused",
] as const;

export function LibraryPage() {
  const signedIn = isAuthenticated();
  const {
    data: savedGames = [],
    isError,
    isPending,
  } = useQuery({
    queryKey: lovableQueryKeys.savedGames,
    queryFn: listSavedGames,
    enabled: signedIn,
  });
  const owned = savedGames.map(toSavedGameCard);
  const hint = !signedIn
    ? "Sign in to view your library"
    : isPending
      ? "Loading library..."
      : isError
        ? "Data unavailable"
        : `${owned.length} games synced - Data unavailable shared with friends`;
  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionHeader title="Library" hint={hint} />
        </div>
        <div className="flex items-center gap-6 font-mono">
          {[
            { l: "Playing", v: "Data unavailable" },
            { l: "Completed", v: "Data unavailable" },
            { l: "Backlog", v: "Data unavailable" },
            { l: "Hours", v: "Data unavailable" },
          ].map((s) => (
            <div key={s.l}>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {s.l}
              </p>
              <p className="text-xl font-bold">{s.v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-2 border-b border-border pb-4">
        {tabs.map((t, i) => (
          <button
            key={t}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${i === 0 ? "bg-white/5 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {!signedIn ? (
          <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
            Sign in to view your library
          </p>
        ) : isError ? (
          <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
            Data unavailable
          </p>
        ) : (
          owned.map((g) => (
            <Link
              key={g.id}
              to="/games/$gameId"
              params={{ gameId: g.id }}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-5 rounded-xl border border-border bg-surface p-4 transition hover:border-white/20 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
            >
              <GameCover
                from="#14b8a6"
                to="#0f172a"
                title={g.title}
                compact
                className="size-16 shrink-0 rounded-lg"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="truncate font-bold">{g.title}</h4>
                  {g.notes?.toLowerCase().includes("playing with friends") && (
                    <Chip tone="primary">Data unavailable</Chip>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Data unavailable
                </p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Status
                </p>
                <p className="text-sm font-bold">Data unavailable</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Playtime
                </p>
                <p className="font-mono text-sm font-bold">
                  {g.playtimeForever === null
                    ? "Data unavailable"
                    : `${Math.round(g.playtimeForever / 60)}h`}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </AppShell>
  );
}
